# AWS Beanstalk OCR API

A Node.js Express API for Optical Character Recognition (OCR) deployed on AWS Elastic Beanstalk.

## Features

- **OCR Processing**: Extract text from images using Tesseract.js
- **File Upload**: Support for multiple image formats (JPG, PNG, GIF, BMP, TIFF)
- **Health Checks**: Built-in health monitoring endpoints
- **Error Handling**: Comprehensive error handling and validation
- **AWS Ready**: Configured for Elastic Beanstalk deployment

## API Endpoints

### `GET /`
Returns API status and basic information.

### `GET /health`
Health check endpoint for monitoring.

### `GET /api`
Complete API documentation and usage examples.

### `POST /ocr`
Upload an image file for OCR text extraction.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Image file in `image` field
- Max file size: 10MB

**Response:**
```json
{
  "success": true,
  "filename": "example.jpg",
  "extractedText": "Extracted text from the image...",
  "timestamp": "2025-07-18T09:30:00.000Z"
}
```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Deployment to AWS Elastic Beanstalk

This application is ready for deployment to AWS Elastic Beanstalk:

1. **Zip the application** (excluding node_modules)
2. **Upload to Beanstalk** via AWS Console or EB CLI
3. **Platform**: Node.js 18+ on Amazon Linux 2023

### Using EB CLI

```bash
# Initialize Beanstalk application
eb init -p node.js aws-beanstalk-sandbox --region us-east-1

# Create and deploy environment
eb create aws-beanstalk-sandbox-env

# Open application
eb open
```

## Environment Variables

The application automatically uses:
- `PORT`: Set by Elastic Beanstalk (default: 8080)
- `NODE_ENV`: Environment mode (development/production)

## Supported Image Formats

- JPEG/JPG
- PNG
- GIF
- BMP
- TIFF

## Error Handling

- File size validation (max 10MB)
- Image format validation
- OCR processing error handling
- Automatic cleanup of uploaded files
