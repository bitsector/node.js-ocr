const redis = require('redis');
const crypto = require('crypto');

// Redis configuration for different environments
const redisConfigs = {
  // AWS ElastiCache Redis (primary)
  aws: {
    host: process.env.REDIS_HOST || process.env.AWS_REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || process.env.AWS_REDIS_PASSWORD,
    connectTimeout: 5000,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 2
  },
  // Local containerized Redis (fallback)
  local: {
    host: 'localhost',
    port: 6379,
    connectTimeout: 2000,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1
  }
};

// Global Redis client
let redisClient = null;
let cacheEnabled = false;
let connectionType = null;

/**
 * Initialize Redis connection
 * Attempts AWS ElastiCache first, then falls back to local Redis
 */
async function init() {
  console.log('🔄 Initializing Redis cache connection...');
  
  // Try AWS ElastiCache first if configuration is available
  if (redisConfigs.aws.host) {
    console.log('🌐 Attempting connection to AWS ElastiCache Redis...');
    console.log(`📍 AWS Redis Host: ${redisConfigs.aws.host}:${redisConfigs.aws.port}`);
    
    const success = await tryConnection('aws', redisConfigs.aws);
    if (success) {
      connectionType = 'aws';
      cacheEnabled = true;
      console.log('✅ Successfully connected to AWS ElastiCache Redis');
      console.log('🎯 Cache system enabled with AWS backend');
      return;
    }
  } else {
    console.log('⚠️ No AWS Redis configuration found, skipping AWS connection attempt');
  }
  
  // Fall back to local Redis
  console.log('🏠 Attempting connection to local Redis container...');
  console.log('📍 Local Redis: localhost:6379');
  console.log('💡 Expected local setup: docker run -d --name redis-demo -p 6379:6379 redis:latest');
  
  const success = await tryConnection('local', redisConfigs.local);
  if (success) {
    connectionType = 'local';
    cacheEnabled = true;
    console.log('✅ Successfully connected to local Redis container');
    console.log('🎯 Cache system enabled with local backend');
    return;
  }
  
  // No Redis available
  console.log('❌ Failed to connect to both AWS and local Redis');
  console.log('⚠️ Cache system disabled - OCR requests will always process images');
  cacheEnabled = false;
  connectionType = null;
}

/**
 * Try to establish Redis connection with given configuration
 * @param {string} type - Connection type ('aws' or 'local')
 * @param {object} config - Redis configuration
 * @returns {boolean} True if connection successful
 */
async function tryConnection(type, config) {
  try {
    // Create Redis client
    const client = redis.createClient({
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: config.connectTimeout,
      },
      password: config.password,
      lazyConnect: config.lazyConnect,
      retryDelayOnFailover: config.retryDelayOnFailover,
      enableReadyCheck: config.enableReadyCheck,
      maxRetriesPerRequest: config.maxRetriesPerRequest
    });

    // Set up error handlers
    client.on('error', (err) => {
      console.error(`❌ Redis ${type} connection error:`, err.message);
    });

    client.on('ready', () => {
      console.log(`🚀 Redis ${type} client ready`);
    });

    client.on('reconnecting', () => {
      console.log(`🔄 Redis ${type} client reconnecting...`);
    });

    // Attempt to connect
    await client.connect();
    
    // Test the connection
    await client.ping();
    console.log(`✅ Redis ${type} ping successful`);
    
    // Store the successful client
    redisClient = client;
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to connect to Redis ${type}:`, error.message);
    return false;
  }
}

/**
 * Generate a hash for file content to use as cache key
 * @param {Buffer|string} fileContent - File content to hash
 * @param {string} originalName - Original filename for additional uniqueness
 * @returns {string} SHA-256 hash of the content
 */
function generateFileHash(fileContent, originalName = '') {
  const hash = crypto.createHash('sha256');
  hash.update(fileContent);
  hash.update(originalName); // Include filename for additional uniqueness
  return `ocr:${hash.digest('hex')}`;
}

/**
 * Get OCR result from cache or return null if not found
 * @param {string} filePath - Path to the image file
 * @param {string} originalName - Original filename
 * @returns {object|null} Cached OCR result or null if not found
 */
async function get_from_cache(filePath, originalName) {
  if (!cacheEnabled || !redisClient) {
    console.log('⚠️ Cache not available - cache miss (disabled)');
    return null;
  }

  const cacheStartTime = performance.now();

  try {
    const fs = require('fs').promises;
    
    // Read file content for hashing
    const fileReadStartTime = performance.now();
    const fileContent = await fs.readFile(filePath);
    const fileReadTime = performance.now() - fileReadStartTime;
    
    const cacheKey = generateFileHash(fileContent, originalName);
    
    console.log(`🔍 Checking cache for ${originalName}`);
    console.log(`🔑 Cache key: ${cacheKey.substring(0, 20)}...`);
    console.log(`📖 File read time: ${fileReadTime.toFixed(2)}ms`);
    
    // Try to get from cache
    const redisLookupStartTime = performance.now();
    const cachedResult = await redisClient.get(cacheKey);
    const redisLookupTime = performance.now() - redisLookupStartTime;
    
    const totalCacheTime = performance.now() - cacheStartTime;
    
    if (cachedResult) {
      // Cache hit!
      const parsedResult = JSON.parse(cachedResult);
      console.log(`🎯 CACHE HIT for ${originalName}`);
      console.log(`📊 Cache backend: ${connectionType}`);
      console.log(`⏱️  Redis lookup time: ${redisLookupTime.toFixed(2)}ms`);
      console.log(`⏱️  Total cache time: ${totalCacheTime.toFixed(2)}ms`);
      console.log('✨ Saved OCR processing time for duplicate image');
      
      // Add cache metadata to the result
      return {
        ...parsedResult,
        fromCache: true,
        cacheBackend: connectionType,
        cacheHit: true,
        cacheLookupTimeMs: Math.round(redisLookupTime),
        totalCacheTimeMs: Math.round(totalCacheTime)
      };
    } else {
      // Cache miss
      console.log(`❌ CACHE MISS for ${originalName}`);
      console.log(`📊 Cache backend: ${connectionType}`);
      console.log(`⏱️  Redis lookup time: ${redisLookupTime.toFixed(2)}ms`);
      console.log(`⏱️  Total cache check time: ${totalCacheTime.toFixed(2)}ms`);
      console.log('🔄 Will process OCR and cache result');
      return null;
    }
    
  } catch (error) {
    const totalCacheTime = performance.now() - cacheStartTime;
    console.error('❌ Cache lookup error:', error.message);
    console.log(`⏱️  Cache error occurred after: ${totalCacheTime.toFixed(2)}ms`);
    console.log('⚠️ Proceeding without cache - treating as cache miss');
    return null;
  }
}

/**
 * Store OCR result in cache
 * @param {string} filePath - Path to the image file
 * @param {string} originalName - Original filename
 * @param {object} ocrResult - OCR result to cache
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 */
async function store_in_cache(filePath, originalName, ocrResult, ttl = 86400) {
  if (!cacheEnabled || !redisClient) {
    console.log('⚠️ Cache not available - skipping cache storage');
    return;
  }

  try {
    const fs = require('fs').promises;
    
    // Read file content for hashing
    const fileContent = await fs.readFile(filePath);
    const cacheKey = generateFileHash(fileContent, originalName);
    
    // Remove cache metadata from result before storing
    const cacheableResult = { ...ocrResult };
    delete cacheableResult.fromCache;
    delete cacheableResult.cacheBackend;
    delete cacheableResult.cacheHit;
    
    // Store in cache
    await redisClient.setEx(cacheKey, ttl, JSON.stringify(cacheableResult));
    
    console.log(`💾 CACHED RESULT for ${originalName}`);
    console.log(`🔑 Cache key: ${cacheKey.substring(0, 20)}...`);
    console.log(`⏰ TTL: ${ttl} seconds (${Math.round(ttl/3600)} hours)`);
    console.log(`📊 Cache backend: ${connectionType}`);
    
  } catch (error) {
    console.error('❌ Cache storage error:', error.message);
    console.log('⚠️ OCR processing completed successfully despite cache error');
  }
}

/**
 * Get cache status and statistics
 * @returns {object} Cache status information
 */
async function getCacheStatus() {
  const status = {
    enabled: cacheEnabled,
    backend: connectionType,
    connected: false,
    info: null
  };

  if (redisClient && cacheEnabled) {
    try {
      await redisClient.ping();
      status.connected = true;
      
      // Get Redis info if available
      const info = await redisClient.info();
      status.info = {
        version: info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown',
        uptime: info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1] || 'unknown',
        connected_clients: info.match(/connected_clients:([^\r\n]+)/)?.[1] || 'unknown'
      };
    } catch (error) {
      console.error('❌ Cache status check error:', error.message);
    }
  }

  return status;
}

/**
 * Close Redis connection gracefully
 */
async function closeCache() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis cache connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error.message);
    } finally {
      redisClient = null;
      cacheEnabled = false;
      connectionType = null;
    }
  }
}

module.exports = {
  init,
  get_from_cache,
  store_in_cache,
  getCacheStatus,
  closeCache
};
