const Tesseract = require('tesseract.js');
const path = require('path');
const { promises: fs } = require('fs');
const { write_ocr } = require('../db/database');

/**
 * OCR Service - handles OCR processing and related business logic
 * @param {object} file - Multer file object
 * @returns {object} OCR processing result
 */
async function ocr(file) {
  const startTime = performance.now();
  
  try {
    console.log(`Processing OCR for file: ${file.originalname} (${file.mimetype})`);
    
    // Perform OCR using Tesseract.js with local traineddata
    const { data: { text } } = await Tesseract.recognize(
      file.path,
      'eng',
      {
        langPath: path.join(__dirname, '..'),  // Use local eng.traineddata file
        gzip: false,  // Don't expect compressed files
        logger: m => {
          // Only log progress, not all the verbose messages
          if (m.status && (m.status.includes('recognizing') || m.status.includes('loading'))) {
            console.log(`${file.originalname}: ${m.status} - ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    const processingTime = performance.now() - startTime;
    const extractedText = text.trim();

    // Log OCR request to database (async operation)
    await write_ocr(
      file.originalname,
      extractedText,
      file.size,
      file.mimetype,
      processingTime
    );

    // Clean up the uploaded file
    await fs.unlink(file.path).catch(err => 
      console.error('File cleanup error:', err)
    );

    // Return OCR processing result
    return {
      success: true,
      filename: file.originalname,
      extractedText,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      processingTimeMs: Math.round(processingTime),
      fileSize: file.size,
      mimeType: file.mimetype
    };

  } catch (error) {
    console.error(`OCR Error for ${file?.originalname || 'unknown file'}:`, error.message);
    console.error('Full error:', error);
    
    // Clean up file if it exists
    if (file?.path) {
      try {
        await fs.unlink(file.path);
        console.log(`Cleaned up file: ${file.path}`);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    // Re-throw the error to be handled by the API layer
    throw error;
  }
}

/**
 * Logs Service - handles logs retrieval business logic
 * @param {number} limit - Maximum number of logs to retrieve
 * @returns {object} Logs data with metadata
 */
async function logs(limit = 10) {
  const { get_logs } = require('../db/database');
  
  try {
    // Call database layer to get logs
    const result = await get_logs(limit);
    
    return {
      success: true,
      data: result.logs,
      total: result.total,
      limit: result.limit,
      timestamp: result.timestamp
    };
    
  } catch (error) {
    console.error('Service layer error fetching logs:', error.message);
    throw error;
  }
}

module.exports = {
  ocr,
  logs
};
