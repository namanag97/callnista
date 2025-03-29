const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.render('dashboard', { title: 'Dashboard' });
});

app.get('/transcripts', (req, res) => {
  res.render('transcripts', { title: 'Transcripts' });
});

app.get('/uploads', (req, res) => {
  res.render('uploads', { title: 'Uploads' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});