const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const indexRoutes = require('./routes/index');
const uploadsRoutes = require('./routes/uploads');
const transcriptsRoutes = require('./routes/transcripts');

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
app.use('/', indexRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/transcripts', transcriptsRoutes);

// Handle 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});