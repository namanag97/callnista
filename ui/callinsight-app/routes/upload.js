const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// For local development: Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, 'CALL-' + Date.now() + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept audio files only
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'), false);
  }
};

// Initialize multer
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Uploads page
router.get('/', (req, res) => {
  res.render('uploads', { 
    title: 'Uploads',
    page: 'uploads'
  });
});

// Handle file upload
router.post('/', upload.array('audioFiles', 10), (req, res) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Process the uploaded files
    const uploadedFiles = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      path: file.path
    }));
    
    // In a real app, you would store file info in a database
    
    return res.status(200).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;