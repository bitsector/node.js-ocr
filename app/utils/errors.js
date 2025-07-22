/**
 * Custom Error Classes for OCR API
 * Provides specific error types for better error handling and debugging
 */

/**
 * Base error class for all OCR API errors
 */
class OCRError extends Error {
  constructor(message, statusCode = 500, errorCode = 'OCR_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where error was thrown (Node.js specific)
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.errorCode,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    };
  }
}

/**
 * File validation errors
 */
class FileValidationError extends OCRError {
  constructor(message, details = {}) {
    super(message, 400, 'FILE_VALIDATION_ERROR');
    this.details = details;
    this.category = 'validation';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
      category: this.category
    };
  }
}

/**
 * File processing errors (upload, storage, etc.)
 */
class FileProcessingError extends OCRError {
  constructor(message, operation = 'unknown') {
    super(message, 500, 'FILE_PROCESSING_ERROR');
    this.operation = operation;
    this.category = 'processing';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      category: this.category
    };
  }
}

/**
 * OCR processing specific errors
 */
class TesseractError extends OCRError {
  constructor(message, stage = 'recognition') {
    super(message, 500, 'TESSERACT_ERROR');
    this.stage = stage; // 'initialization', 'loading', 'recognition', 'cleanup'
    this.category = 'ocr';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      stage: this.stage,
      category: this.category
    };
  }
}

/**
 * Database operation errors
 */
class DatabaseError extends OCRError {
  constructor(message, operation = 'unknown', isConnectionError = false) {
    super(
      message, 
      isConnectionError ? 503 : 500, 
      isConnectionError ? 'DATABASE_CONNECTION_ERROR' : 'DATABASE_ERROR'
    );
    this.operation = operation;
    this.isConnectionError = isConnectionError;
    this.category = 'database';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      isConnectionError: this.isConnectionError,
      category: this.category
    };
  }
}

/**
 * Cache operation errors
 */
class CacheError extends OCRError {
  constructor(message, operation = 'unknown', backend = 'unknown') {
    super(message, 500, 'CACHE_ERROR');
    this.operation = operation; // 'get', 'set', 'connection', 'lookup'
    this.backend = backend; // 'local', 'aws', 'redis'
    this.category = 'cache';
    // Cache errors are non-critical - they don't break the main flow
    this.critical = false;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      backend: this.backend,
      critical: this.critical,
      category: this.category
    };
  }
}

/**
 * Configuration or environment errors
 */
class ConfigurationError extends OCRError {
  constructor(message, configKey = null) {
    super(message, 500, 'CONFIGURATION_ERROR');
    this.configKey = configKey;
    this.category = 'configuration';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      configKey: this.configKey,
      category: this.category
    };
  }
}

/**
 * Rate limiting errors
 */
class RateLimitError extends OCRError {
  constructor(message, retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter; // seconds
    this.category = 'rate_limit';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
      category: this.category
    };
  }
}

/**
 * Authentication/Authorization errors
 */
class AuthenticationError extends OCRError {
  constructor(message, authType = 'unknown') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.authType = authType; // 'token', 'api_key', 'session', etc.
    this.category = 'authentication';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      authType: this.authType,
      category: this.category
    };
  }
}

/**
 * Timeout errors
 */
class TimeoutError extends OCRError {
  constructor(message, operation = 'unknown', timeoutMs = 0) {
    super(message, 408, 'TIMEOUT_ERROR');
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    this.category = 'timeout';
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      timeoutMs: this.timeoutMs,
      category: this.category
    };
  }
}

/**
 * Utility function to determine if an error is an OCR API error
 * @param {Error} error - Error to check
 * @returns {boolean} True if it's an OCR API error
 */
function isOCRError(error) {
  return error instanceof OCRError;
}

/**
 * Utility function to wrap generic errors in OCR error format
 * @param {Error} error - Original error
 * @param {string} context - Context where the error occurred
 * @returns {OCRError} Wrapped error
 */
function wrapError(error, context = 'unknown') {
  if (isOCRError(error)) {
    return error;
  }
  
  // Determine error type based on message content or context
  if (error.message?.includes('timeout') || context.includes('timeout')) {
    return new TimeoutError(`Timeout in ${context}: ${error.message}`, context);
  }
  
  if (error.message?.includes('database') || error.code?.startsWith('ER_') || context.includes('database')) {
    const isConnection = error.code === 'ECONNREFUSED' || error.message?.includes('connection');
    return new DatabaseError(`Database error in ${context}: ${error.message}`, context, isConnection);
  }
  
  if (error.message?.includes('redis') || error.message?.includes('cache') || context.includes('cache')) {
    return new CacheError(`Cache error in ${context}: ${error.message}`, context);
  }
  
  if (error.message?.includes('file') || error.message?.includes('upload') || context.includes('file')) {
    return new FileProcessingError(`File error in ${context}: ${error.message}`, context);
  }
  
  if (error.message?.includes('tesseract') || context.includes('ocr')) {
    return new TesseractError(`OCR error in ${context}: ${error.message}`, context);
  }
  
  // Generic OCR error for everything else
  return new OCRError(`Error in ${context}: ${error.message}`, 500, 'GENERIC_ERROR');
}

/**
 * Create an error response object suitable for Express.js responses
 * @param {Error} error - Error to convert
 * @param {boolean} includeStack - Whether to include stack trace (development only)
 * @returns {Object} Error response object
 */
function createErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    ...error.toJSON?.() || {
      error: error.name || 'Error',
      message: error.message,
      statusCode: error.statusCode || 500,
      timestamp: new Date().toISOString()
    }
  };
  
  if (includeStack && error.stack) {
    response.stack = error.stack;
  }
  
  return response;
}

/**
 * Express error handler middleware for OCR API errors
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, _next) {
  // Convert to OCR error if it's not already
  const ocrError = isOCRError(err) ? err : wrapError(err, req.path);
  
  // Log error (with different levels based on severity)
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevel = ocrError.statusCode >= 500 ? 'ERROR' : 'WARN';
  
  console.log(`[${logLevel}] ${ocrError.name}: ${ocrError.message}`);
  console.log(`  Path: ${req.method} ${req.path}`);
  console.log(`  Status: ${ocrError.statusCode}`);
  console.log(`  Category: ${ocrError.category || 'unknown'}`);
  
  if (isDevelopment && ocrError.statusCode >= 500) {
    console.log(`  Stack: ${ocrError.stack}`);
  }
  
  // Send error response
  const response = createErrorResponse(ocrError, isDevelopment);
  res.status(ocrError.statusCode).json(response);
}

module.exports = {
  // Error classes
  OCRError,
  FileValidationError,
  FileProcessingError,
  TesseractError,
  DatabaseError,
  CacheError,
  ConfigurationError,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  
  // Utility functions
  isOCRError,
  wrapError,
  createErrorResponse,
  errorHandler
};
