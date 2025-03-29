const express = require('express');
const router = express.Router();

// Dashboard route
router.get('/', (req, res) => {
  res.render('dashboard', { 
    title: 'Dashboard',
    page: 'dashboard'
  });
});

// Analytics route
router.get('/analytics', (req, res) => {
  res.render('analytics', { 
    title: 'Analytics',
    page: 'analytics'
  });
});

module.exports = router;