const express = require('express');
const router = express.Router();

// Upload page route
router.get('/', (req, res) => {
  res.render('uploads', { 
    title: 'Uploads',
    page: 'uploads'
  });
});

module.exports = router;
