const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken, isAdmin } = require('./middleware');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/achievements');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Achievement schema
const achievementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  category: { type: String, required: true }, // e.g., 'Tournament', 'Award', 'Milestone'
  image: { type: String }, // Path to image
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 } // For ordering on the front end
}, { timestamps: true });

const Achievement = mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema);

// Public route - Get all achievements
router.get('/achievements', async (req, res) => {
  try {
    const { featured, limit = 10, category } = req.query;
    
    const filter = {};
    if (featured === 'true') filter.featured = true;
    if (category) filter.category = category;
    
    const achievements = await Achievement.find(filter)
      .sort({ featured: -1, order: -1, date: -1 })
      .limit(parseInt(limit));
      
    res.status(200).json({ achievements });
  } catch (err) {
    console.error('Fetch achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Public route - Get achievement by ID
router.get('/achievements/:id', async (req, res) => {
  try {
    const achievement = await Achievement.findById(req.params.id);
    
    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }
    
    res.status(200).json({ achievement });
  } catch (err) {
    console.error('Fetch achievement error:', err);
    res.status(500).json({ error: 'Failed to fetch achievement' });
  }
});

// Admin route - Add new achievement
router.post('/admin/achievements', verifyToken, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, category, featured, order } = req.body;
    
    // Validation
    if (!title || !description || !date || !category) {
      return res.status(400).json({ message: 'Title, description, date and category are required' });
    }
    
    const imagePath = req.file ? `/uploads/achievements/${req.file.filename}` : null;
    
    const newAchievement = new Achievement({
      title,
      description,
      date: new Date(date),
      category,
      image: imagePath,
      featured: featured === 'true',
      order: order ? parseInt(order) : 0
    });
    
    const saved = await newAchievement.save();
    res.status(201).json({ message: 'Achievement added successfully', achievement: saved });
  } catch (err) {
    console.error('Add achievement error:', err);
    res.status(500).json({ error: 'Failed to add achievement' });
  }
});

// Admin route - Update achievement
router.put('/admin/achievements/:id', verifyToken, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, category, featured, order } = req.body;
    
    const achievement = await Achievement.findById(req.params.id);
    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }
    
    // Update fields if provided
    if (title) achievement.title = title;
    if (description) achievement.description = description;
    if (date) achievement.date = new Date(date);
    if (category) achievement.category = category;
    if (featured !== undefined) achievement.featured = featured === 'true';
    if (order !== undefined) achievement.order = parseInt(order);
    
    // If new image is uploaded
    if (req.file) {
      // Delete old image if exists
      if (achievement.image) {
        const oldImagePath = path.join(__dirname, '..', achievement.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      achievement.image = `/uploads/achievements/${req.file.filename}`;
    }
    
    const updated = await achievement.save();
    res.status(200).json({ message: 'Achievement updated successfully', achievement: updated });
  } catch (err) {
    console.error('Update achievement error:', err);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

// Admin route - Delete achievement
router.delete('/admin/achievements/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const achievement = await Achievement.findById(req.params.id);
    
    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }
    
    // Delete the image file if it exists
    if (achievement.image) {
      const imagePath = path.join(__dirname, '..', achievement.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await achievement.deleteOne();
    res.status(200).json({ message: 'Achievement deleted successfully' });
  } catch (err) {
    console.error('Delete achievement error:', err);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

// Admin route - Reorder achievements
router.put('/admin/achievements-reorder', verifyToken, isAdmin, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items must be an array' });
    }
    
    // Update the order of each item
    const updatePromises = items.map((item, index) => {
      return Achievement.findByIdAndUpdate(item.id, { order: index });
    });
    
    await Promise.all(updatePromises);
    
    res.status(200).json({ message: 'Achievement order updated successfully' });
  } catch (err) {
    console.error('Reorder achievements error:', err);
    res.status(500).json({ error: 'Failed to reorder achievements' });
  }
});

module.exports = { router, Achievement };