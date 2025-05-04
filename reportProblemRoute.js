const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken, isUser, isAdmin } = require('./middleware');
const emailHelper = require('../controls/emailHelper');
const path = require('path');
const fs = require('fs');

// Report schema
const reportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true }, // e.g., 'Facility', 'Equipment', 'Staff', 'Other'
  status: { type: String, default: 'pending' }, // pending, in-progress, resolved
  response: { type: String, default: '' },
  attachments: [String], // File paths for any attached photos/documents
}, { timestamps: true });

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

// User submits a problem report
router.post('/report-problem', verifyToken, isUser, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const userId = req.user._id;

    // Validation
    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Title, description and category are required' });
    }

    if (title.length < 5 || title.length > 100) {
      return res.status(400).json({ message: 'Title must be between 5 and 100 characters' });
    }

    if (description.length < 20 || description.length > 1000) {
      return res.status(400).json({ message: 'Description must be between 20 and 1000 characters' });
    }

    const allowedCategories = ['Facility', 'Equipment', 'Staff', 'Booking', 'Other'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ 
        message: `Invalid category. Allowed categories: ${allowedCategories.join(', ')}`
      });
    }

    // Create report
    const newReport = new Report({
      userId,
      title,
      description,
      category
    });

    const saved = await newReport.save();

    // Notify admin via email
    const adminEmail = 'admin@sportshub.com'; // Replace with real admin email
    await emailHelper.sendTextEmail(
      adminEmail,
      `New Problem Report: ${title}`,
      `A new problem has been reported:\n\nCategory: ${category}\n\nDescription: ${description}\n\nPlease check the admin dashboard to respond.`
    );

    // Confirm to user
    const user = await mongoose.model('User').findById(userId);
    await emailHelper.sendTextEmail(
      user.email,
      'Problem Report Confirmation',
      `Hi ${user.username},\n\nYour problem report "${title}" has been submitted successfully. We will review it shortly.\n\nThank you,\nSports Hub Team`
    );

    res.status(201).json({ message: 'Problem reported successfully', report: saved });
  } catch (err) {
    console.error('Report problem error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// User views their reports
router.get('/my-reports', verifyToken, isUser, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ reports });
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Admin views all reports
router.get('/admin/reports', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    
    const reports = await Report.find(filter)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ reports });
  } catch (err) {
    console.error('Admin fetch reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Admin responds to a report
router.put('/admin/respond-report/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { response, status } = req.body;
    
    if (!response || !status) {
      return res.status(400).json({ message: 'Response and status are required' });
    }
    
    const report = await Report.findById(req.params.id).populate('userId');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    report.response = response;
    report.status = status;
    await report.save();
    
    // Send email to user with the response
    const user = report.userId;
    await emailHelper.sendTextEmail(
      user.email,
      `Update on Your Report: ${report.title}`,
      `Hi ${user.username},\n\nWe have an update on your reported issue "${report.title}".\n\nStatus: ${status}\n\nResponse: ${response}\n\nThank you,\nSports Hub Team`
    );
    
    res.status(200).json({ message: 'Response sent successfully', report });
  } catch (err) {
    console.error('Admin respond error:', err);
    res.status(500).json({ error: 'Failed to respond to report' });
  }
});

module.exports = { router, Report };