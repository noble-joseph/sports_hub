const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '150mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect('mongodb+srv://noblejoseph2026:x1B42PVjhiPnppTj@cluster0.89nyh2u.mongodb.net/myDatabaseName?retryWrites=true&w=majority')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Load .env (if needed for Gmail OAuth etc.)
const env = require('./utils/config/config.gmail.env');

//const userRegister = require('./routes/userRegister');
//app.use('/api', userRegister); // ✅ CORRECT
const userRegister = require('./routes/userRegister');
app.use('/api', userRegister.router); 

app.use('/api', require('./routes/loginRoute'));
app.use('/api', require('./routes/showUser'));

const adminRoutes = require('./routes/adminRoutes');
app.use('/api', adminRoutes);

const sendUsersPDFRoute = require('./routes/sendUsersPDF');
app.use('/api/admin', sendUsersPDFRoute);

const bookingRoute = require('./routes/bookingRoute');
app.use('/api', bookingRoute.router);

const userProfileRoute = require('./routes/userProfile');
app.use('/api', userProfileRoute);

const reportProblemRoute = require('./routes/reportProblemRoute');
app.use('/api', reportProblemRoute.router);

// New routes for achievements
const achievementRoutes = require('./routes/achievementRoutes');
app.use('/api', achievementRoutes.router);


// Start server
const PORT = 4321;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
