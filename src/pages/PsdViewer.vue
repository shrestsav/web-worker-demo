<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
// PSD.js will be used in the worker instead of here

const thumbnails = ref([])
const isProcessing = ref(false)
const totalFiles = ref(0)
const processedFiles = ref(0)
const dragActive = ref(false)
const processingStartTime = ref(0)
const processingEndTime = ref(0)
const totalProcessingTime = ref(null)

// Web worker references
const workerPool = []
const MAX_WORKERS = 3 // Maximum number of worker threads to create

const progressPercentage = computed(() => {
    if (totalFiles.value === 0) return 0
    return Math.round((processedFiles.value / totalFiles.value) * 100)
})

function handleDragEnter(e) {
    e.preventDefault()
    e.stopPropagation()
    dragActive.value = true
}

function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    dragActive.value = false
}

function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
}

function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragActive.value = false

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files)
    }
}

async function handleSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files)
    }
}

async function processFiles(files) {
    if (!files || files.length === 0) return

    // Clear previous thumbnails and release memory from previous runs
    thumbnails.value = []
    isProcessing.value = true
    totalFiles.value = files.length
    processedFiles.value = 0

    // Start the processing timer
    processingStartTime.value = performance.now()
    totalProcessingTime.value = null

    try {
        // Initialize worker pool if it doesn't exist
        if (workerPool.length === 0) {
            initializeWorkerPool()
        }

        const fileArray = Array.from(files)
        const pendingFiles = [...fileArray]
        const activePromises = new Map() // Track active processing promises

        // Function to get an available worker from the pool
        const getAvailableWorker = () => {
            // Find a worker that's not busy or create a new one if under MAX_WORKERS
            const availableWorker = workerPool.find((w) => !w.busy)
            if (availableWorker) {
                availableWorker.busy = true
                return availableWorker.worker
            }

            // If all workers are busy and we haven't reached max, create a new one
            if (workerPool.length < MAX_WORKERS) {
                const newWorker = createWorker()
                workerPool.push({ worker: newWorker, busy: true })
                return newWorker
            }

            // If all workers are busy and we've reached max, return the first one (round-robin)
            return workerPool[0].worker
        }

        // Function to mark a worker as available
        const markWorkerAvailable = (worker) => {
            const workerObj = workerPool.find((w) => w.worker === worker)
            if (workerObj) {
                workerObj.busy = false
            }
        }

        // Function to process the next file in the queue
        const processNextFile = async () => {
            if (pendingFiles.length === 0) return

            const file = pendingFiles.shift()
            const id = Date.now() + Math.random() // Unique ID

            try {
                // Read the file as ArrayBuffer to send to the worker
                const fileBuffer = await readFileAsArrayBuffer(file)

                // Get an available worker
                const worker = getAvailableWorker()

                // Create a promise that resolves when this file is processed
                const processPromise = new Promise((resolve) => {
                    // Store the resolve function to be called when worker completes this file
                    const messageHandler = (event) => {
                        const { type, data } = event.data
                        if (type === 'process_complete' && data.id === id) {
                            // Remove this specific handler once the file is processed
                            resolve(worker)
                        }
                    }

                    // Store the handler reference so we can remove it later
                    activePromises.set(id, { resolve, messageHandler, worker })

                    // Add temporary message listener for this specific file
                    worker.addEventListener('message', messageHandler)
                })

                // Send the file to the worker for processing
                worker.postMessage(
                    {
                        type: 'process_psd',
                        data: {
                            fileBuffer,
                            fileName: file.name,
                            fileSize: file.size,
                            id,
                        },
                    },
                    [fileBuffer]
                ) // Transfer the buffer to avoid copying

                // When this file is processed, clean up and process next file
                processPromise.then((completedWorker) => {
                    const handler = activePromises.get(id)
                    if (handler && handler.messageHandler) {
                        handler.worker.removeEventListener(
                            'message',
                            handler.messageHandler
                        )
                    }
                    activePromises.delete(id)

                    // Mark the worker as available
                    markWorkerAvailable(completedWorker)

                    // Process next file if any remain
                    processNextFile()
                })
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err)
                // Add error placeholder
                thumbnails.value.push({
                    id,
                    name: file.name,
                    error: true,
                    errorMessage:
                        'Could not read preview – was the file saved with "Maximise Compatibility"?',
                })
                processedFiles.value++

                // Process next file
                processNextFile()
            }
        }

        // Start initial batch of files up to MAX_WORKERS limit
        const initialBatchSize = Math.min(MAX_WORKERS, fileArray.length)
        for (let i = 0; i < initialBatchSize; i++) {
            processNextFile()
        }
    } catch (err) {
        console.error('Error processing files:', err)
    }
}

// Function to read a file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsArrayBuffer(file)
    })
}

// Create a new worker
function createWorker() {
    const worker = new Worker(
        new URL('../workers/psdWorker.js', import.meta.url),
        { type: 'module' }
    )

    // Handle messages from the worker
    worker.onmessage = async (event) => {
        const { type, data } = event.data

        if (type === 'process_complete') {
            try {
                // Use thumbnails directly from the worker
                if (
                    data.success &&
                    data.originalThumbnail &&
                    data.resizedThumbnail
                ) {
                    // Add the processed thumbnail to the list
                    thumbnails.value.push({
                        id: data.id,
                        name: data.name,
                        original: data.originalThumbnail,
                        resized: data.resizedThumbnail,
                        fileSize: data.fileSize,
                        isPreview: data.isPreview,
                        isPlaceholder: data.isPlaceholder,
                    })
                } else {
                    // Handle error case
                    thumbnails.value.push({
                        id: data.id,
                        name: data.name,
                        error: true,
                        errorMessage:
                            data.errorMessage || 'Failed to process PSD data',
                    })
                }

                // Explicitly request browser to free memory
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(() => {
                        // Attempt to free memory when browser is idle
                        if (window.gc) window.gc()
                    })
                }
            } catch (err) {
                console.error('Error processing PSD data:', err)
                thumbnails.value.push({
                    id: data.id,
                    name: data.name,
                    error: true,
                    errorMessage: 'Error processing PSD data: ' + err.message,
                })
            } finally {
                processedFiles.value++

                // Check if all files have been processed
                if (processedFiles.value >= totalFiles.value) {
                    // Stop the timer and calculate total time
                    processingEndTime.value = performance.now()
                    totalProcessingTime.value = (
                        (processingEndTime.value - processingStartTime.value) /
                        1000
                    ).toFixed(2)

                    isProcessing.value = false

                    // Request cleanup before terminating the worker
                    if (psdWorker) {
                        psdWorker.postMessage({ type: 'cleanup' })
                        // We'll terminate the worker after cleanup completes
                        // See the cleanup_complete handler below
                    }
                }
            }
        } else if (type === 'process_error') {
            // Add error placeholder
            thumbnails.value.push({
                id: data.id,
                name: data.name,
                error: true,
                errorMessage: data.errorMessage,
            })
            processedFiles.value++

            // Check if all files have been processed
            if (processedFiles.value >= totalFiles.value) {
                isProcessing.value = false

                // Request cleanup before terminating the worker
                if (psdWorker) {
                    psdWorker.postMessage({ type: 'cleanup' })
                }
            }
        } else if (type === 'cleanup_complete') {
            console.log('Worker memory cleanup completed')
            // Now terminate the worker
            if (psdWorker) {
                psdWorker.terminate()
                psdWorker = null
            }
        }
    }

    // Handle worker errors
    worker.onerror = (error) => {
        console.error('Worker error:', error)
    }

    return worker
}

// Initialize the worker pool
function initializeWorkerPool() {
    // Clear existing pool
    cleanupWorkerPool()

    // Create initial workers
    for (let i = 0; i < MAX_WORKERS; i++) {
        const worker = createWorker()
        workerPool.push({ worker, busy: false })
    }
}

// Clean up worker pool
function cleanupWorkerPool() {
    for (const workerObj of workerPool) {
        try {
            // First request cleanup
            workerObj.worker.postMessage({ type: 'cleanup' })

            // Terminate after a short delay
            setTimeout(() => {
                workerObj.worker.terminate()
            }, 100)
        } catch (e) {
            // If there's any error, force terminate
            workerObj.worker.terminate()
        }
    }

    // Clear the pool
    workerPool.length = 0
}

// Get an available worker from the pool
function getAvailableWorker() {
    for (const workerObj of workerPool) {
        if (!workerObj.busy) {
            workerObj.busy = true
            return workerObj
        }
    }

    // If no worker is available, create a new one
    const worker = createWorker()
    workerPool.push({ worker, busy: true })
    return { worker, busy: true }
}

// Mark a worker as available
function markWorkerAvailable(worker) {
    for (const workerObj of workerPool) {
        if (workerObj.worker === worker) {
            workerObj.busy = false
            break
        }
    }
}

// Clean up worker pool when component is unmounted
onUnmounted(() => {
    cleanupWorkerPool()
})
</script>

<template>
    <div class="page-container">
        <div class="card">
            <div class="card-header max-w-screen-2xl mx-auto w-full px-6">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-semibold" style="color: black">
                            PSD Thumbnail Viewer
                        </h2>
                        <p class="text-sm text-gray-500" style="color: black">
                            View thumbnails from your PSD files
                        </p>
                    </div>
                </div>
            </div>

            <div class="max-w-screen-2xl mx-auto w-full px-6">
                <div
                    class="file-drop-area"
                    :class="{ 'drag-active': dragActive }"
                    @dragenter="handleDragEnter"
                    @dragleave="handleDragLeave"
                    @dragover="handleDragOver"
                    @drop="handleDrop"
                >
                    <div class="file-drop-content">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="upload-icon"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                                clip-rule="evenodd"
                            />
                        </svg>
                        <p class="text-lg font-medium">
                            Drag & Drop PSD Files Here
                        </p>
                        <p class="text-sm text-gray-500">or</p>
                        <label class="file-select-button">
                            Browse Files
                            <input
                                type="file"
                                accept=".psd"
                                @change="handleSelect"
                                multiple
                                class="hidden"
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div
                v-if="isProcessing"
                class="max-w-screen-2xl mx-auto w-full px-6"
            >
                <div class="processing-container">
                    <div class="loading-spinner"></div>
                    <div class="mt-4 text-center">
                        <p class="text-lg font-medium">Processing PSD Files</p>
                        <p class="text-sm text-gray-500 mb-2">
                            {{ processedFiles }} of {{ totalFiles }} files
                        </p>
                        <div class="progress-bar">
                            <div
                                class="progress-fill"
                                :style="{ width: `${progressPercentage}%` }"
                            ></div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                            {{ progressPercentage }}% complete
                        </p>
                    </div>
                </div>
            </div>

            <div
                v-if="totalProcessingTime && !isProcessing"
                class="max-w-screen-2xl mx-auto w-full px-6 mt-4"
            >
                <div class="processing-stats">
                    <div class="stats-card">
                        <div class="stats-icon">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <div class="stats-content">
                            <h4 class="stats-title">Processing Time</h4>
                            <p class="stats-value">
                                {{ totalProcessingTime }} seconds
                            </p>
                            <p class="stats-detail">
                                {{ totalFiles }} files ({{
                                    (
                                        totalFiles /
                                        parseFloat(totalProcessingTime)
                                    ).toFixed(2)
                                }}
                                files/sec)
                            </p>
                        </div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-icon worker-icon">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                />
                            </svg>
                        </div>
                        <div class="stats-content">
                            <h4 class="stats-title">Worker Threads</h4>
                            <p class="stats-value">{{ MAX_WORKERS }}</p>
                            <p class="stats-detail">
                                Parallel processing enabled
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if="thumbnails.length > 0"
                class="max-w-screen-2xl mx-auto w-full px-6"
            >
                <!-- Original Size Thumbnails -->
                <div class="thumbnail-section">
                    <h3 class="section-title">Original Size Thumbnails</h3>
                    <div class="thumbnail-scroll-container">
                        <div
                            v-for="thumb in thumbnails"
                            :key="`original-${thumb.id}`"
                            class="thumbnail-card"
                        >
                            <div class="thumbnail-header">
                                <h3
                                    class="thumbnail-title"
                                    :title="thumb.name"
                                >
                                    {{ thumb.name }}
                                </h3>
                                <div class="flex justify-between">
                                    <p
                                        v-if="
                                            !thumb.error &&
                                            thumb.original &&
                                            thumb.original.originalWidth
                                        "
                                        class="thumbnail-dimensions"
                                    >
                                        {{ thumb.original.originalWidth }}×{{
                                            thumb.original.originalHeight
                                        }}px
                                    </p>
                                    <p
                                        v-if="thumb.fileSize"
                                        class="thumbnail-filesize"
                                    >
                                        {{ thumb.fileSize }}
                                    </p>
                                </div>
                            </div>

                            <div class="thumbnail-container">
                                <img
                                    v-if="
                                        !thumb.error &&
                                        thumb.original &&
                                        thumb.original.src
                                    "
                                    :src="thumb.original.src"
                                    :alt="thumb.name"
                                    class="thumbnail-image"
                                    loading="lazy"
                                />
                                <div
                                    v-else
                                    class="error-container"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="error-icon"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                    <p class="error-text">Error loading</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Resized Thumbnails -->
                <div class="thumbnail-section mt-8">
                    <h3 class="section-title">
                        Resized Thumbnails (Max 500×500px)
                    </h3>
                    <div class="thumbnail-scroll-container">
                        <div
                            v-for="thumb in thumbnails"
                            :key="`resized-${thumb.id}`"
                            class="thumbnail-card"
                        >
                            <div class="thumbnail-header">
                                <h3
                                    class="thumbnail-title"
                                    :title="thumb.name"
                                >
                                    {{ thumb.name }}
                                </h3>
                                <p
                                    v-if="
                                        !thumb.error &&
                                        thumb.resized &&
                                        thumb.resized.width
                                    "
                                    class="thumbnail-dimensions"
                                >
                                    {{ thumb.resized.width }}×{{
                                        thumb.resized.height
                                    }}px
                                </p>
                            </div>

                            <div class="thumbnail-container">
                                <img
                                    v-if="
                                        !thumb.error &&
                                        thumb.resized &&
                                        thumb.resized.src
                                    "
                                    :src="thumb.resized.src"
                                    :alt="thumb.name"
                                    class="thumbnail-image"
                                    loading="lazy"
                                />
                                <div
                                    v-else
                                    class="error-container"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="error-icon"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                    <p class="error-text">Error loading</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if="!isProcessing && thumbnails.length === 0"
                class="max-w-screen-2xl mx-auto w-full px-6"
            >
                <div class="empty-state">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="empty-icon"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    <p class="empty-text">No PSD files selected</p>
                    <p class="empty-subtext">Select files to view thumbnails</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.page-container {
    padding: 1.5rem;
    min-height: calc(100vh - 65px);
    background-color: #f9fafb;
    width: 100%;
}

.card {
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    width: 100%;
    margin: 0 auto;
}

.card-header {
    padding: 1.5rem;
    border-bottom: 1px solid #f0f0f0;
}

.file-drop-area {
    padding: 4rem;
    border: 2px dashed #e2e8f0;
    border-radius: 8px;
    background-color: #f8fafc;
    margin: 1.5rem 0;
    transition: all 0.3s ease;
    cursor: pointer;
}

.drag-active {
    border-color: #3b82f6;
    background-color: #eff6ff;
    transform: scale(1.01);
}

.file-drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.upload-icon {
    width: 3rem;
    height: 3rem;
    color: #64748b;
    margin-bottom: 1rem;
}

.file-select-button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background-color: #3b82f6;
    color: white;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-block;
}

.file-select-button:hover {
    background-color: #2563eb;
    transform: translateY(-1px);
}

.processing-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
}

.loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.progress-bar {
    width: 100%;
    max-width: 300px;
    height: 8px;
    background-color: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background-color: #3b82f6;
    border-radius: 4px;
    transition: width 0.3s ease;
}

.thumbnail-section {
    padding: 1.5rem;
}

.section-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #1e293b;
}

.thumbnail-scroll-container {
    display: flex;
    overflow-x: auto;
    gap: 16px;
    padding: 0.5rem 0 1.5rem 0;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 #f1f1f1;
}

.thumbnail-scroll-container::-webkit-scrollbar {
    height: 8px;
}

.thumbnail-scroll-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

.thumbnail-scroll-container::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 10px;
}

.thumbnail-scroll-container::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
}

.thumbnail-card {
    flex: 0 0 auto;
    width: 220px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.2s;
    background-color: white;
    border: 1px solid #e2e8f0;
}

.thumbnail-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.thumbnail-header {
    padding: 0.75rem;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}

.thumbnail-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.thumbnail-dimensions {
    font-size: 0.65rem;
    color: #64748b;
    margin-top: 2px;
}

.thumbnail-container {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f8f9fa;
    padding: 0.5rem;
}

.thumbnail-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
}

.error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #ef4444;
    padding: 1rem;
}

.error-icon {
    width: 2.5rem;
    height: 2.5rem;
    margin-bottom: 0.5rem;
}

.error-text {
    font-size: 0.75rem;
    font-weight: 500;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.5rem;
    color: #64748b;
    text-align: center;
}

.empty-icon {
    width: 4rem;
    height: 4rem;
    color: #94a3b8;
    margin-bottom: 1rem;
}

.empty-text {
    font-size: 1.25rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
}

.empty-subtext {
    font-size: 0.875rem;
    color: #94a3b8;
}

.memory-input {
    width: 60px;
    padding: 2px 4px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 0.875rem;
}

.thumbnail-filesize {
    font-size: 0.65rem;
    color: #ef4444;
    margin-top: 2px;
    font-weight: 500;
}

.processing-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
}

.stats-card {
    flex: 1;
    min-width: 200px;
    background-color: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.stats-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
}

.worker-icon {
    background-color: rgba(99, 102, 241, 0.1);
    color: #6366f1;
}

.stats-content {
    flex: 1;
}

.stats-title {
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 4px;
}

.stats-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 2px;
}

.stats-detail {
    font-size: 0.75rem;
    color: #94a3b8;
}

p, h1, h2, h3, h4, h5, h6 {
    color: black;
}
</style>
