const mysql = require('mysql2/promise');

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

// DB Layer Functions

/**
 * Write OCR processing result to database
 * @param {string} imageName - Name of the processed image
 * @param {string} extractedText - OCR extracted text
 * @param {number} fileSize - File size in bytes
 * @param {string} mimeType - MIME type of the file
 * @param {number} processingTime - Processing time in milliseconds
 */
async function write_ocr(imageName, extractedText, fileSize, mimeType, processingTime) {
  if (!dbPool) {
    console.warn('⚠️ No database connection - skipping OCR log');
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
    throw error;
  }
}

/**
 * Get OCR logs from database
 * @param {number} limit - Maximum number of logs to retrieve (default 10, max 50)
 * @returns {object} Object containing logs data and metadata
 */
async function get_logs(limit = 10) {
  if (!dbPool) {
    throw new Error('Database not available');
  }

  try {
    // Ensure limit is within bounds
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    
    // Get logs with text preview
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
      LIMIT ${safeLimit}
    `;
    
    const [rows] = await dbPool.execute(query);
    
    // Get total count
    const [countResult] = await dbPool.execute('SELECT COUNT(*) as total FROM ocr_logs');
    const total = countResult[0].total;
    
    return {
      logs: rows,
      total,
      limit: safeLimit,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch OCR logs:', error.message);
    throw error;
  }
}

/**
 * Check if database is connected
 * @returns {boolean} True if database is connected
 */
function isDatabaseConnected() {
  return dbPool !== null;
}

/**
 * Get database configuration info
 * @returns {object} Database configuration summary
 */
function getDatabaseInfo() {
  return {
    connected: dbPool !== null,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'securityreviewdb'
  };
}

/**
 * Close database connection pool gracefully
 */
async function closeDatabasePool() {
  if (dbPool) {
    try {
      await dbPool.end();
      console.log('✅ Database pool closed');
      dbPool = null;
    } catch (err) {
      console.error('❌ Error closing database pool:', err);
      throw err;
    }
  }
}

module.exports = {
  initializeDatabase,
  write_ocr,
  get_logs,
  isDatabaseConnected,
  getDatabaseInfo,
  closeDatabasePool
};
