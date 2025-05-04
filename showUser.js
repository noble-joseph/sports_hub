const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('./middleware');
const emailHelper = require('../controls/emailHelper');

// ✅ Updated schema with isDeleted
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  email: String,
  phone: String,
  details: { type: mongoose.Schema.Types.ObjectId, ref: 'UserDetails' },
  isDeleted: { type: Boolean, default: false } // Soft delete flag
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ✅ Show only active users
router.get('/showusers', isAdmin, async (req, res) => {
  try {
    //const users = await User.find({ isDeleted: false }, { password: 0 }).populate('details');
    const users =await User.find({ $or: [ { isDeleted: false }, { isDeleted: { $exists: false } } ] }, { password: 0 }).populate('details').lean(); 

    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Admin update user
router.put('/admin/update-user/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user || user.isDeleted) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot edit admin users' });

    user.username = updateData.username;
    user.email = updateData.email;
    user.role = updateData.role;
    user.phone = updateData.phone;
    user.details = updateData.details;

    await user.save();

    await emailHelper.sendTextEmail(
      user.email,
      'Profile Updated by Admin',
      `Hi ${user.username}, your profile has been updated by admin. If this wasn't you, please contact support.`
    );

    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Admin soft delete user
router.delete('/admin/delete-user/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user || user.isDeleted) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin users' });

    user.isDeleted = true;
    await user.save();

    await emailHelper.sendTextEmail(
      user.email,
      'Account Deactivated by Admin',
      `Hi ${user.username}, your account has been deactivated by an administrator.`
    );

    res.status(200).json({ message: 'User deactivated (soft deleted)' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Optional: Restore soft-deleted user
router.put('/admin/restore-user/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isDeleted = false;
    await user.save();

    res.status(200).json({ message: 'User restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
 