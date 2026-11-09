const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const { sendError } = require('../utils/response');

// Ensure upload directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

// Whitelist of allowed extensions and MIME types
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Configure disk storage with randomized, cryptographically safe filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    // Generate 32-character random hex string to prevent path traversal and collision
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `food-${Date.now()}-${randomName}${safeExt}`);
  },
});

// File filter based on MIME type and file extension
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIMES.has(mime)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only valid image files (JPEG, PNG, WEBP, GIF) are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize, // 5MB limit
  },
  fileFilter,
});

/**
 * Validates actual binary content (magic numbers) of the uploaded file.
 * Prevents disguised executable files from being uploaded as images.
 */
function validateImageMagicBytes(req, res, next) {
  if (!req.file) {
    return next();
  }

  const filePath = req.file.path;

  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    const isGif = buffer.toString('ascii', 0, 4) === 'GIF8';
    const isWebp =
      buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

    if (!isJpeg && !isPng && !isGif && !isWebp) {
      // Discard invalid/spoofed file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return sendError(
        res,
        400,
        'File content validation failed. The uploaded file is not a valid JPEG, PNG, WEBP, or GIF image.'
      );
    }

    next();
  } catch (err) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return sendError(res, 400, 'Unable to verify uploaded file contents.', err.message);
  }
}

/**
 * Cleanup helper for deleting uploaded file if request validation fails
 */
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  upload,
  validateImageMagicBytes,
  cleanupFile,
};
