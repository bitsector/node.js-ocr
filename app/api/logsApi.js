const { logs } = require('../services/ocrService');
const { isDatabaseConnected } = require('../db/database');

/**
 * Logs API Handler - handles logs endpoint HTTP requests
 * 
 * WARNING: This endpoint is for development/debugging only!
 * In production, this endpoint should be:
 * 1. Removed completely, OR
 * 2. Protected with proper authentication/authorization
 * 3. Rate-limited and IP-restricted
 * Exposing logs publicly is a serious security risk!
 * 
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function logsHandler(req, res) {
  try {
    // Check database connection first
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        error: 'Database not available',
        message: 'Database logging is not enabled'
      });
    }

    // Parse and validate limit parameter
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    
    if (isNaN(limit) || limit < 1) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a positive integer'
      });
    }

    // Call service layer for logs
    const result = await logs(limit);
    
    // Return success response
    res.json(result);

  } catch (error) {
    // Handle service layer errors and return appropriate HTTP response
    console.error('Logs API Error:', error.message);
    
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  logsHandler
};
