const request = require('supertest');
const app = require('../server');

describe('API Health Endpoints', () => {
  describe('GET /', () => {
    it('should return API status with version info', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version', '2.0.0');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.message).toContain('AWS Beanstalk OCR API is running');
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api', () => {
    it('should return API documentation', async () => {
      const response = await request(app).get('/api');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'AWS Beanstalk OCR API');
      expect(response.body).toHaveProperty('version', '2.0.0');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('database');
    });
  });

  describe('GET /logs', () => {
    it('should return logs or database unavailable message', async () => {
      const response = await request(app).get('/logs');
      
      // Should either return logs (200) or database unavailable (503)
      expect([200, 503]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('error', 'Database not available');
      }
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not found');
      expect(response.body).toHaveProperty('availableRoutes');
    });
  });
});
