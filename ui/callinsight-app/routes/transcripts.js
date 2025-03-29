const express = require('express');
const router = express.Router();

// Sample data for demonstration
const sampleCalls = [
  {
    id: 'CALL-2023-0451',
    date: 'Aug 21, 2023',
    time: '13:22',
    duration: '15:18',
    category: 'Transactions > Failed Transfer',
    severity: 'Critical',
    status: 'Escalated',
    agent: 'Priya Patel'
  },
  {
    id: 'CALL-2023-0450',
    date: 'Aug 21, 2023',
    time: '11:05',
    duration: '04:37',
    category: 'Product Info > Investment Plans',
    severity: 'Low',
    status: 'Resolved',
    agent: 'Amit Kumar'
  },
  {
    id: 'CALL-2023-0449',
    date: 'Aug 21, 2023',
    time: '10:18',
    duration: '12:45',
    category: 'Customer Service > Complaint',
    severity: 'Medium',
    status: 'Workaround',
    agent: 'Sneha Gupta'
  }
];

// Transcripts list page
router.get('/', (req, res) => {
  res.render('transcripts', { 
    title: 'Transcripts',
    page: 'transcripts',
    calls: sampleCalls
  });
});

// Single transcript view
router.get('/:id', (req, res) => {
  const callId = req.params.id;
  const call = sampleCalls.find(c => c.id === callId);
  
  if (!call) {
    return res.status(404).render('404', { title: 'Transcript Not Found' });
  }
  
  res.render('transcript-detail', { 
    title: `Transcript: ${callId}`,
    page: 'transcripts',
    call: call
  });
});

module.exports = router;