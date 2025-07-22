const { ocr } = require('../services/ocrService');
const { logger } = require('../utils/logger');
const { validateFile } = require('../utils/fileValidation');
const { FileValidationError, wrapError } = require('../utils/errors');

/**
 * OCR API Handler - handles OCR endpoint HTTP requests with comprehensive validation
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function ocrHandler(req, res, next) {
  const requestLogger = logger.child({ 
    requestId: req.requestId,
    endpoint: 'POST /ocr'
  });
  
  try {
    // 1. Validate file upload
    if (!req.file) {
      requestLogger.warn('OCR request failed: No file uploaded');
      throw new FileValidationError('No image file uploaded', { 
        message: 'Please upload an image file using the "image" field' 
      });
    }
    
    requestLogger.info('Processing OCR request', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    // 2. Comprehensive file validation
    const validationResult = await validateFile(req.file);
    
    if (!validationResult.valid) {
      requestLogger.warn('File validation failed', {
        filename: req.file.originalname,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      
      throw new FileValidationError(
        `File validation failed: ${validationResult.errors.join(', ')}`,
        {
          filename: req.file.originalname,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          details: validationResult.details
        }
      );
    }
    
    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      requestLogger.warn('File validation warnings', {
        filename: req.file.originalname,
        warnings: validationResult.warnings
      });
    }
    
    requestLogger.debug('File validation passed', {
      filename: req.file.originalname,
      summary: validationResult.summary
    });

    // 3. Call service layer for OCR processing
    const result = await ocr(req.file, requestLogger);
    
    // 4. Log successful completion
    requestLogger.info('OCR processing completed successfully', {
      filename: req.file.originalname,
      textLength: result.extractedText?.length || 0,
      processingTime: result.processingTimeMs,
      fromCache: result.fromCache || false
    });
    
    // 5. Return success response
    res.json(result);

  } catch (error) {
    // Wrap error if it's not already an OCR error
    const ocrError = error.name && error.statusCode ? error : wrapError(error, 'ocr_api');
    
    requestLogger.error('OCR API Error', {
      error: ocrError.message,
      filename: req.file?.originalname || 'unknown',
      statusCode: ocrError.statusCode,
      errorCode: ocrError.errorCode
    });
    
    // Pass to error handler middleware
    next(ocrError);
  }
}

module.exports = {
  ocrHandler
};
