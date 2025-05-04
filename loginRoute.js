const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ✅ Updated schema with isDeleted flag
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  isDeleted: { type: Boolean, default: false }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const SecretKey = 'SecretKey123';

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username or password missing' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid username' });

    // ✅ Block soft-deleted users
    if (user.isDeleted) {
      return res.status(403).json({ message: 'Account deactivated. Please contact admin.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign(
      {
        id: user._id,
        email: user.username,
        role: user.role
      },
      SecretKey,
      { expiresIn: '10m' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// Add this at the very bottom of routes/userRegister.js

