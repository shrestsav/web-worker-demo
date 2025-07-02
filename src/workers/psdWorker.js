import PSD from 'psd.js'

// Process PSD file
async function processPsdFile(fileBuffer, fileName, fileSize) {
  try {
    // Convert ArrayBuffer to File object for PSD.js
    const file = new File([fileBuffer], fileName, { type: 'image/vnd.adobe.photoshop' })
    
    // Parse the PSD file using fromDroppedFile which accepts File objects
    const psd = await PSD.fromDroppedFile(file)
    
    // Get the PSD dimensions
    const width = psd.header.width
    const height = psd.header.height
    
    // Create thumbnails directly in the worker
    const { originalThumbnail, resizedThumbnail } = await createThumbnails(psd.image.pixelData, width, height)
    
    return {
      success: true,
      name: fileName,
      width,
      height,
      originalThumbnail, // Send processed original thumbnail
      resizedThumbnail, // Send processed resized thumbnail
      fileSize: (fileSize / (1024 * 1024)).toFixed(2) + ' MB'
    }
  } catch (err) {
    console.error(`Error processing ${fileName}:`, err)
    return {
      success: false,
      name: fileName,
      error: true,
      errorMessage: 'Could not read preview – was the file saved with "Maximise Compatibility"?'
    }
  }
}

/**
 * Creates thumbnails from pixel data in the worker thread
 * @param {Uint8Array} pixelData - Raw pixel data from PSD
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Original and resized thumbnails
 */
async function createThumbnails(pixelData, width, height) {
  // Create a canvas to render the PSD data
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Create ImageData from the pixel data
  const imageData = new ImageData(
    new Uint8ClampedArray(pixelData),
    width,
    height
  )

  // Put the image data on the canvas
  ctx.putImageData(imageData, 0, 0)
  
  // Create original size thumbnail
  const originalThumbnail = await createThumbnailFromCanvas(canvas, width, height, true)
  
  // Create resized thumbnail
  const resizedThumbnail = await createThumbnailFromCanvas(canvas, width, height, false)
  
  return {
    originalThumbnail,
    resizedThumbnail
  }
}

/**
 * Creates a thumbnail from a canvas
 * @param {OffscreenCanvas} sourceCanvas - Source canvas with image data
 * @param {number} originalWidth - Original width
 * @param {number} originalHeight - Original height
 * @param {boolean} isFullSize - Whether to keep original dimensions or resize
 * @returns {Object} Thumbnail data
 */
async function createThumbnailFromCanvas(sourceCanvas, originalWidth, originalHeight, isFullSize = false) {
  // Calculate dimensions
  const { width, height } = isFullSize 
    ? { width: originalWidth, height: originalHeight }
    : resizeImage(originalWidth, originalHeight)
  
  // Create a new canvas for the thumbnail
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  
  // Draw the image at the new size
  ctx.drawImage(sourceCanvas, 0, 0, width, height)
  
  // Convert to blob and then to base64
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const imageSrc = await blobToDataURL(blob)
  
  return {
    src: imageSrc,
    width,
    height,
    originalWidth,
    originalHeight
  }
}

/**
 * Resizes an image while maintaining aspect ratio
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @returns {Object} New dimensions
 */
function resizeImage(width, height) {
  const maxWidth = 500
  const maxHeight = 500
  if (width <= maxWidth && height <= maxHeight) return { width, height }
  const aspectRatio = width / height
  return aspectRatio > 1
    ? { width: maxWidth, height: Math.round(maxWidth / aspectRatio) }
    : { width: Math.round(maxHeight * aspectRatio), height: maxHeight }
}

/**
 * Converts a Blob to a data URL
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Data URL
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'))
    reader.readAsDataURL(blob)
  })
}

// Handle messages from the main thread
self.onmessage = async (event) => {
  const { type, data } = event.data
  
  if (type === 'process_psd') {
    const { fileBuffer, fileName, fileSize, id } = data
    let localFileBuffer = fileBuffer; // Store reference to allow cleanup
    
    try {
      // Process the file
      const result = await processPsdFile(localFileBuffer, fileName, fileSize)
      
      // Send result back to main thread
      self.postMessage({
        type: 'process_complete',
        data: {
          ...result,
          id
        }
      })
    } catch (error) {
      self.postMessage({
        type: 'process_error',
        data: {
          id,
          name: fileName,
          error: true,
          errorMessage: error.message || 'Unknown error processing PSD file'
        }
      })
    } finally {
      // Perform memory cleanup
      cleanupMemory();
      
      // Explicitly clear references to large objects
      localFileBuffer = null;
    }
  } else if (type === 'cleanup') {
    // Explicit cleanup request from main thread
    cleanupMemory();
    self.postMessage({ type: 'cleanup_complete' });
  }
}

/**
 * Performs memory cleanup operations
 */
function cleanupMemory() {
  // Force garbage collection if possible
  if (typeof globalThis.gc === 'function') {
    try {
      globalThis.gc();
      console.log('Garbage collection performed');
    } catch (e) {
      console.warn('Failed to force garbage collection', e);
    }
  }
  
  // Clear any module-level caches or references that might hold memory
  // This depends on your specific implementation
}
