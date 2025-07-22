# 3-Layer Architecture Implementation

This document describes the new 3-layer architecture implementation for the OCR API.

## Architecture Overview

The application is now organized into 3 distinct layers with clear separation of concerns:

### 1. API Layer (`/api` directory)
**Purpose**: HTTP request/response handling, input validation, error handling

**Files**:
- `api/ocrApi.js` - OCR endpoint handler
- `api/logsApi.js` - Logs endpoint handler  

**Responsibilities**:
- Parse and validate HTTP requests
- Handle file upload validation
- Call appropriate service layer functions
- Format HTTP responses
- Handle HTTP error codes (400, 500, 503, etc.)
- All HTTP-specific logic

### 2. Service Layer (`/services` directory)  
**Purpose**: Business logic, data processing, orchestration

**Files**:
- `services/ocrService.js` - OCR processing and logs business logic

**Responsibilities**:
- OCR processing with Tesseract.js
- File cleanup operations
- Data transformation and validation
- Business rule enforcement
- Coordinate between API and DB layers
- All non-HTTP, non-DB logic

### 3. Database Layer (`/db` directory)
**Purpose**: Database operations, data persistence

**Files**:
- `db/database.js` - All database operations

**Responsibilities**:
- Database connection management
- Table creation and schema management
- `write_ocr()` - Insert OCR results to database
- `get_logs()` - Retrieve OCR logs from database  
- Database configuration and pooling
- Connection health checks

### 4. Utilities Layer (`/utils` directory)
**Purpose**: Shared utilities, validation, logging, error handling

**Files**:
- `utils/logger.js` - Professional logging system
- `utils/errors.js` - Custom error classes and error handling
- `utils/fileValidation.js` - Comprehensive file validation

**Responsibilities**:
- Structured logging with multiple levels and outputs
- Custom error classes for better error handling
- File validation (MIME types, file size, security checks)
- Request tracking and performance monitoring
- Log rotation and management

## Function Flow

### OCR Endpoint (`POST /ocr`)
```
HTTP Request → ocrHandler (API) → ocr() (Service) → write_ocr() (DB)
                    ↓                ↓                    ↓
HTTP Response ← Error Handling ← File Processing ← Database Insert
```

### Logs Endpoint (`GET /logs`)  
```
HTTP Request → logsHandler (API) → logs() (Service) → get_logs() (DB)
                    ↓                 ↓                    ↓
HTTP Response ← Error Handling ← Business Logic ← Database Query
```

## Key Benefits

✅ **Separation of Concerns**: Each layer has a single responsibility
✅ **Testability**: Each layer can be tested independently  
✅ **Maintainability**: Changes in one layer don't affect others
✅ **Async Operations**: All calls between layers use async/await
✅ **Error Handling**: Proper error propagation between layers
✅ **Reusability**: Service layer functions can be reused

## Async Implementation

- All API → Service calls use `await`
- All Service → DB calls use `await`  
- Proper error handling with try/catch blocks
- No blocking operations in request handlers

## Database Operations

- All database operations isolated in DB layer
- Connection pooling handled in DB layer
- Database initialization handled in DB layer
- Graceful shutdown with connection cleanup
