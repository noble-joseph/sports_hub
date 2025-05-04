const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken, isUser,isAdmin } = require('./middleware');

const userDetailsSchema = new mongoose.Schema({
  addressLine1: String,
  addressLine2: String,
  addressLine3: String,
});
const UserDetails = mongoose.models.UserDetails || mongoose.model('UserDetails', userDetailsSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  isDeleted: { type: Boolean, default: false },
  details: { type: mongoose.Schema.Types.ObjectId, ref: 'UserDetails' },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: String,
  bookingDate: Date,
  bookingTime: String,
  quantity: Number,
  status: String,
  paymentStatus: String,
}, { timestamps: true });
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);




// 🧑‍💼 Admin view any user profile by ID
// 🧑‍💼 Admin view any user profile by ID
router.get('/admin/user-profile/:id', verifyToken, isAdmin, async (req, res) => {
    try {
      const user = await User.findById(req.params.id).populate('details');
      if (!user) return res.status(404).json({ message: 'User not found' });
  
      const bookings = await Booking.find({ userId: user._id });
  
      // Booking statistics
      const totalBookings = bookings.length;
      const approved = bookings.filter(b => b.status === 'approved').length;
      const rejected = bookings.filter(b => b.status === 'rejected').length;
      const pending = bookings.filter(b => b.status === 'pending').length;
  
      res.status(200).json({
        user: {
          username: user.username,
          role: user.role,
          status: user.isDeleted ? 'Deactivated' : 'Active',
          address: user.details,
          bookingStats: {
            total: totalBookings,
            approved,
            rejected,
            pending
          },
          bookings
        },
      });
    } catch (err) {
      console.error('Admin profile fetch error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  

// ✅ Route: Get user profile and their bookings
// 👤 User view their own profile
router.get('/user/profile', verifyToken, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).populate('details');
      if (!user) return res.status(404).json({ message: 'User not found' });
  
      const bookings = await Booking.find({ userId: user._id });
  
      // Booking statistics
      const totalBookings = bookings.length;
      const approved = bookings.filter(b => b.status === 'approved').length;
      const rejected = bookings.filter(b => b.status === 'rejected').length;
      const pending = bookings.filter(b => b.status === 'pending').length;
  
      res.status(200).json({
        user: {
          username: user.username,
          role: user.role,
          status: user.isDeleted ? 'Deactivated' : 'Active',
          address: user.details,
          bookingStats: {
            total: totalBookings,
            approved,
            rejected,
            pending
          },
          bookings
        },
      });
    } catch (err) {
      console.error('User profile fetch error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  // ✅ Route: User change password
router.put('/user/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bcrypt = require('bcryptjs');

    const isMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // Validate new password
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ message: 'New password must be at least 6 characters and include at least one letter, one number, and one special character' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

  

module.exports = router;
