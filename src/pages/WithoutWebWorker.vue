<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const status = ref('Idle');
const counter = ref(0);
const counterRunning = ref(true);
const imagePosition = ref(0);
const direction = ref(1);
let counterInterval;
let animationInterval;

// Start a counter that updates every 100ms to show UI responsiveness
onMounted(() => {
  startCounter();
  startAnimation();
});

onUnmounted(() => {
  stopCounter();
  stopAnimation();
});

function startCounter() {
  counterRunning.value = true;
  counterInterval = setInterval(() => {
    if (counterRunning.value) {
      counter.value++;
    }
  }, 100);
}

function stopCounter() {
  clearInterval(counterInterval);
}

function startAnimation() {
  animationInterval = setInterval(() => {
    if (counterRunning.value) {
      // Move the image back and forth
      imagePosition.value += direction.value * 2;
      if (imagePosition.value > 100) {
        direction.value = -1;
      } else if (imagePosition.value < 0) {
        direction.value = 1;
      }
    }
  }, 50);
}

function stopAnimation() {
  clearInterval(animationInterval);
}

// CPU-intensive loop (synthetic workload)
function heavyCompute(iterations = 5e9) {
  // Add Fibonacci calculation to make it even heavier
  const fibonacci = (n) => {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  };
  
  let sum = 0;
  // First do heavy calculations with sqrt
  for (let i = 0; i < iterations; i++) {
    sum += Math.sqrt(i);
    
    // Every 10 million iterations, do some Fibonacci calculations
    if (i % 10000000 === 0) {
      sum += fibonacci(20); // This is computationally expensive
    }
  }
  return sum;
}

function startTask() {
  status.value = 'Working… (UI frozen - notice the counter and animation stopped)';
  const t0 = performance.now();

  // This will block the main thread completely
  const result = heavyCompute();  

  const t1 = performance.now();
  status.value = `Done in ${(t1 - t0).toFixed(0)} ms. Result: ${result.toFixed(2)}`;
}
</script>

<template>
  <div class="without-worker-demo">
    <h1>No-worker demo</h1>
    
    <div class="demo-container">
      <div class="task-section">
        <h3>Heavy Task Section</h3>
        <button @click="startTask" class="task-button">Start Heavy Computation</button>
        <p style="color: black;">{{ status }}</p>
      </div>

      <div class="interactive-section">
        <h3>UI Responsiveness Test</h3>
        
        <div class="counter-box">
          <p>Real-time counter: <span class="counter-value">{{ counter }}</span></p>
          <p class="counter-note">This counter updates every 100ms if the UI is responsive</p>
        </div>
        
        <div class="animation-container">
          <div class="moving-object" :style="{left: imagePosition + 'px'}"></div>
        </div>
        
        <div class="interaction-test">
          <p>Try interacting with these buttons during computation:</p>
          <button class="test-button" @click="counter += 10">+10 to counter</button>
          <button class="test-button" @click="counter = 0">Reset counter</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.without-worker-demo {
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

.demo-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.task-section, .interactive-section {
  padding: 20px;
  background-color: white;
}

.task-section {
  background-color: #f8f9fa;
  border-bottom: 1px solid #e2e8f0;
}

.task-button {
  background-color: #e53e3e; /* Red color for danger/caution */
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
  background-color: #c53030;
}

.test-button {
  background-color: #4299e1; /* Blue */
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