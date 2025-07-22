# Redis Cache Implementation

## 🚀 **Overview**

The OCR API now includes a Redis cache system that automatically detects duplicate images and returns cached OCR results, significantly improving performance for repeated requests.

## 🔧 **How It Works**

### **1. File Content Hashing**
- Each uploaded image is hashed using SHA-256 (content + filename)
- Hash is used as unique cache key: `ocr:abc123...`
- Same image content = same hash = cache hit

### **2. Automatic Backend Detection**
- **Primary**: Attempts AWS ElastiCache Redis connection
- **Fallback**: Local Redis container (`localhost:6379`)
- **Graceful Degradation**: Disables cache if neither is available

### **3. Cache Flow**
```
Image Upload → Generate Hash → Check Cache
                                    ↓
                            Cache Hit? → Yes → Return Cached Result (Fast!)
                                    ↓
                            Cache Miss → Process with Tesseract → Store in Cache
```

## 📋 **Environment Variables**

### **AWS ElastiCache (Production)**
```bash
REDIS_HOST=your-elasticache-endpoint.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password  # Optional
```

### **Local Development**
Start local Redis container:
```bash
docker run -d --name redis-demo -p 6379:6379 redis:latest
```

## 🎯 **Cache Behavior**

### **Cache Hit (Duplicate Image)**
```
🔍 Checking cache for image.jpg
🔑 Cache key: ocr:a1b2c3d4e5f6789...
📖 File read time: 5.23ms
🎯 CACHE HIT for image.jpg
📊 Cache backend: aws
⏱️  Redis lookup time: 12.45ms
⏱️  Total cache time: 25.67ms
✨ Saved OCR processing time for duplicate image
⚡ Total time with cache: 45.67ms
```

**API Response includes:**
```json
{
  "fromCache": true,
  "cacheBackend": "aws",
  "cacheHit": true,
  "cacheLookupTimeMs": 12,
  "totalCacheTimeMs": 26,
  "processingTimeMs": 46,  // Very fast!
  "extractedText": "cached result"
}
```

### **Cache Miss (New Image)**
```
🔍 Checking cache for newimage.jpg
🔑 Cache key: ocr:x9y8z7w6v5u4321...
📖 File read time: 4.89ms
❌ CACHE MISS for newimage.jpg
📊 Cache backend: aws
⏱️  Redis lookup time: 8.12ms
⏱️  Total cache check time: 18.34ms
🔄 Will process OCR and cache result
✅ Tesseract OCR completed in 1234.56ms
💾 CACHED RESULT for newimage.jpg
```

**API Response:**
```json
{
  "success": true,
  "processingTimeMs": 1457,
  "ocrTimeMs": 1235,
  "extractedText": "new ocr result"
  // No cache metadata
}
```

## 🔍 **Cache Status Monitoring**

### **API Status Endpoint**
`GET /` now includes cache information:
```json
{
  "cache": {
    "enabled": true,
    "backend": "aws",
    "connected": true,
    "info": {
      "version": "7.0.0",
      "uptime": "86400",
      "connected_clients": "5"
    }
  }
}
```

### **Console Logging**
```
🔄 Initializing Redis cache connection...
🌐 Attempting connection to AWS ElastiCache Redis...
📍 AWS Redis Host: your-endpoint.cache.amazonaws.com:6379
✅ Redis aws ping successful
✅ Successfully connected to AWS ElastiCache Redis
🎯 Cache system enabled with AWS backend
```

## 📁 **File Structure**

```
app/
├── cache/
│   └── cache.js           # Redis cache implementation
├── services/
│   └── ocrService.js      # Updated with cache integration
├── server.js              # Cache initialization
└── package.json           # Added redis dependency
```

## 🛠️ **Technical Details**

### **Cache Key Generation**
```javascript
// SHA-256 hash of (file content + filename)
const cacheKey = `ocr:${hash.digest('hex')}`;
```

### **Cache Storage**
- **TTL**: 24 hours (configurable)
- **Data**: Complete OCR result object
- **Format**: JSON string

### **Error Handling**
- Cache errors don't break OCR processing
- Graceful fallback to normal processing
- Comprehensive error logging

## 🚦 **Performance Benefits**

### **Cache Hit Performance**
- **Without Cache**: ~1200ms (Tesseract processing)
- **With Cache Hit**: ~45ms (Redis lookup only)
- **Performance Gain**: ~96% faster!

### **Network Benefits**
- Reduced server CPU usage
- Faster API responses
- Better user experience
- Reduced AWS compute costs

## 🔒 **Production Considerations**

### **AWS ElastiCache Setup**
1. Configure ElastiCache Redis cluster
2. Set environment variables
3. Ensure security group access
4. Configure backup and monitoring

### **Cache Invalidation**
- TTL-based expiration (24 hours)
- No manual invalidation currently
- Could add cache clearing endpoint if needed

### **Memory Usage**
- Monitor Redis memory usage
- Set appropriate maxmemory policy
- Consider cache size limits

## 🧪 **Testing Cache**

### **Test Cache Hit**
1. Upload same image twice
2. First request: slow (cache miss)
3. Second request: fast (cache hit)

### **Test Fallback**
1. Stop Redis server
2. Upload image
3. Should work normally without cache

### **Local Testing**
```bash
# Start local Redis
docker run -d --name redis-demo -p 6379:6379 redis:latest

# Start OCR API
cd /home/ak/playground/beanstalk/app
node server.js

# Test same image twice
curl -X POST "http://localhost:8080/ocr" -F "image=@sample_files/brain_buffering.jpeg"
curl -X POST "http://localhost:8080/ocr" -F "image=@sample_files/brain_buffering.jpeg"  # Should be much faster
```
