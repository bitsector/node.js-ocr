const { ocr } = require('../services/ocrService');

/**
 * OCR API Handler - handles OCR endpoint HTTP requests
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function ocrHandler(req, res) {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file uploaded',
        message: 'Please upload an image file'
      });
    }

    // Call service layer for OCR processing
    const result = await ocr(req.file);
    
    // Return success response
    res.json(result);

  } catch (error) {
    // Handle service layer errors and return appropriate HTTP response
    console.error('OCR API Error:', error.message);
    
    res.status(500).json({
      error: 'OCR processing failed',
      message: error.message,
      filename: req.file?.originalname || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  ocrHandler
};
