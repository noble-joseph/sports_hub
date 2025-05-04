const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const emailHelper = require('../controls/emailHelper');
const { isUser, isAdmin, verifyToken } = require('./middleware'); // make sure you have this
const { User } = require("../routes/userRegister");// adjust path if needed
const PdfPrinter = require('pdfmake');
const nodemailer = require('nodemailer');
const env = require('../utils/config/config.gmail.env'); // update path if needed
const path = require('path');
const fs = require('fs');



// Booking schema
const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  bookingTime: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, default: 'pending' }, // pending, approved, cancelled
  paymentStatus: { type: String, default: 'unpaid' }, // unpaid, paid, approved
}, { timestamps: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// Create booking
// Create booking (with 3-day advance check)
router.post('/book', verifyToken, isUser, async (req, res) => {
  try {
    const { category, bookingDate, bookingTime, quantity } = req.body;
    const userId = req.user._id;

    // === Allowed categories & times ===
    const allowedCategories = ['Badminton', 'Football', 'Table Tennis', 'Basketball'];
    const allowedTimes = ['06:00 AM', '08:00 AM', '10:00 AM', '04:00 PM', '06:00 PM'];

    const selectedDate = new Date(bookingDate);
    const today = new Date();
    const timeDiff = selectedDate.getTime() - today.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);

    if (daysDiff < 3) {
      return res.status(400).json({ message: 'Booking must be made at least 3 days in advance.' });
    }

    // === Category validation ===
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        message: `Invalid category. Allowed categories: ${allowedCategories.join(', ')}`
      });
    }

    // === Time validation ===
    if (!allowedTimes.includes(bookingTime)) {
      return res.status(400).json({
        message: `Invalid booking time. Allowed times: ${allowedTimes.join(', ')}`
      });
    }

    // === Quantity validation ===
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      return res.status(400).json({
        message: 'Quantity must be between 1 and 5.'
      });
    }
    
    const newBooking = new Booking({
      userId,
      category,
      bookingDate,
      bookingTime,
      quantity,
    });
    // === Conflict Check ===
const conflict = await Booking.findOne({
  category,
  bookingDate: selectedDate,
  bookingTime,
  status: { $ne: 'cancelled' } // exclude cancelled bookings from conflict check
});

if (conflict) {
  return res.status(409).json({
    message: `The ${category} slot on ${bookingDate} at ${bookingTime} is already booked. Please choose another slot.`
  });
}


    const saved = await newBooking.save();

    const user = await User.findById(userId);
    await emailHelper.sendTextEmail(
      user.email,
      'Booking Created',
      `Hi ${user.username}, your booking for ${category} on ${bookingDate} at ${bookingTime} has been created. Status: ${saved.status}`
    );

    res.status(201).json({ message: 'Booking created', booking: saved });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Booking failed' });
  }
});

// Update booking (only if not approved)
router.put('/book/:id', verifyToken, isUser, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    console.log(req.params.id);
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.status === 'approved') {
      return res.status(403).json({ error: 'Cannot update an approved booking' });
    }

    const updates = req.body;
    Object.assign(booking, updates);

    const updated = await booking.save();

    const user = await User.findById(booking.userId);
    await emailHelper.sendTextEmail(
       user.email,
      'Booking Updated',
       `Hi ${user.username}, your booking for ${updated.category} has been updated. New details: Date ${updated.bookingDate}, Time ${updated.bookingTime}`
    );

    res.json({ message: 'Booking updated', booking: updated });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Admin approves payment
// Admin approves booking and sends PDF receipt
router.put('/admin/approve-booking/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('userId');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = 'approved';
    booking.paymentStatus = 'approved';
    const updated = await booking.save();

    const user = booking.userId;

    // === Generate PDF receipt ===
    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/fonts/Roboto-Regular.ttf',
        bold: 'node_modules/pdfmake/fonts/Roboto-Medium.ttf',
        italics: 'node_modules/pdfmake/fonts/Roboto-Italic.ttf',
        bolditalics: 'node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf',
      }
    };
    const printer = new PdfPrinter(fonts);

    const docDefinition = {
      content: [
        { text: 'Booking Receipt', style: 'header' },
        { text: `Name: ${user.username}` },
        { text: `Email: ${user.email}` },
        { text: `Category: ${updated.category}` },
        { text: `Date: ${updated.bookingDate.toDateString()}` },
        { text: `Time: ${updated.bookingTime}` },
        { text: `Quantity: ${updated.quantity}` },
        { text: `Status: ${updated.status}` },
        { text: `Payment: ${updated.paymentStatus}` },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      }
    };

    const pdfPath = path.join(__dirname, `../pdfs/${user.username}_booking_${updated._id}.pdf`);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(fs.createWriteStream(pdfPath));
    pdfDoc.end();

    // === Send email with PDF attachment ===
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.mailid,
        pass: env.app_password
      }
    });

    const mailOptions = {
      from: env.mailid,
      to: user.email,
      subject: 'Booking Approved & Receipt',
      text: `Hi ${user.username}, your booking has been approved. Please find the attached receipt.`,
      attachments: [
        {
          filename: `${user.username}_booking_${updated._id}.pdf`,
          path: pdfPath
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Booking approved and receipt emailed', booking: updated });

  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// Admin rejects booking
// Admin rejects booking
router.put('/admin/reject-booking/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true } // returns the updated document
    );

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const user = await User.findById(booking.userId);
    await emailHelper.sendTextEmail(
      user.email,
      'Booking Rejected',
      `Hi ${user.username}, your booking for ${booking.category} on ${booking.bookingDate} was rejected.`
    );

    res.json({ message: 'Booking rejected', booking });
  } catch (err) {
    console.error('Rejection error:', err);
    res.status(500).json({ error: 'Rejection failed' });
  }
});


// User cancels booking (only if not approved)
router.delete('/book/:id', verifyToken, isUser, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'approved') {
      return res.status(403).json({ error: 'Cannot cancel an approved booking' });
    }

    await booking.deleteOne();

    const user = await User.findById(booking.userId);
    await emailHelper.sendTextEmail(
       user.email,
      'Booking Cancelled',
      `Hi ${user.username}, your booking for ${booking.category} on ${booking.bookingDate} has been cancelled.`
    );

    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Cancellation failed' });
  }
});
// Admin views all booking history
router.get('/admin/all-bookings', verifyToken, isAdmin, async (req, res) => {
  try {
    const allBookings = await Booking.find()
      .populate('userId', 'username email') // only show username & email from user
      .sort({ createdAt: -1 }); // newest first

    res.json({ bookings: allBookings });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch booking history' });
  }
});
router.get('/user/slot-availability', verifyToken, async (req, res) => {
  try {
    const { bookingDate } = req.query;

    if (!bookingDate) {
      return res.status(400).json({ message: 'Booking date is required' });
    }

    const selectedDate = new Date(bookingDate);
    if (isNaN(selectedDate)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const allowedCategories = ['Badminton', 'Football', 'Table Tennis', 'Basketball'];
    const allowedTimes = ['06:00 AM', '08:00 AM', '10:00 AM', '04:00 PM', '06:00 PM'];

    // Fetch all bookings on that date (any category)
    const bookings = await Booking.find({
      bookingDate: selectedDate,
      status: { $ne: 'cancelled' }
    });

    // Prepare slots for each category
    const result = {};

    for (const category of allowedCategories) {
      const categoryBookings = bookings.filter(b => b.category === category);
      const bookedTimes = categoryBookings.map(b => b.bookingTime);

      result[category] = allowedTimes.map(time => ({
        time,
        status: bookedTimes.includes(time) ? 'Booked' : 'Available'
      }));
    }

    res.json({
      bookingDate: selectedDate.toDateString(),
      slotsByCategory: result
    });

  } catch (err) {
    console.error('Slot availability error:', err);
    res.status(500).json({ error: 'Slot check failed' });
  }
});


module.exports = { Booking, router };
