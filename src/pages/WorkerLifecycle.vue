<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const status = ref('Worker not started')
const logs = ref([])
let worker = null

// Function to add a log entry with timestamp
function addLog(type, message) {
    const timestamp = new Date().toLocaleTimeString()
    logs.value.unshift({
        id: Date.now() + Math.random(),
        type,
        message,
        timestamp,
    })
}

// Create a new worker
function createWorker() {
    if (worker) {
        addLog('warning', 'Worker already exists. Terminating first.')
        terminateWorker()
    }

    try {
        addLog('info', 'Creating worker...')
        worker = new Worker(
            new URL('@/workers/lifecycle-worker.js', import.meta.url),
            { type: 'module' }
        )

        // Set up message handler
        worker.onmessage = (event) => {
            const { type, data } = event.data
            addLog('message', `Received from worker: ${type} - ${data}`)
            status.value = `Last worker message: ${type} - ${data}`
        }

        // Set up error handlers
        worker.onerror = (error) => {
            addLog('error', `Error: ${error.message}`)
            status.value = 'Worker error occurred'
            console.log('Worker error:', error)
        }

        worker.onmessageerror = (error) => {
            addLog('error', 'Failed to deserialize message from worker')
            console.error('Message error:', error)
        }

        status.value = 'Worker created'
        addLog('success', 'Worker created successfully')
    } catch (error) {
        addLog('error', `Failed to create worker: ${error.message}`)
        status.value = 'Failed to create worker'
    }
}

// Send message to worker
function sendMessage() {
    if (!worker) {
        addLog('error', 'No worker exists. Create one first.')
        return
    }

    const message = {
        type: 'PING',
        data: `Hello from main thread at ${new Date().toISOString()}`,
    }

    try {
        worker.postMessage(message)
        addLog(
            'info',
            `Message sent to worker: ${message.type} - ${message.data}`
        )
    } catch (error) {
        addLog('error', `Failed to send message: ${error.message}`)
    }
}

// Cause a deliberate error in the worker
function causeError() {
    if (!worker) {
        addLog('error', 'No worker exists. Create one first.')
        return
    }

    try {
        worker.postMessage({ type: 'ERROR' })
        addLog('warning', 'Sent error instruction to worker')
    } catch (error) {
        addLog('error', `Failed to send message: ${error.message}`)
    }
}

// Terminate the worker
function terminateWorker() {
    if (!worker) {
        addLog('warning', 'No worker to terminate')
        return
    }

    try {
        worker.terminate()
        addLog('info', 'Worker terminated')
        status.value = 'Worker terminated'
        worker = null
    } catch (error) {
        addLog('error', `Failed to terminate worker: ${error.message}`)
    }
}

// Clean up on component unmount
onUnmounted(() => {
    if (worker) {
        worker.terminate()
        worker = null
    }
})
</script>

<template>
    <div class="worker-lifecycle-page">
        <div class="container">
            <div class="header-section">
                <h1>Web Worker Lifecycle Demo</h1>
                <p class="status">Status: {{ status }}</p>
            </div>

            <div class="control-panel">
                <h2>Worker Controls</h2>
                <div class="buttons">
                    <button
                        @click="createWorker"
                        class="create-btn"
                    >
                        Create Worker
                    </button>
                    <button
                        @click="sendMessage"
                        class="send-btn"
                    >
                        Send Message
                    </button>
                    <button
                        @click="causeError"
                        class="error-btn"
                    >
                        Cause Error
                    </button>
                    <button
                        @click="terminateWorker"
                        class="terminate-btn"
                    >
                        Terminate Worker
                    </button>
                </div>
            </div>

            <div class="code-examples">
                <h2>Web Worker Lifecycle Code Examples</h2>

                <div class="code-block">
                    <h3>Create a Worker</h3>
                    <pre><code>const worker = new Worker('worker.js', { type: 'module' });</code></pre>
                </div>

                <div class="code-block">
                    <h3>Communicate with Worker</h3>
                    <pre><code>
// Send message to worker
worker.postMessage({ type: 'COMMAND', data: payload });

// Receive messages from worker
worker.onmessage = (event) => {
  console.log('Message from worker:', event.data);
};</code></pre>
                </div>

                <div class="code-block">
                    <h3>Error Handling</h3>
                    <pre><code>// Handle runtime errors
worker.onerror = (error) => {
  console.error('Worker error:', error.message);
};

// Handle message serialization errors
worker.onmessageerror = (error) => {
  console.error('Message error:', error);
};</code></pre>
                </div>

                <div class="code-block">
                    <h3>Terminate a Worker</h3>
                    <pre><code>worker.terminate(); // Immediately stops the worker</code></pre>
                </div>
            </div>

            <div class="log-section">
                <h2>Worker Activity Log</h2>
                <p class="log-tip">
                    Open your browser console to see all logged messages
                </p>

                <div class="log-container">
                    <div
                        v-for="log in logs"
                        :key="log.id"
                        :class="['log-entry', log.type]"
                    >
                        <span class="log-time">{{ log.timestamp }}</span>
                        <span :class="['log-type', log.type]">
                            {{ log.type.toUpperCase() }}
                        </span>
                        <span class="log-message">{{ log.message }}</span>
                    </div>

                    <div
                        v-if="logs.length === 0"
                        class="empty-log"
                    >
                        No activity yet. Create a worker to begin.
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.worker-lifecycle-page {
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
}

.container {
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
}

.header-section {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
}

h1 {
    color: #1f2937;
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
}

h2 {
    color: #374151;
    font-size: 1.25rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.5rem;
}

.status {
    font-size: 1rem;
    font-weight: 500;
    color: #4b5563;
    background-color: #f3f4f6;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    margin-top: 0.5rem;
}

.control-panel {
    margin-bottom: 2rem;
    background-color: #f9fafb;
    border-radius: 6px;
    padding: 1rem;
}

.buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
}

button:hover {
    transform: translateY(-1px);
}

button:active {
    transform: translateY(0);
}

.create-btn {
    background-color: #10b981;
    color: white;
}

.create-btn:hover {
    background-color: #059669;
}

.send-btn {
    background-color: #3b82f6;
    color: white;
}

.send-btn:hover {
    background-color: #2563eb;
}

.error-btn {
    background-color: #f59e0b;
    color: white;
}

.error-btn:hover {
    background-color: #d97706;
}

.terminate-btn {
    background-color: #ef4444;
    color: white;
}

.terminate-btn:hover {
    background-color: #dc2626;
}

.code-examples {
    margin-bottom: 2rem;
}

.code-block {
    margin-bottom: 1.5rem;
}

.code-block h3 {
    font-size: 1rem;
    color: #4b5563;
    margin-bottom: 0.5rem;
}

pre {
    background-color: #1f2937;
    color: #e5e7eb;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
    font-size: 0.9rem;
    line-height: 1.5;
}

.log-section {
    margin-top: 2rem;
}

.log-tip {
    color: #6b7280;
    font-style: italic;
    margin-bottom: 1rem;
    font-size: 0.9rem;
}

.log-container {
    background-color: #1f2937;
    color: #e5e7eb;
    border-radius: 4px;
    padding: 1rem;
    height: 300px;
    overflow-y: auto;
    font-family: monospace;
}

.log-entry {
    padding: 0.5rem;
    border-bottom: 1px solid #374151;
    display: flex;
    align-items: flex-start;
    font-size: 0.875rem;
}

.log-time {
    color: #9ca3af;
    margin-right: 0.75rem;
    flex-shrink: 0;
}

.log-type {
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    margin-right: 0.75rem;
    font-weight: 500;
    font-size: 0.75rem;
    flex-shrink: 0;
}

.log-type.info {
    background-color: #3b82f6;
    color: white;
}

.log-type.success {
    background-color: #10b981;
    color: white;
}

.log-type.warning {
    background-color: #f59e0b;
    color: white;
}

.log-type.error {
    background-color: #ef4444;
    color: white;
}

.log-type.message {
    background-color: #8b5cf6;
    color: white;
}

.log-message {
    line-height: 1.4;
    word-break: break-word;
}

.empty-log {
    color: #9ca3af;
    text-align: center;
    padding: 2rem;
}
</style>
