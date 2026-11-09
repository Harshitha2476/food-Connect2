const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_dev_secret_key_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    path: process.env.DB_PATH
      ? path.resolve(__dirname, '..', process.env.DB_PATH)
      : path.resolve(__dirname, '..', 'database', 'foodconnect.db'),
  },
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  upload: {
    dir: process.env.UPLOAD_DIR
      ? path.resolve(__dirname, '..', process.env.UPLOAD_DIR)
      : path.resolve(__dirname, '..', 'uploads'),
    maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024,
  },
  osrm: {
    baseUrl: process.env.OSRM_BASE_URL || null,
    timeoutMs: parseInt(process.env.OSRM_TIMEOUT_MS, 10) || 2500,
  },
};

module.exports = config;
