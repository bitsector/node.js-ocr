# Local Development Commands

This file contains all the commands needed to run and test the OCR API locally.

## 0. Setup Redis Cache (Optional but Recommended)

### Start Local Redis Container:
```bash
# Start Redis container for caching
docker run -d --name redis-demo -p 6379:6379 redis:latest

# Verify Redis is running
docker ps | grep redis
```

### Check Redis Connection:
```bash
# Test Redis connectivity
redis-cli ping  # Should return PONG
```

**Note**: Without Redis, the OCR API will work but won't cache results, making duplicate image processing slower.

## 1. Start the Node.js OCR Service

### From the app directory:
```bash
cd /home/ak/playground/beanstalk/app
node server.js
```

### Alternative with npm (if you have start script):
```bash
cd /home/ak/playground/beanstalk/app
npm start
```

**Expected Output:**
```
🔄 Initializing Redis cache connection...
🏠 Attempting connection to local Redis container...
📍 Local Redis: localhost:6379
✅ Redis local ping successful
✅ Successfully connected to local Redis container
🎯 Cache system enabled with local backend
🔗 Connecting to MySQL database...
📍 Host: localhost
📍 Database: securityreviewdb
✅ Database connection established
✅ OCR logs table created/verified
🚀 OCR API Server running on port 8080
📍 Environment: development
🔧 Node.js version: v22.x.x
⏰ Started at: 2025-07-21T...
🔗 Available endpoints:
   GET  / - API info
   GET  /health - Health check
   POST /ocr - OCR processing
   GET  /logs - View logs
```

## 2. Run Python Tests (pytest)

### Install dependencies first (in virtual environment):
```bash
cd /home/ak/playground/beanstalk
source .venv/bin/activate
pip install -r app/tests/requirements.txt
```

### Run pytest tests:
```bash
cd /home/ak/playground/beanstalk
.venv/bin/python -m pytest app/tests/test_api.py -v
```

### Run pytest with coverage:
```bash
cd /home/ak/playground/beanstalk
.venv/bin/python -m pytest app/tests/test_api.py -v --cov=app/tests --cov-report=term-missing
```

### Run specific test:
```bash
cd /home/ak/playground/beanstalk
.venv/bin/python -m pytest app/tests/test_api.py::test_server_response -v
```

## 3. Manual Testing with curl Commands

### Test API Status:
```bash
curl -X GET http://localhost:8080/
```

### Test Health Check:
```bash
curl -X GET http://localhost:8080/health
```

**Test API Documentation:**
```bash
# This endpoint has been removed for security reasons
# curl -X GET http://localhost:8080/api
```

### Test OCR Processing (single file):
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/brain_buffering.jpeg"
```

### Test OCR with different file:
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/it_works_on_my_machine.jpg"
```

### Test Logs Endpoint:
```bash
curl -X GET http://localhost:8080/logs
```

### Test Logs with Limit:
```bash
curl -X GET "http://localhost:8080/logs?limit=5"
```

## 4. Bash Loop for Testing All Sample Files

### Test all files in sample_files directory:
```bash
cd /home/ak/playground/beanstalk

# Loop through all files in sample_files
for file in sample_files/*; do
  echo "===========================================" 
  echo "Testing file: $(basename "$file")"
  echo "==========================================="
  curl -X POST http://localhost:8080/ocr \
    -F "image=@$file" \
    -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"
  echo ""
  sleep 1  # Small delay between requests
done
```

### One-liner version:
```bash
cd /home/ak/playground/beanstalk && for file in sample_files/*; do echo "=== Testing: $(basename "$file") ==="; curl -X POST http://localhost:8080/ocr -F "image=@$file" -s | jq '.filename, .extractedText' 2>/dev/null || curl -X POST http://localhost:8080/ocr -F "image=@$file"; echo ""; done
```

## 5. Complete Test Workflow

### Terminal 1 - Start the server:
```bash
cd /home/ak/playground/beanstalk/app
node server.js
```

### Terminal 2 - Run all tests:
```bash
cd /home/ak/playground/beanstalk

# 1. Test server is running
curl -s http://localhost:8080/health | jq '.status'

# 2. Run Python tests  
.venv/bin/python -m pytest app/tests/test_api.py -v

# 3. Test with curl manually
curl -X POST http://localhost:8080/ocr \
  -F "image=@sample_files/brain_buffering.jpeg"

# 4. Check logs
curl -X GET http://localhost:8080/logs
```

## 6. Troubleshooting Commands

### Check if server is running:
```bash
curl -f http://localhost:8080/health
echo $?  # Should return 0 if successful
```

### Check what's running on port 8080:
```bash
lsof -i :8080
```

### Kill server if needed:
```bash
pkill -f "node server.js"
```

### Check Python environment:
```bash
cd /home/ak/playground/beanstalk
.venv/bin/python --version
.venv/bin/python -c "import pytest, requests; print('Dependencies OK')"
```

### Test database connectivity (if using local MySQL):
```bash
# Only if you have MySQL running locally
mysql -u admin -p -h localhost -e "SHOW TABLES;" securityreviewdb
```

## 7. Expected Test Results

### Successful OCR Response (Cache Miss):
```json
{
  "success": true,
  "filename": "brain_buffering.jpeg",
  "extractedText": "brain buffering",
  "timestamp": "2025-07-21T...",
  "nodeVersion": "v22.x.x",
  "processingTimeMs": 1234,
  "ocrTimeMs": 1200,
  "fileSize": 5678,
  "mimeType": "image/jpeg"
}
```

### Successful OCR Response (Cache Hit):
```json
{
  "success": true,
  "filename": "brain_buffering.jpeg",
  "extractedText": "brain buffering",
  "timestamp": "2025-07-21T...",
  "nodeVersion": "v22.x.x",
  "processingTimeMs": 45,
  "fileSize": 5678,
  "mimeType": "image/jpeg",
  "fromCache": true,
  "cacheBackend": "local",
  "cacheHit": true,
  "cacheLookupTimeMs": 12,
  "totalCacheTimeMs": 26
}
```

### Successful Logs Response:
```json
{
  "success": true,
  "data": [...],
  "total": 5,
  "limit": 10,
  "timestamp": "2025-07-21T..."
}
```
