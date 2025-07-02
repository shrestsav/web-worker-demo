// worker-ui-demo.js  (ES module)
// Runs on a separate thread with no DOM access
self.onmessage = ({ data }) => {
    // Handle both single and multi-worker modes
    const { iterations, startIndex, endIndex, workerId = 1 } = data;
    const t0 = performance.now();
    
    // Determine the iteration range
    let start, end;
    if (startIndex !== undefined && endIndex !== undefined) {
      // Multi-worker mode with specific range
      start = startIndex;
      end = endIndex;
      console.log(`Worker ${workerId} processing range ${start.toExponential()} - ${end.toExponential()}`);
    } else if (iterations !== undefined) {
      // Single-worker mode with iteration count
      start = 0;
      end = iterations - 1;
    } else {
      console.error('Worker received invalid parameters');
      return;
    }

    // Add Fibonacci calculation to make it even heavier
    const fibonacci = (n) => {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    };
  
    let sum = 0;
    // Process our assigned range of values
    for (let i = start; i <= end; i++) {
      sum += Math.sqrt(i);
      
      // Every 10 million iterations, do some Fibonacci calculations
      if (i % 10000000 === 0) {
        sum += fibonacci(20); // This is computationally expensive
      }
    }
  
    const t1 = performance.now();
    // Send results back to the main thread (with workerId if provided)
    self.postMessage({ 
      duration: t1 - t0, 
      result: sum,
      workerId: workerId
    });
  };