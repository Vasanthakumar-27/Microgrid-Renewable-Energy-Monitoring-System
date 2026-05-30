const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/appConfig');

// Create upload directory if it doesn't exist
const uploadDir = config.uploadDir || path.join(process.cwd(), 'public/uploads/disputes');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✓ [Upload] Created directory: ${uploadDir}`);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: dispute_customerId_timestamp_random.ext
    const customerId = req.user?.customerId || 'unknown';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const filename = `dispute_${customerId}_${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

// File filter: only allow specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = config.allowedFileTypes || ['jpg', 'jpeg', 'png', 'pdf'];
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype;

  // Check extension
  if (!allowedTypes.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }

  // Check MIME type
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf'
  ];

  if (!allowedMimes.includes(mimetype)) {
    return cb(new Error('Invalid file type'));
  }

  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSize || 5 * 1024 * 1024 // 5MB default
  }
});

// Middleware for single file upload with error handling
const uploadSingleFile = (fieldName = 'evidence') => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File size exceeds maximum limit of ${config.maxFileSize / (1024 * 1024)}MB`
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (req.file) {
        console.log(`✓ [Upload] File uploaded: ${req.file.filename}`);
        req.uploadedFile = {
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype
        };
      }

      next();
    });
  };
};

// Get file download endpoint
const downloadFile = (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    const filepath = path.join(uploadDir, filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    console.log(`✓ [Download] Serving file: ${filename}`);
    res.download(filepath);
  } catch (error) {
    console.error('[Download] Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete file
const deleteFile = (filename) => {
  try {
    if (filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    const filepath = path.join(uploadDir, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`✓ [Upload] File deleted: ${filename}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Upload] Delete error:', error.message);
    return false;
  }
};

// Get upload status and statistics
const getUploadStats = () => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return {
        uploadDir,
        totalFiles: 0,
        totalSize: 0,
        maxFileSize: config.maxFileSize,
        allowedTypes: config.allowedFileTypes
      };
    }

    const files = fs.readdirSync(uploadDir);
    let totalSize = 0;

    files.forEach((file) => {
      const filepath = path.join(uploadDir, file);
      const stats = fs.statSync(filepath);
      totalSize += stats.size;
    });

    return {
      uploadDir,
      totalFiles: files.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      maxFileSize: config.maxFileSize,
      maxFileSizeMB: (config.maxFileSize / (1024 * 1024)).toFixed(1),
      allowedTypes: config.allowedFileTypes
    };
  } catch (error) {
    console.error('[Upload] Stats error:', error.message);
    return { error: error.message };
  }
};

module.exports = {
  uploadSingleFile,
  downloadFile,
  deleteFile,
  getUploadStats,
  uploadDir
};
