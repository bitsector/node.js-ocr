const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, getDatabaseInfo, closeDatabasePool } = require('./db/database');
const { init: initCache, getCacheStatus, closeCache } = require('./cache/cache');
const { ocrHandler } = require('./api/ocrApi');
const { logsHandler } = require('./api/logsApi');

// Import new utilities
const { logger, createRequestLogger } = require('./utils/logger');
const { createMulterFileFilter } = require('./utils/fileValidation');
const { errorHandler } = require('./utils/errors');

const app = express();

// IMPORTANT: Use process.env.PORT for Elastic Beanstalk
const port = process.env.PORT || 8080;

// Initialize database and cache on startup
logger.info('Starting OCR API Server initialization...');
initializeDatabase();
initCache();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (replaces the simple performance monitoring)
app.use(createRequestLogger(logger));

// Serve static files (for test page)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads with enhanced validation
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow single file upload
  },
  fileFilter: createMulterFileFilter() // Use our professional file filter
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
// ⚠️  DEVELOPMENT ENDPOINT - REMOVE IN PRODUCTION ⚠️
// This endpoint exposes internal application data and should ONLY be used during development.
// Before production deployment, you MUST either:
//   1. Remove this endpoint entirely, OR
//   2. Add proper authentication (API keys, JWT, etc.), OR  
//   3. Add rate limiting and IP whitelisting
// Current status: UNSECURED - exposes database logs to anyone
app.get('/logs', logsHandler);

// Error handling middleware - use our custom error handler
app.use(errorHandler);

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
  logger.info(`🚀 OCR API Server running on port ${port}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔧 Node.js version: ${process.version}`);
  logger.info(`⏰ Started at: ${new Date().toISOString()}`);
  logger.info('🔗 Available endpoints:', {
    endpoints: {
      'GET /': 'API info',
      'GET /health': 'Health check', 
      'POST /ocr': 'OCR processing',
      'GET /logs': 'View logs (development only)',
      'GET /static/index.html': 'Test page'
    }
  });
});

// Graceful shutdown handling (Node.js best practices)
process.on('SIGTERM', async () => {
  logger.warn('🛑 SIGTERM received, shutting down gracefully');
  
  // Close cache connection
  try {
    await closeCache();
  } catch (err) {
    logger.error('❌ Error closing cache connection:', { error: err.message });
  }
  
  // Close database pool using the db layer function
  try {
    await closeDatabasePool();
  } catch (err) {
    logger.error('❌ Error closing database pool:', { error: err.message });
  }
  
  server.close((err) => {
    if (err) {
      logger.error('❌ Error during server close:', { error: err.message });
      process.exit(1);
    }
    logger.info('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.warn('🛑 SIGINT received, shutting down gracefully');
  
  // Close cache connection
  try {
    await closeCache();
  } catch (err) {
    logger.error('❌ Error closing cache connection:', { error: err.message });
  }
  
  // Close database pool using the db layer function
  try {
    await closeDatabasePool();
  } catch (err) {
    logger.error('❌ Error closing database pool:', { error: err.message });
  }
  
  server.close((err) => {
    if (err) {
      logger.error('❌ Error during server close:', { error: err.message });
      process.exit(1);
    }
    logger.info('✅ Server closed successfully');
    process.exit(0);
  });
});

module.exports = app;
