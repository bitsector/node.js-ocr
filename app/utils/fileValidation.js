const path = require('path');
const crypto = require('crypto');

/**
 * File Validation Utility
 * Provides comprehensive file validation for uploaded files
 */

// Allowed file extensions and their corresponding MIME types
const ALLOWED_FILE_TYPES = {
  // Common image formats
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.bmp': ['image/bmp', 'image/x-ms-bmp'],
  '.tiff': ['image/tiff', 'image/x-tiff'],
  '.tif': ['image/tiff', 'image/x-tiff'],
  '.webp': ['image/webp', 'application/octet-stream'], // WebP sometimes shows as octet-stream
  '.svg': ['image/svg+xml'],
  '.ico': ['image/x-icon', 'image/vnd.microsoft.icon']
};

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  MIN_SIZE: 100, // 100 bytes minimum
  MAX_SIZE: 10 * 1024 * 1024, // 10MB maximum
  RECOMMENDED_MAX: 5 * 1024 * 1024 // 5MB recommended for better performance
};

// Security patterns to check for malicious files
const SECURITY_PATTERNS = [
  // Executable file headers (magic bytes)
  Buffer.from([0x4D, 0x5A]), // MZ (Windows PE)
  Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF (Linux executable)
  Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Mach-O (macOS executable)
  Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O (macOS executable)
  
  // Script patterns in files
  Buffer.from('#!/bin/'),
  Buffer.from('<?php'),
  Buffer.from('<script'),
  Buffer.from('javascript:'),
];

/**
 * Validate file extension against allowed types
 * @param {string} filename - Original filename
 * @returns {Object} Validation result
 */
function validateFileExtension(filename) {
  try {
    const ext = path.extname(filename).toLowerCase();
    const isAllowed = Object.keys(ALLOWED_FILE_TYPES).includes(ext);
    
    return {
      valid: isAllowed,
      extension: ext,
      allowedMimeTypes: isAllowed ? ALLOWED_FILE_TYPES[ext] : [],
      error: isAllowed ? null : `File extension "${ext}" is not allowed. Allowed: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`
    };
  } catch (error) {
    return {
      valid: false,
      extension: null,
      allowedMimeTypes: [],
      error: `Error validating file extension: ${error.message}`
    };
  }
}

/**
 * Validate MIME type against allowed types for the file extension
 * @param {string} mimeType - File MIME type from multer
 * @param {string} filename - Original filename
 * @returns {Object} Validation result
 */
function validateMimeType(mimeType, filename) {
  try {
    const extResult = validateFileExtension(filename);
    if (!extResult.valid) {
      return { valid: false, error: extResult.error };
    }
    
    // Check if MIME type matches allowed types for this extension
    // Be very permissive for multipart uploads as libraries like Python requests
    // often send incorrect MIME types (e.g., 'text/plain' for binary image files)
    const isValidMime = extResult.allowedMimeTypes.includes(mimeType) || 
                       mimeType.startsWith('image/') ||
                       mimeType === 'text/plain' ||  // Common for binary uploads via requests/curl
                       mimeType === 'application/octet-stream'; // Generic binary type
    
    return {
      valid: isValidMime,
      detectedMime: mimeType,
      allowedMimes: extResult.allowedMimeTypes,
      error: isValidMime ? null : `MIME type "${mimeType}" doesn't match file extension "${extResult.extension}"`
    };
  } catch (error) {
    return {
      valid: false,
      detectedMime: mimeType,
      allowedMimes: [],
      error: `Error validating MIME type: ${error.message}`
    };
  }
}

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @returns {Object} Validation result
 */
function validateFileSize(fileSize) {
  try {
    const isValid = fileSize >= FILE_SIZE_LIMITS.MIN_SIZE && fileSize <= FILE_SIZE_LIMITS.MAX_SIZE;
    const isRecommended = fileSize <= FILE_SIZE_LIMITS.RECOMMENDED_MAX;
    
    let warning = null;
    if (isValid && !isRecommended) {
      warning = `File size (${Math.round(fileSize / 1024 / 1024)}MB) is larger than recommended (${Math.round(FILE_SIZE_LIMITS.RECOMMENDED_MAX / 1024 / 1024)}MB). Processing may be slower.`;
    }
    
    return {
      valid: isValid,
      size: fileSize,
      sizeFormatted: formatFileSize(fileSize),
      warning,
      error: isValid ? null : `File size ${formatFileSize(fileSize)} is outside allowed range (${formatFileSize(FILE_SIZE_LIMITS.MIN_SIZE)} - ${formatFileSize(FILE_SIZE_LIMITS.MAX_SIZE)})`
    };
  } catch (error) {
    return {
      valid: false,
      size: fileSize,
      sizeFormatted: 'unknown',
      warning: null,
      error: `Error validating file size: ${error.message}`
    };
  }
}

/**
 * Validate file content for security threats
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} filename - Original filename
 * @returns {Object} Validation result
 */
function validateFileContent(fileBuffer, filename) {
  try {
    // Check for malicious patterns
    for (const pattern of SECURITY_PATTERNS) {
      if (fileBuffer.indexOf(pattern) !== -1) {
        return {
          valid: false,
          threat: 'executable_or_script',
          error: `File "${filename}" contains potentially malicious content (executable or script patterns detected)`
        };
      }
    }
    
    // Basic image format validation by checking magic bytes
    const magicBytes = fileBuffer.slice(0, 12);
    const ext = path.extname(filename).toLowerCase();
    
    let isValidImageFormat = false;
    
    // Check image format magic bytes
    if (ext === '.jpg' || ext === '.jpeg') {
      isValidImageFormat = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
    } else if (ext === '.png') {
      isValidImageFormat = magicBytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    } else if (ext === '.gif') {
      isValidImageFormat = magicBytes.slice(0, 6).equals(Buffer.from('GIF87a')) || 
                          magicBytes.slice(0, 6).equals(Buffer.from('GIF89a'));
    } else if (ext === '.webp') {
      isValidImageFormat = magicBytes.slice(0, 4).equals(Buffer.from('RIFF')) && 
                          magicBytes.slice(8, 12).equals(Buffer.from('WEBP'));
    } else if (ext === '.bmp') {
      isValidImageFormat = magicBytes.slice(0, 2).equals(Buffer.from('BM'));
    } else {
      // For other formats, be permissive (TIFF, SVG, etc. have complex headers)
      isValidImageFormat = true;
    }
    
    return {
      valid: isValidImageFormat,
      threat: isValidImageFormat ? null : 'invalid_format',
      error: isValidImageFormat ? null : `File "${filename}" does not appear to be a valid ${ext.toUpperCase()} image`
    };
  } catch (error) {
    return {
      valid: false,
      threat: 'validation_error',
      error: `Error validating file content: ${error.message}`
    };
  }
}

/**
 * Generate a secure hash for the file content
 * @param {Buffer} fileBuffer - File content buffer
 * @returns {string} SHA-256 hash
 */
function generateFileHash(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Comprehensive file validation
 * @param {Object} file - Multer file object
 * @param {Buffer} fileBuffer - File content buffer (optional, will read if not provided)
 * @returns {Object} Complete validation result
 */
async function validateFile(file, fileBuffer = null) {
  try {
    const results = {
      valid: true,
      filename: file.originalname,
      warnings: [],
      errors: [],
      details: {}
    };
    
    // 1. Validate file extension
    const extResult = validateFileExtension(file.originalname);
    results.details.extension = extResult;
    if (!extResult.valid) {
      results.valid = false;
      results.errors.push(extResult.error);
    }
    
    // 2. Validate MIME type
    const mimeResult = validateMimeType(file.mimetype, file.originalname);
    results.details.mimeType = mimeResult;
    if (!mimeResult.valid) {
      results.valid = false;
      results.errors.push(mimeResult.error);
    }
    
    // 3. Validate file size
    const sizeResult = validateFileSize(file.size);
    results.details.fileSize = sizeResult;
    if (!sizeResult.valid) {
      results.valid = false;
      results.errors.push(sizeResult.error);
    } else if (sizeResult.warning) {
      results.warnings.push(sizeResult.warning);
    }
    
    // 4. Validate file content (if buffer provided or file path exists)
    if (fileBuffer || file.path) {
      let buffer = fileBuffer;
      if (!buffer) {
        const fs = require('fs').promises;
        buffer = await fs.readFile(file.path);
      }
      
      const contentResult = validateFileContent(buffer, file.originalname);
      results.details.content = contentResult;
      if (!contentResult.valid) {
        results.valid = false;
        results.errors.push(contentResult.error);
      }
      
      // Generate file hash for duplicate detection
      results.details.fileHash = generateFileHash(buffer);
    }
    
    // 5. Generate summary
    results.summary = {
      totalErrors: results.errors.length,
      totalWarnings: results.warnings.length,
      fileSize: formatFileSize(file.size),
      extension: path.extname(file.originalname).toLowerCase(),
      mimeType: file.mimetype,
      safe: results.valid && results.errors.length === 0
    };
    
    return results;
    
  } catch (error) {
    return {
      valid: false,
      filename: file?.originalname || 'unknown',
      warnings: [],
      errors: [`File validation failed: ${error.message}`],
      details: {},
      summary: {
        totalErrors: 1,
        totalWarnings: 0,
        safe: false,
        error: error.message
      }
    };
  }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create multer file filter using our validation
 * @returns {Function} Multer file filter function
 */
function createMulterFileFilter() {
  return (req, file, cb) => {
    console.log(`📁 File upload: ${file.originalname}`);
    console.log(`📋 MIME type: "${file.mimetype}"`);
    console.log(`📊 Field name: "${file.fieldname}"`);
    
    // Quick validation for multer (full validation happens later)
    const extResult = validateFileExtension(file.originalname);
    const mimeResult = validateMimeType(file.mimetype, file.originalname);
    
    if (extResult.valid && mimeResult.valid) {
      console.log(`✅ ACCEPTED: ${file.originalname}`);
      cb(null, true);
    } else {
      console.log(`❌ REJECTED: ${file.originalname}`);
      console.log(`   Extension check: ${extResult.valid ? 'PASS' : 'FAIL'} - ${extResult.error || 'OK'}`);
      console.log(`   MIME check: ${mimeResult.valid ? 'PASS' : 'FAIL'} - ${mimeResult.error || 'OK'}`);
      cb(new Error('File validation failed: ' + (extResult.error || mimeResult.error)), false);
    }
  };
}

module.exports = {
  validateFile,
  validateFileExtension,
  validateMimeType,
  validateFileSize,
  validateFileContent,
  generateFileHash,
  formatFileSize,
  createMulterFileFilter,
  FILE_SIZE_LIMITS,
  ALLOWED_FILE_TYPES
};
