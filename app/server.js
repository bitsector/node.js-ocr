const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, getDatabaseInfo, closeDatabasePool } = require('./db/database');
const { init: initCache, getCacheStatus, closeCache } = require('./cache/cache');
const { ocrHandler } = require('./api/ocrApi');
const { logsHandler } = require('./api/logsApi');

const app = express();

// IMPORTANT: Use process.env.PORT for Elastic Beanstalk
const port = process.env.PORT || 8080;

// Initialize database and cache on startup
initializeDatabase();
initCache();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware (Node.js 22 optimized)
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration.toFixed(2)}ms)`);
  });
  next();
});

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
app.get('/', async (req, res) => {
  const cacheStatus = await getCacheStatus();
  
  res.json({
    message: 'AWS Beanstalk OCR API is running!',
    version: '2.0.0',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    testPage: '/static/index.html',
    database: getDatabaseInfo(),
    cache: {
      enabled: cacheStatus.enabled,
      backend: cacheStatus.backend || 'none',
      connected: cacheStatus.connected,
      info: cacheStatus.info
    },
    endpoints: {
      'GET /': 'API status',
      'GET /health': 'Health check',
      'POST /ocr': 'OCR processing',
      'GET /logs': 'View OCR logs (development only)',
      'GET /static/index.html': 'Test page'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// OCR endpoint - uses the new 3-layer architecture
app.post('/ocr', upload.single('image'), ocrHandler);

// OCR logs endpoint - uses the new 3-layer architecture
// TODO: SECURITY - Remove or secure this endpoint before production deployment
// This endpoint exposes internal application data and should only be used during development
// Consider: authentication, rate limiting, or complete removal for production
app.get('/logs', logsHandler);

// Error handling middleware
app.use((error, req, res, _next) => {
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
    availableRoutes: ['/', '/health', 'POST /ocr', '/logs']
  });
});

// Start server
const server = app.listen(port, () => {
  console.log('🚀 OCR API Server running on port ' + port);
  console.log('📍 Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('🔧 Node.js version: ' + process.version);
  console.log('⏰ Started at: ' + new Date().toISOString());
  console.log('🔗 Available endpoints:');
  console.log('   GET  / - API info');
  console.log('   GET  /health - Health check');
  console.log('   POST /ocr - OCR processing');
  console.log('   GET  /logs - View logs (development only)');
  console.log('   GET  /static/index.html - Test page');
});

// Graceful shutdown handling (Node.js best practices)
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  // Close cache connection
  try {
    await closeCache();
  } catch (err) {
    console.error('❌ Error closing cache connection:', err);
  }
  
  // Close database pool using the db layer function
  try {
    await closeDatabasePool();
  } catch (err) {
    console.error('❌ Error closing database pool:', err);
  }
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server close:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  
  // Close cache connection
  try {
    await closeCache();
  } catch (err) {
    console.error('❌ Error closing cache connection:', err);
  }
  
  // Close database pool using the db layer function
  try {
    await closeDatabasePool();
  } catch (err) {
    console.error('❌ Error closing database pool:', err);
  }
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server close:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

module.exports = app;
