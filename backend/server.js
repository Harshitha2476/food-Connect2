const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const initDatabase = require('./database/init');
const { closeDatabase } = require('./database/connection');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Ensure upload directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

// 1. Database Initialization
try {
  initDatabase();
} catch (dbError) {
  console.error('Fatal: Failed to initialize SQLite database:', dbError);
  process.exit(1);
}

// 2. Core Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Static Files (Uploads)
app.use('/uploads', express.static(config.upload.dir));

// 4. API Routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    project: 'Campus FoodConnect Backend API',
    status: 'Running',
    healthCheck: '/api/health',
    apiRoot: '/api',
  });
});

// 5. Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// 6. Server Startup (only start listener when executed directly, not when imported in tests)
let server;
if (require.main === module) {
  server = app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Campus FoodConnect Backend Server`);
    console.log(`📡 URL: http://localhost:${config.port}`);
    console.log(`🏥 Health Check: http://localhost:${config.port}/api/health`);
    console.log(`🌐 CORS Allowed Origin: ${config.cors.origin}`);
    console.log(`💾 SQLite Database: ${config.db.path}`);
    console.log(`📁 Uploads Directory: ${config.upload.dir}`);
    console.log(`======================================================\n`);
  });
}

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      closeDatabase();
      console.log('SQLite database connection closed.');
      process.exit(0);
    });
  } else {
    closeDatabase();
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;

