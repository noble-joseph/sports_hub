const fs = require('fs');
const path = require('path');

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('./middleware');
const {Booking} = require('./bookingRoute');
const PdfPrinter = require('pdfmake');
const nodemailer = require('nodemailer');
const env = require('../utils/config/config.gmail.env'); // update path if needed
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');



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
  status: { type: String, default: 'active' },
  details: { type: mongoose.Schema.Types.ObjectId, ref: 'UserDetails' },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

// ✅ Admin-only route to list all users with address
router.get('/admin/all-users', isAdmin, async (req, res) => {
  try {
                // exclude password field

    const users = await User.find({role: { $ne: 'admin' }}, { password: 0 }).populate('details');
    res.status(200).json(users);
  } catch (error) {
    console.error('Admin fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/admin/all-bookings', isAdmin, async (req, res) => {
  try {
    const { status, sort = 'desc' } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('userId', 'username email')
      .sort({ bookingDate: sort === 'asc' ? 1 : -1 });

    res.status(200).json(bookings);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/admin/bookings/full-report', isAdmin, async (req, res) => {
  try {
    const { status, sort = 'desc' } = req.query; // Get status and sort from query params

    const filter = {};
    if (status) {
      filter.status = status; // Filter by the provided status (approved, rejected, etc.)
    }

    // Fetch bookings based on the status and sort order
    const allBookings = await Booking.find(filter)
      .populate('userId', 'username email')
      .sort({ createdAt: sort === 'asc' ? 1 : -1 });

    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/fonts/Roboto-Regular.ttf',
        bold: 'node_modules/pdfmake/fonts/Roboto-Medium.ttf',
        italics: 'node_modules/pdfmake/fonts/Roboto-Italic.ttf',
        bolditalics: 'node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf',
      },
    };
    const printer = new PdfPrinter(fonts);

    const formatSection = (title, bookings) => {
      const body = [
        [
          { text: 'User', bold: true },
          { text: 'Email', bold: true },
          { text: 'Category', bold: true },
          { text: 'Date', bold: true },
          { text: 'Time', bold: true },
          { text: 'Qty', bold: true },
          { text: 'Status', bold: true },
          { text: 'Payment', bold: true },
        ],
      ];

      bookings.forEach(b => {
        body.push([
          b.userId?.username || 'N/A',
          b.userId?.email || 'N/A',
          b.category || 'N/A',
          b.bookingDate ? new Date(b.bookingDate).toDateString() : 'N/A',
          b.bookingTime || 'N/A',
          (b.quantity ?? 'N/A').toString(),
          b.status || 'N/A',
          b.paymentStatus || 'N/A',
        ]);
      });

      return [
        { text: `${title} (${bookings.length})`, style: 'sectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*', '*', '*', '*', '*'],
            body,
          },
          margin: [0, 5, 0, 15],
        },
      ];
    };

    const docDefinition = {
      content: [
        { text: 'Full Booking Report', style: 'header' },
        ...formatSection(
          `${typeof status === 'string' ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'} Bookings`,
          allBookings
        ),
      ],
      styles: {
        header: { fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
        sectionHeader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
      },
    };

    // Ensure /pdfs folder exists
    const pdfDir = path.join(__dirname, '../pdfs');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);

    const fileName = `Booking_Report_${status || 'all'}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const stream = fs.createWriteStream(filePath);

    pdfDoc.pipe(stream);
    pdfDoc.end();

    // Wait until file is written, then send download
    stream.on('finish', () => {
      res.download(filePath, fileName);
    });

    stream.on('error', err => {
      console.error('Stream error:', err);
      res.status(500).json({ error: 'Error writing PDF file' });
    });

  } catch (err) {
    console.error('Full report error:', err);
    res.status(500).json({ error: 'Failed to generate full booking report' });
  }
});
// Booking statistics route for admin dashboard
router.get('/admin/bookings/stats', isAdmin, async (req, res) => {
  try {
    const [statusCounts, dailyCounts, totalCount] = await Promise.all([
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Booking.countDocuments()
    ]);

    const formattedStatusCounts = {
      approved: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
    };

    statusCounts.forEach(item => {
      formattedStatusCounts[item._id] = item.count;
    });

    const formattedDailyCounts = dailyCounts.map(item => ({
      date: item._id,
      count: item.count
    }));

    res.status(200).json({
      totalBookings: totalCount,
      statusCounts: formattedStatusCounts,
      dailyCounts: formattedDailyCounts
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch booking statistics' });
  }
});
router.get('/admin/bookings/status-graph', isAdmin, async (req, res) => {
  try {
    const width = 800;
    const height = 400;
    const chartCallback = (ChartJS) => {
      // Global config if needed
    };

    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

    // Get status counts
    const statusCounts = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const labels = statusCounts.map(s => s._id);
    const data = statusCounts.map(s => s.count);

    const configuration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Bookings by Status',
            data,
            backgroundColor: [
              '#4caf50', // approved
              '#ffc107', // pending
              '#f44336', // rejected
              '#9e9e9e', // cancelled
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Booking Status Breakdown'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    res.set('Content-Type', 'image/png');
    res.send(image);

  } catch (err) {
    console.error('Graph error:', err);
    res.status(500).json({ error: 'Failed to generate graph image' });
  }
});
// ✅ Route: Admin - Category-wise Booking Graph
router.get('/admin/bookings/category-graph', isAdmin, async (req, res) => {
  try {
    const width = 800;
    const height = 400;
    const chartCallback = (ChartJS) => {};

    const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

    const categoryStats = await Booking.aggregate([
      { 
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const labels = categoryStats.map(c => c._id);
    const data = categoryStats.map(c => c.count);

    const configuration = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Bookings per Category',
          data,
          backgroundColor: '#42a5f5',
          borderColor: '#1e88e5',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Category-wise Bookings'
          }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    res.set('Content-Type', 'image/png');
    res.send(image);

  } catch (err) {
    console.error('Category graph error:', err);
    res.status(500).json({ error: 'Failed to generate category graph' });
  }
});





module.exports = router;