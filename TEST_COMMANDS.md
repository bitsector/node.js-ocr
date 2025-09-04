# Test Commands for OCR API

## Start the Node.js Server
```bash
cd /home/ak/playground/beanstalk
node app/server.js
```

## Run Python Tests
```bash
cd /home/ak/playground/beanstalk
/home/ak/playground/beanstalk/.venv/bin/python -m pytest app/tests/test_api.py -v -s
```

## Curl Commands for Testing

### Test Basic Health Check
```bash
curl -X GET http://localhost:8080/health
```

### Test API Info
```bash
curl -X GET http://localhost:8080/api
```

### Test OCR with Sample Files

#### Test with for_money.webp
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/for_money.webp" \
  -H "Content-Type: multipart/form-data"
```

#### Test with brain_buffering.jpeg
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/brain_buffering.jpeg" \
  -H "Content-Type: multipart/form-data"
```

#### Test with github_actions.webp
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/github_actions.webp" \
  -H "Content-Type: multipart/form-data"
```

#### Test with linkedin.webp
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/linkedin.webp" \
  -H "Content-Type: multipart/form-data"
```

#### Test with it_works_on_my_machine.jpg
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/it_works_on_my_machine.jpg" \
  -H "Content-Type: multipart/form-data"
```

#### Test with stranger_things.webp
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/stranger_things.webp" \
  -H "Content-Type: multipart/form-data"
```

#### Test with weasley.webp
```bash
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/weasley.webp" \
  -H "Content-Type: multipart/form-data"
```

### Loop Through All Files in Sample Directory
```bash
# Test all files in the sample_files directory
for file in /home/ak/playground/beanstalk/sample_files/*; do
  if [[ -f "$file" ]]; then
    echo "=== Testing $(basename "$file") ==="
    curl -X POST http://localhost:8080/ocr \
      -F "image=@$file" \
      -H "Content-Type: multipart/form-data" | jq '.'
    echo
    echo "Press Enter to continue to next file..."
    read
  fi
done
```

### Quick Loop Without Pauses
```bash
# Test all files without pausing
for file in /home/ak/playground/beanstalk/sample_files/*; do
  if [[ -f "$file" ]]; then
    echo "=== Testing $(basename "$file") ==="
    curl -X POST http://localhost:8080/ocr \
      -F "image=@$file" \
      -H "Content-Type: multipart/form-data" | jq '.extractedText // .text // "NO_TEXT_FOUND"'
    echo "---"
  fi
done
```

### Test Specific File Extensions Only
```bash
# Test only image files (jpg, jpeg, png, webp)
for file in /home/ak/playground/beanstalk/sample_files/*.{jpg,jpeg,png,webp}; do
  if [[ -f "$file" ]]; then
    echo "=== Testing $(basename "$file") ==="
    curl -X POST http://localhost:8080/ocr \
      -F "image=@$file" \
      -H "Content-Type: multipart/form-data"
    echo
  fi
done
```

### Expected Response Format

The server returns JSON with the `extractedText` field:

**Cache Miss (first time processing):**
```json
{
  "success": true,
  "filename": "for_money.webp",
  "extractedText": "FOR MONEY",
  "timestamp": "2025-07-21T...",
  "nodeVersion": "v23.9.0",
  "processingTimeMs": 1234,
  "ocrTimeMs": 1200,
  "fileSize": 5678,
  "mimeType": "image/webp"
}
```

**Cache Hit (duplicate image):**
```json
{
  "success": true,
  "filename": "for_money.webp",
  "extractedText": "FOR MONEY",
  "timestamp": "2025-07-21T...",
  "nodeVersion": "v23.9.0",
  "processingTimeMs": 45,
  "fileSize": 5678,
  "mimeType": "image/webp",
  "fromCache": true,
  "cacheBackend": "local",
  "cacheHit": true,
  "cacheLookupTimeMs": 12,
  "totalCacheTimeMs": 26
}
```

## Testing Redis Cache

### Test Cache Hit (Upload Same File Twice)
```bash
# First upload (cache miss - slow ~1200ms)
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/for_money.webp"

# Second upload immediately (cache hit - fast ~45ms) 
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/for_money.webp"
```

### Check Cache Status
```bash
curl -X GET http://localhost:8080/ | jq '.cache'
```

### Start Local Redis for Testing
```bash
docker run -d --name redis-demo -p 6379:6379 redis:latest
```

## Troubleshooting

1. **Connection Refused**: Make sure the Node.js server is running on port 8080
2. **Empty extractedText**: Check if Tesseract.js is properly configured with local traineddata
3. **File not found**: Ensure sample files exist in the correct path
4. **Cache not working**: Check if Redis is running locally or AWS ElastiCache is configured
5. **Slow responses**: Without cache, OCR takes ~1200ms; with cache hits, ~45ms

## Debug Individual File
```bash
# Test just one file with verbose output
curl -X POST http://localhost:8080/ocr \
  -F "image=@/home/ak/playground/beanstalk/sample_files/for_money.webp" \
  -H "Content-Type: multipart/form-data" | jq '.'
```
