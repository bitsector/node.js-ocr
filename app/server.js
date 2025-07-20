const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const cors = require('cors');
const path = require('path');

const app = express();

// IMPORTANT: Use process.env.PORT for Elastic Beanstalk
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for test page)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images - be very permissive for testing
    console.log(`📁 File upload: ${file.originalname}`);
    console.log(`📋 MIME type: "${file.mimetype}"`);
    console.log(`📊 Field name: "${file.fieldname}"`);
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    // Check MIME type OR file extension (be permissive)
    const isMimeTypeOk = file.mimetype && (
      file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/octet-stream' // Sometimes WebP shows as this
    );
    const isExtensionOk = allowedExtensions.includes(fileExtension);
    
    console.log(`🔍 Extension: "${fileExtension}" (allowed: ${isExtensionOk})`);
    console.log(`🔍 MIME check: ${isMimeTypeOk}`);
    
    if (isMimeTypeOk || isExtensionOk) {
      console.log(`✅ ACCEPTED: ${file.originalname}`);
      cb(null, true);
    } else {
      console.log(`❌ REJECTED: ${file.originalname}`);
      console.log(`   MIME: "${file.mimetype}", Extension: "${fileExtension}"`);
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Health check endpoint for Beanstalk
app.get('/', (req, res) => {
  res.json({
    message: 'AWS Beanstalk OCR API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    testPage: '/static/index.html',
    endpoints: {
      'GET /': 'API status',
      'GET /health': 'Health check',
      'GET /api': 'API documentation',
      'POST /ocr': 'OCR processing',
      'GET /static/index.html': 'Test page'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// OCR endpoint
app.post('/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file uploaded',
        message: 'Please upload an image file'
      });
    }

    console.log(`Processing OCR for file: ${req.file.originalname} (${req.file.mimetype})`);
    
    // Perform OCR using Tesseract.js
    const { data: { text } } = await Tesseract.recognize(
      req.file.path,
      'eng',
      {
        logger: m => {
          // Only log progress, not all the verbose messages
          if (m.status && (m.status.includes('recognizing') || m.status.includes('loading'))) {
            console.log(`${req.file.originalname}: ${m.status} - ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    // Clean up the uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      extractedText: text.trim(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`OCR Error for ${req.file?.originalname || 'unknown file'}:`, error.message);
    console.error('Full error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        console.log(`Cleaned up file: ${req.file.path}`);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'OCR processing failed',
      message: error.message,
      filename: req.file?.originalname || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AWS Beanstalk OCR API',
    version: '1.0.0',
    endpoints: {
      'GET /': 'API status and info',
      'GET /health': 'Health check',
      'GET /api': 'API documentation',
      'POST /ocr': 'Upload image for OCR processing (multipart/form-data with "image" field)'
    },
    usage: {
      ocr: {
        method: 'POST',
        url: '/ocr',
        contentType: 'multipart/form-data',
        body: 'image file in "image" field',
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff']
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 10MB'
      });
    }
  }
  
  console.error('Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: ['/', '/health', '/api', 'POST /ocr']
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 OCR API Server running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🔗 Available endpoints:`);
  console.log(`   GET  / - API info`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /api - API documentation`);
  console.log(`   POST /ocr - OCR processing`);
});

module.exports = app;
