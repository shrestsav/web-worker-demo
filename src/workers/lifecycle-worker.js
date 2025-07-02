// lifecycle-worker.js
// A simple worker that demonstrates the Web Worker lifecycle

console.log('Worker script loaded and initialized');

// Worker startup - immediately send a message to the main thread
self.postMessage({
    type: 'INIT',
    data: 'Worker initialized successfully'
});

// Listen for messages from the main thread
self.onmessage = ({ data }) => {
    console.log('Worker received message:', data);
    
    // Handle different message types
    if (data && data.type) {
        switch (data.type) {
            case 'PING':
                console.log('Processing PING message');
                // Echo back the data with a slight delay to simulate work
                setTimeout(() => {
                    self.postMessage({
                        type: 'PONG',
                        data: `Echo: ${data.data}`
                    });
                }, 500);
                break;
                
            case 'ERROR':
                // Deliberately cause an error for demonstration
                console.log('About to throw an error...');
                throw new Error('This is a deliberately triggered worker error');
                
            default:
                // Handle unknown message types
                self.postMessage({
                    type: 'UNKNOWN_COMMAND',
                    data: `Received unknown command: ${data.type}`
                });
                break;
        }
    } else {
        // Handle malformed messages
        self.postMessage({
            type: 'ERROR',
            data: 'Received malformed message without type'
        });
    }
};

// Listen for error events
self.addEventListener('error', (error) => {
    console.error('Worker error event:', error.message);
    // We can't recover from errors, but we can log them
});

// Cleanup function example - would be called before termination
// but there's no direct "onbeforeterminate" event in Web Workers
function cleanup() {
    console.log('Worker cleanup running...');
    // In a real app, this might release resources or save state
}

// Note: There's no direct event for worker termination
// When the main thread calls worker.terminate(), the worker
// is immediately stopped with no chance to run cleanup code.

console.log('Worker setup complete and ready to receive messages');
