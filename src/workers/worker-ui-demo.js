// worker.js  (ES module)
// Runs on a separate thread with no DOM access
self.onmessage = ({ data }) => {
    const { iterations } = data;
    const t0 = performance.now();

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
  
    const t1 = performance.now();
    // Send results back to the main thread
    self.postMessage({ duration: t1 - t0, result: sum });
  };