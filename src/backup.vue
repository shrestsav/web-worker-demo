<script setup>
import { ref, computed } from 'vue'
import PSD from 'psd.js'          // make sure you installed `psd.js`, *not* `psd`

const thumbnails = ref([])
const isProcessing = ref(false)
const totalFiles = ref(0)
const processedFiles = ref(0)
const dragActive = ref(false)

/**
 * Creates a thumbnail from an image source (URL or data URL).
 * @param {string} src - The image source URL.
 * @param {boolean} isFullSize - Whether to keep original dimensions or resize.
 * @returns {Promise<string>} Thumbnail data URL.
 */
const createThumbnailFromImageSrc = (src, isFullSize = false) => {
  const image = new Image()
  image.src = src

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const originalWidth = image.width
      const originalHeight = image.height

      const { width, height } = isFullSize
        ? { width: originalWidth, height: originalHeight }
        : resizeImage(originalWidth, originalHeight)

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject("Canvas not supported")

      ctx.drawImage(image, 0, 0, width, height)
      resolve({
        src: canvas.toDataURL("image/png"),
        width,
        height,
        originalWidth,
        originalHeight
      })
    }
    image.onerror = () => {
      reject("Error loading image")
    }
  })
}

/**
 * Resizes an image while maintaining aspect ratio.
 * @param {number} width - Original width.
 * @param {number} height - Original height.
 * @returns {Object} New dimensions.
 */
const resizeImage = (width, height) => {
  const maxWidth = 500
  const maxHeight = 500
  if (width <= maxWidth && height <= maxHeight) return { width, height }
  const aspectRatio = width / height
  return aspectRatio > 1
    ? { width: maxWidth, height: Math.round(maxWidth / aspectRatio) }
    : { width: Math.round(maxHeight * aspectRatio), height: maxHeight }
}

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
  
  // Clear previous thumbnails
  thumbnails.value = []
  isProcessing.value = true
  totalFiles.value = files.length
  processedFiles.value = 0
  
  try {
    // Process each file one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        // Parse the PSD file
        const psd = await PSD.fromDroppedFile(file)
        
        // Extract the flattened preview
        const imageSrc = psd.image.toPng().src
        
        // Process both original and resized versions
        const [originalImage, resizedImage] = await Promise.all([
          createThumbnailFromImageSrc(imageSrc, true),  // Original size
          createThumbnailFromImageSrc(imageSrc, false)  // Resized version
        ])
        
        // Add to thumbnails array
        thumbnails.value.push({
          id: Date.now() + i, // Unique ID
          name: file.name,
          original: originalImage,
          resized: resizedImage
        })
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err)
        // Add error placeholder
        thumbnails.value.push({
          id: Date.now() + i,
          name: file.name,
          error: true,
          errorMessage: 'Could not read preview – was the file saved with "Maximise Compatibility"?'
        })
      } finally {
        processedFiles.value++
      }
    }
  } catch (err) {
    console.error('Error processing files:', err)
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="card">
      <div class="card-header max-w-screen-2xl mx-auto w-full px-6">
        <h2 class="text-xl font-semibold">PSD Thumbnail Viewer</h2>
        <p class="text-sm text-gray-500">View thumbnails from your PSD files</p>
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
          <svg xmlns="http://www.w3.org/2000/svg" class="upload-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
          <p class="text-lg font-medium">Drag & Drop PSD Files Here</p>
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
      
      <div v-if="isProcessing" class="max-w-screen-2xl mx-auto w-full px-6">
        <div class="processing-container">
          <div class="loading-spinner"></div>
          <div class="mt-4 text-center">
            <p class="text-lg font-medium">Processing PSD Files</p>
            <p class="text-sm text-gray-500 mb-2">{{ processedFiles }} of {{ totalFiles }} files</p>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ progressPercentage }}% complete</p>
          </div>
        </div>
      </div>
      
      <div v-if="thumbnails.length > 0" class="max-w-screen-2xl mx-auto w-full px-6">
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
                <h3 class="thumbnail-title" :title="thumb.name">{{ thumb.name }}</h3>
                <p v-if="!thumb.error" class="thumbnail-dimensions">
                  {{ thumb.original.originalWidth }}×{{ thumb.original.originalHeight }}px
                </p>
              </div>
              
              <div class="thumbnail-container">
                <img 
                  v-if="!thumb.error" 
                  :src="thumb.original.src" 
                  :alt="thumb.name"
                  class="thumbnail-image"
                  loading="lazy"
                />
                <div v-else class="error-container">
                  <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <p class="error-text">Error loading</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Resized Thumbnails -->
        <div class="thumbnail-section mt-8">
          <h3 class="section-title">Resized Thumbnails (Max 500×500px)</h3>
          <div class="thumbnail-scroll-container">
            <div 
              v-for="thumb in thumbnails" 
              :key="`resized-${thumb.id}`"
              class="thumbnail-card"
            >
              <div class="thumbnail-header">
                <h3 class="thumbnail-title" :title="thumb.name">{{ thumb.name }}</h3>
                <p v-if="!thumb.error" class="thumbnail-dimensions">
                  {{ thumb.resized.width }}×{{ thumb.resized.height }}px
                </p>
              </div>
              
              <div class="thumbnail-container">
                <img 
                  v-if="!thumb.error" 
                  :src="thumb.resized.src" 
                  :alt="thumb.name"
                  class="thumbnail-image"
                  loading="lazy"
                />
                <div v-else class="error-container">
                  <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <p class="error-text">Error loading</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="!isProcessing && thumbnails.length === 0" class="max-w-screen-2xl mx-auto w-full px-6">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
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
  to { transform: rotate(360deg); }
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
</style>
