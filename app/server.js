const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const cors = require('cors');
const path = require('path');
const { promises: fs } = require('fs');
const mysql = require('mysql2/promise');

const app = express();

// IMPORTANT: Use process.env.PORT for Elastic Beanstalk
const port = process.env.PORT || 8080;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USERNAME || 'admin',
  password: process.env.DB_PASSWORD || 'TempPassword123!',
  database: process.env.DB_NAME || 'securityreviewdb',
  connectionLimit: 10,
  acquireTimeout: 30000,
  timeout: 30000,
  reconnect: true,
  charset: 'utf8mb4'
};

// Database connection pool
let dbPool = null;

// Initialize database connection and create table if needed
async function initializeDatabase() {
  try {
    console.log('🔗 Connecting to MySQL database...');
    console.log(`📍 Host: ${dbConfig.host}`);
    console.log(`📍 Database: ${dbConfig.database}`);
    
    dbPool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await dbPool.getConnection();
    console.log('✅ Database connection established');
    
    // Create OCR logs table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ocr_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_name VARCHAR(255) NOT NULL,
        extracted_text LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_size INT,
        mime_type VARCHAR(100),
        processing_time_ms FLOAT,
        INDEX idx_created_at (created_at),
        INDEX idx_image_name (image_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ OCR logs table created/verified');
    
    connection.release();
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('🔧 Running without database logging...');
    // Clear the pool if connection failed
    if (dbPool) {
      try {
        await dbPool.end();
      } catch (e) {
        // Ignore cleanup errors
      }
      dbPool = null;
    }
  }
}

// Function to log OCR request to database
async function logOCRRequest(imageName, extractedText, fileSize, mimeType, processingTime) {
  if (!dbPool) {
    console.warn('⚠️ No database connection - skipping log');
    return;
  }

  try {
    const query = `
      INSERT INTO ocr_logs (image_name, extracted_text, file_size, mime_type, processing_time_ms)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await dbPool.execute(query, [
      imageName,
      extractedText,
      fileSize,
      mimeType,
      processingTime
    ]);
    
    console.log(`📝 OCR request logged: ${imageName}`);
  } catch (error) {
    console.error('❌ Failed to log OCR request:', error.message);
  }
}

// Initialize database on startup
initializeDatabase();

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
app.get('/', (req, res) => {
  res.json({
    message: 'AWS Beanstalk OCR API is running!',
    version: '2.0.0',
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    testPage: '/static/index.html',
    database: {
      connected: dbPool !== null,
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'securityreviewdb'
    },
    endpoints: {
      'GET /': 'API status',
      'GET /health': 'Health check',
      'GET /api': 'API documentation',
      'POST /ocr': 'OCR processing',
      'GET /logs': 'View OCR logs',
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

// OCR endpoint
app.post('/ocr', upload.single('image'), async (req, res) => {
  const startTime = performance.now();
  
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

    const processingTime = performance.now() - startTime;
    const extractedText = text.trim();

    // Log OCR request to database
    await logOCRRequest(
      req.file.originalname,
      extractedText,
      req.file.size,
      req.file.mimetype,
      processingTime
    );

    // Clean up the uploaded file using promises
    await fs.unlink(req.file.path).catch(err => 
      console.error('File cleanup error:', err)
    );

    res.json({
      success: true,
      filename: req.file.originalname,
      extractedText,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      processingTimeMs: Math.round(processingTime),
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

  } catch (error) {
    console.error(`OCR Error for ${req.file?.originalname || 'unknown file'}:`, error.message);
    console.error('Full error:', error);
    
    // Clean up file if it exists using promises
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
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
    version: '2.0.0',
    nodeVersion: process.version,
    endpoints: {
      'GET /': 'API status and info',
      'GET /health': 'Health check',
      'GET /api': 'API documentation',
      'POST /ocr': 'Upload image for OCR processing (multipart/form-data with "image" field)',
      'GET /logs': 'View recent OCR processing logs'
    },
    usage: {
      ocr: {
        method: 'POST',
        url: '/ocr',
        contentType: 'multipart/form-data',
        body: 'image file in "image" field',
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp']
      }
    },
    database: {
      connected: dbPool !== null,
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'securityreviewdb'
    }
  });
});

// OCR logs endpoint
app.get('/logs', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({
      error: 'Database not available',
      message: 'Database logging is not enabled'
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Default 10, max 50
    
    // Simple query without parameterization to avoid MySQL issues
    const query = `
      SELECT 
        id,
        image_name,
        LEFT(extracted_text, 200) as extracted_text_preview,
        CHAR_LENGTH(extracted_text) as text_length,
        created_at,
        file_size,
        mime_type,
        processing_time_ms
      FROM ocr_logs 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
    
    const [rows] = await dbPool.execute(query);
    
    // Get total count with a simple query
    const [countResult] = await dbPool.execute('SELECT COUNT(*) as total FROM ocr_logs');
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: rows,
      total,
      limit,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to fetch OCR logs:', error);
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

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
    availableRoutes: ['/', '/health', '/api', 'POST /ocr', '/logs']
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
  console.log('   GET  /api - API documentation');
  console.log('   POST /ocr - OCR processing');
});

// Graceful shutdown handling (Node.js best practices)
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  // Close database pool
  if (dbPool) {
    try {
      await dbPool.end();
      console.log('✅ Database pool closed');
    } catch (err) {
      console.error('❌ Error closing database pool:', err);
    }
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
  
  // Close database pool
  if (dbPool) {
    try {
      await dbPool.end();
      console.log('✅ Database pool closed');
    } catch (err) {
      console.error('❌ Error closing database pool:', err);
    }
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
