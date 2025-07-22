/**
 * Professional Logging Module for OCR API
 * Provides structured, configurable logging with different levels and outputs
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Log levels with their numeric values (lower = higher priority)
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  HTTP: 3,
  VERBOSE: 4,
  DEBUG: 5,
  SILLY: 6
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  ERROR: '\x1b[31m',   // Red
  WARN: '\x1b[33m',    // Yellow
  INFO: '\x1b[36m',    // Cyan
  HTTP: '\x1b[35m',    // Magenta
  VERBOSE: '\x1b[34m', // Blue
  DEBUG: '\x1b[37m',   // White
  SILLY: '\x1b[90m',   // Gray
  RESET: '\x1b[0m'     // Reset
};

/**
 * Emoji indicators for different log levels
 */
const EMOJIS = {
  ERROR: '❌',
  WARN: '⚠️',
  INFO: '📍',
  HTTP: '🌐',
  VERBOSE: '📝',
  DEBUG: '🐛',
  SILLY: '💭'
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'INFO';
    this.enableConsole = options.console !== false;
    this.enableFile = options.file !== false;
    this.enableColors = options.colors !== false && process.stdout.isTTY;
    this.enableEmojis = options.emojis !== false;
    this.enableTimestamp = options.timestamp !== false;
    this.enableMetadata = options.metadata !== false;
    
    // File logging configuration
    this.logDirectory = options.logDirectory || path.join(process.cwd(), 'logs');
    this.logFileName = options.logFileName || 'application.log';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    
    // Initialize log directory and file
    this.initializeFileLogging();
    
    // Application metadata
    this.appName = options.appName || 'OCR-API';
    this.version = options.version || '2.0.0';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    
    // Request tracking
    this.requestId = null;
    this.requestStartTime = null;
  }
  
  /**
   * Initialize file logging system
   */
  initializeFileLogging() {
    if (!this.enableFile) return;
    
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
      
      this.logFilePath = path.join(this.logDirectory, this.logFileName);
      
      // Check if log rotation is needed
      this.checkLogRotation();
    } catch (error) {
      console.error('Failed to initialize file logging:', error.message);
      this.enableFile = false;
    }
  }
  
  /**
   * Check if log file needs rotation
   */
  checkLogRotation() {
    try {
      if (!fs.existsSync(this.logFilePath)) return;
      
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > this.maxFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      console.error('Error checking log rotation:', error.message);
    }
  }
  
  /**
   * Rotate log files when they get too large
   */
  rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFileName = `${path.parse(this.logFileName).name}-${timestamp}.log`;
      const rotatedPath = path.join(this.logDirectory, rotatedFileName);
      
      // Move current log to rotated file
      fs.renameSync(this.logFilePath, rotatedPath);
      
      // Clean up old rotated files
      this.cleanupOldLogFiles();
      
      this.info('Log file rotated', { rotatedTo: rotatedFileName });
    } catch (error) {
      console.error('Error rotating log file:', error.message);
    }
  }
  
  /**
   * Clean up old log files beyond the maximum count
   */
  cleanupOldLogFiles() {
    try {
      const files = fs.readdirSync(this.logDirectory)
        .filter(file => file.startsWith(path.parse(this.logFileName).name) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDirectory, file),
          mtime: fs.statSync(path.join(this.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      // Keep only the most recent files
      const filesToDelete = files.slice(this.maxFiles);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      if (filesToDelete.length > 0) {
        this.info(`Cleaned up ${filesToDelete.length} old log files`);
      }
    } catch (error) {
      console.error('Error cleaning up old log files:', error.message);
    }
  }
  
  /**
   * Check if a message should be logged based on the current log level
   */
  shouldLog(level) {
    return LOG_LEVELS[level.toUpperCase()] <= LOG_LEVELS[this.level.toUpperCase()];
  }
  
  /**
   * Format log message with metadata
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.enableTimestamp ? new Date().toISOString() : null;
    const emoji = this.enableEmojis ? EMOJIS[level] : '';
    
    // Build base log entry
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      app: this.appName,
      version: this.version,
      environment: this.environment,
      ...(this.enableMetadata && meta)
    };
    
    // Add request context if available
    if (this.requestId) {
      logEntry.requestId = this.requestId;
    }
    
    if (this.requestStartTime) {
      logEntry.requestDuration = Date.now() - this.requestStartTime;
    }
    
    return { logEntry, emoji };
  }
  
  /**
   * Format console output with colors
   */
  formatConsoleOutput(level, message, meta, emoji) {
    const color = this.enableColors ? COLORS[level] : '';
    const reset = this.enableColors ? COLORS.RESET : '';
    const timestamp = new Date().toISOString();
    
    let output = `${color}${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}${reset}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      output += `\n${color}  Meta: ${util.inspect(meta, { colors: this.enableColors, depth: 2 })}${reset}`;
    }
    
    return output;
  }
  
  /**
   * Write log entry to file
   */
  writeToFile(logEntry) {
    if (!this.enableFile || !this.logFilePath) return;
    
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine);
      
      // Check if rotation is needed after writing
      this.checkLogRotation();
    } catch (error) {
      console.error('Error writing to log file:', error.message);
    }
  }
  
  /**
   * Core logging method
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;
    
    const { logEntry, emoji } = this.formatMessage(level, message, meta);
    
    // Console output
    if (this.enableConsole) {
      const consoleOutput = this.formatConsoleOutput(level, message, meta, emoji);
      console.log(consoleOutput);
    }
    
    // File output
    this.writeToFile(logEntry);
  }
  
  // Convenience methods for different log levels
  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }
  
  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }
  
  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }
  
  http(message, meta = {}) {
    this.log('HTTP', message, meta);
  }
  
  verbose(message, meta = {}) {
    this.log('VERBOSE', message, meta);
  }
  
  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }
  
  silly(message, meta = {}) {
    this.log('SILLY', message, meta);
  }
  
  /**
   * Set request context for tracking requests across log entries
   */
  setRequestContext(requestId, startTime = Date.now()) {
    this.requestId = requestId;
    this.requestStartTime = startTime;
  }
  
  /**
   * Clear request context
   */
  clearRequestContext() {
    this.requestId = null;
    this.requestStartTime = null;
  }
  
  /**
   * Log HTTP requests
   */
  logRequest(req, res, duration) {
    const meta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      requestId: this.requestId
    };
    
    const level = res.statusCode >= 500 ? 'ERROR' : 
      res.statusCode >= 400 ? 'WARN' : 'HTTP';
    
    this.log(level, `${req.method} ${req.path} - ${res.statusCode}`, meta);
  }
  
  /**
   * Log OCR processing events
   */
  logOCR(event, filename, meta = {}) {
    const ocrMeta = {
      filename,
      event,
      requestId: this.requestId,
      ...meta
    };
    
    switch (event) {
    case 'start':
      this.info(`OCR processing started for ${filename}`, ocrMeta);
      break;
    case 'cache_hit':
      this.info(`Cache hit for ${filename}`, ocrMeta);
      break;
    case 'cache_miss':
      this.info(`Cache miss for ${filename}`, ocrMeta);
      break;
    case 'success':
      this.info(`OCR completed successfully for ${filename}`, ocrMeta);
      break;
    case 'error':
      this.error(`OCR failed for ${filename}`, ocrMeta);
      break;
    default:
      this.debug(`OCR event: ${event} for ${filename}`, ocrMeta);
    }
  }
  
  /**
   * Log database operations
   */
  logDatabase(operation, table, meta = {}) {
    const dbMeta = {
      operation,
      table,
      requestId: this.requestId,
      ...meta
    };
    
    this.verbose(`Database ${operation} on ${table}`, dbMeta);
  }
  
  /**
   * Log cache operations
   */
  logCache(operation, key, meta = {}) {
    const cacheMeta = {
      operation,
      key: key ? key.substring(0, 20) + '...' : null,
      requestId: this.requestId,
      ...meta
    };
    
    this.verbose(`Cache ${operation}`, cacheMeta);
  }
  
  /**
   * Performance timing utility
   */
  time(label) {
    const startTime = process.hrtime.bigint();
    return {
      end: () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        this.debug(`Timer: ${label}`, { duration: `${duration.toFixed(2)}ms` });
        return duration;
      }
    };
  }
  
  /**
   * Create a child logger with additional context
   */
  child(meta = {}) {
    const childLogger = new Logger({
      level: this.level,
      console: this.enableConsole,
      file: this.enableFile,
      colors: this.enableColors,
      emojis: this.enableEmojis,
      timestamp: this.enableTimestamp,
      metadata: this.enableMetadata,
      logDirectory: this.logDirectory,
      logFileName: this.logFileName,
      appName: this.appName,
      version: this.version,
      environment: this.environment
    });
    
    // Override the log method to include child metadata
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, childMeta = {}) => {
      return originalLog(level, message, { ...meta, ...childMeta });
    };
    
    return childLogger;
  }
}

/**
 * Create Express middleware for request logging
 */
function createRequestLogger(logger) {
  return (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const requestId = generateRequestId();
    
    // Set request context
    logger.setRequestContext(requestId, Date.now());
    
    // Add request ID to request object for use in other middleware
    req.requestId = requestId;
    
    // Log request start
    logger.debug(`Request started: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // Override res.end to log when request completes
    const originalEnd = res.end.bind(res);
    res.end = function(...args) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      logger.logRequest(req, res, duration);
      logger.clearRequestContext();
      
      originalEnd(...args);
    };
    
    next();
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default logger instance
 */
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  appName: 'OCR-API',
  version: '2.0.0'
});

module.exports = {
  Logger,
  createRequestLogger,
  generateRequestId,
  logger: defaultLogger, // Export default instance
  LOG_LEVELS
};
