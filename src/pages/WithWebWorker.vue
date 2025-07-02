<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const status = ref('Idle')
const counter = ref(0)
const counterRunning = ref(true)
const imagePosition = ref(0)
const direction = ref(1)
const numWorkers = ref(1) // Number of workers to use (default: 1)
let workers = [] // Array to store worker instances
let counterInterval
let animationInterval

// Initialize a single worker
function createSingleWorker() {
    // Spin up the worker (ES-module style)
    const newWorker = new Worker(
        new URL('@/workers/worker-ui-demo.js', import.meta.url),
        { type: 'module' }
    )

    // Listen for results
    newWorker.onmessage = ({ data }) => {
        const { duration, result } = data
        status.value = `Done in ${duration.toFixed(
            0
        )} ms. Result: ${result.toFixed(2)}`

        console.log('Worker task completed, terminating worker...')
        // Terminate all workers after task is completed
        terminateAllWorkers()
        status.value += ' (Worker terminated)'
    }

    return newWorker
}

// Create multiple workers and handle their combined results
function createWorkers(count) {
    const newWorkers = []
    let completedWorkers = 0
    let totalResult = 0
    let maxDuration = 0

    for (let i = 0; i < count; i++) {
        const worker = new Worker(
            new URL('@/workers/worker-ui-demo.js', import.meta.url),
            { type: 'module' }
        )

        // Set up message handler for each worker
        worker.onmessage = ({ data }) => {
            const { duration, result } = data

            console.log(
                `Worker ${i + 1}/${count} completed in ${duration.toFixed(
                    0
                )} ms with result: ${result.toFixed(2)}`
            )

            // Accumulate results
            totalResult += result
            maxDuration = Math.max(maxDuration, duration)
            completedWorkers++

            // When all workers have completed, show the final result
            if (completedWorkers === count) {
                status.value = `All ${count} workers done in ${maxDuration.toFixed(
                    0
                )} ms. Result: ${totalResult.toFixed(2)}`
                terminateAllWorkers()
                status.value += ' (Workers terminated)'
            }
        }

        newWorkers.push(worker)
    }

    return newWorkers
}

// Terminate all workers
function terminateAllWorkers() {
    workers.forEach((worker) => {
        if (worker) {
            worker.terminate()
        }
    })
    workers = []
}

onMounted(() => {
    // Start counter and animation to demonstrate UI responsiveness
    startCounter()
    startAnimation()
})

onUnmounted(() => {
    // Clean up all workers when component is unmounted
    terminateAllWorkers()
    stopCounter()
    stopAnimation()
})

function startCounter() {
    counterRunning.value = true
    counterInterval = setInterval(() => {
        counter.value++
    }, 100)
}

function stopCounter() {
    clearInterval(counterInterval)
}

function startAnimation() {
    animationInterval = setInterval(() => {
        // Move the image back and forth
        imagePosition.value += direction.value * 2
        if (imagePosition.value > 100) {
            direction.value = -1
        } else if (imagePosition.value < 0) {
            direction.value = 1
        }
    }, 50)
}

function stopAnimation() {
    clearInterval(animationInterval)
}

function startTask() {
    const count = numWorkers.value
    console.log(`Starting task with ${count} worker${count > 1 ? 's' : ''}`)
    status.value = `Working with ${count} worker${
        count > 1 ? 's' : ''
    }… (UI still responsive! Notice counter and animation continue)`

    // Terminate any existing workers
    terminateAllWorkers()

    if (count === 1) {
        // Single worker mode
        const worker = createSingleWorker()
        workers.push(worker)

        // Kick off the task in the worker
        worker.postMessage({ iterations: 5e9 }) // Using 5e9 to match the non-worker version
    } else {
        // Multi-worker mode
        workers = createWorkers(count)

        // Calculate work division - each worker gets an equal share
        const iterationsPerWorker = 5e9 / count

        // Start each worker with its portion of the work
        workers.forEach((worker, index) => {
            const startIndex = Math.floor(index * iterationsPerWorker)
            const endIndex = Math.floor((index + 1) * iterationsPerWorker) - 1

            worker.postMessage({
                startIndex: startIndex,
                endIndex: endIndex,
                workerId: index + 1,
            })
        })
    }
}
</script>

<template>
    <div class="with-worker-demo">
        <h1>Web Worker demo</h1>

        <div class="demo-container">
            <div class="task-section">
                <h3>Heavy Task Section</h3>
                <div class="worker-control">
                    <label for="worker-count">
                        Worker Threads: {{ numWorkers }}
                    </label>
                    <div class="worker-buttons">
                        <button
                            @click="numWorkers = Math.max(1, numWorkers - 1)"
                            class="worker-btn"
                        >
                            -
                        </button>
                        <input
                            id="worker-count"
                            v-model.number="numWorkers"
                            type="number"
                            min="1"
                            max="16"
                        />
                        <button
                            @click="numWorkers = Math.min(16, numWorkers + 1)"
                            class="worker-btn"
                        >
                            +
                        </button>
                    </div>
                </div>
                <button
                    @click="startTask"
                    class="task-button"
                >
                    Start Heavy Computation
                </button>
                <p style="color: black">{{ status }}</p>
            </div>

            <div class="interactive-section">
                <h3>UI Responsiveness Test</h3>

                <div class="counter-box">
                    <p>
                        Real-time counter:
                        <span class="counter-value">{{ counter }}</span>
                    </p>
                    <p class="counter-note">
                        This counter updates every 100ms -
                        <strong>it keeps running during computation!</strong>
                    </p>
                </div>

                <div class="animation-container">
                    <div
                        class="moving-object"
                        :style="{ left: imagePosition + 'px' }"
                    ></div>
                </div>

                <div class="interaction-test">
                    <p>
                        Try interacting with these buttons during computation:
                    </p>
                    <button
                        class="test-button"
                        @click="counter += 10"
                    >
                        +10 to counter
                    </button>
                    <button
                        class="test-button"
                        @click="counter = 0"
                    >
                        Reset counter
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.with-worker-demo {
    padding: 20px;
    max-width: 900px;
    margin: 0 auto;
    font-family: sans-serif;
}

h1 {
    color: #333;
    margin-bottom: 20px;
    text-align: center;
}

h3 {
    color: #444;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
}

label {
    color: black;
}

.demo-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
}

.task-section,
.interactive-section {
    padding: 20px;
    background-color: white;
}

.task-section {
    background-color: #f8f9fa;
    border-bottom: 1px solid #e2e8f0;
}

/* Worker controls styling */
.worker-control {
    background-color: #e6f7ff;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 15px;
    border: 1px solid #bae7ff;
}

.worker-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
}

.worker-btn {
    width: 30px;
    height: 30px;
    background-color: #4299e1;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
}

#worker-count {
    width: 60px;
    padding: 6px;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    text-align: center;
}

.task-button {
    background-color: #3182ce; /* Blue color for web worker version */
    border: none;
    color: white;
    padding: 10px 20px;
    text-align: center;
    font-weight: bold;
    display: inline-block;
    font-size: 16px;
    margin-bottom: 15px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.task-button:hover {
    background-color: #2c5282;
}

.test-button {
    background-color: #4299e1;
    border: none;
    color: white;
    padding: 8px 15px;
    text-align: center;
    display: inline-block;
    font-size: 14px;
    margin-right: 10px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.test-button:hover {
    background-color: #3182ce;
}

p {
    color: black;
    font-size: 16px;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
}

.counter-box {
    background-color: #edf2f7;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
}

.counter-value {
    font-size: 24px;
    font-weight: bold;
    color: #2b6cb0;
}

.counter-note {
    font-size: 14px;
    color: #718096;
    font-style: italic;
    margin-top: 5px;
}

.animation-container {
    height: 40px;
    background-color: #f0fff4;
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;
    border: 1px solid #c6f6d5;
}

.moving-object {
    width: 40px;
    height: 30px;
    background-color: #38a169;
    position: absolute;
    top: 5px;
    border-radius: 20px;
    transition: left 0.1s linear;
}

.interaction-test {
    background-color: #ebf8ff;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #bee3f8;
}
</style>
