const express = require('express');
const router = express.Router();
const generateUserPDF = require('../utils/generateUserPDF');
const sendTextEmail = require('../controls/emailHelper');
const path = require('path');

router.get('/send-users-pdf', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../pdfs/registered_users.pdf');
    await generateUserPDF(filePath); // Generate the PDF

    const subject = "Registered Users PDF";
    const body = "Attached is the latest list of registered users.";
    const to = "noble.21ubc149@mariancollege.org"; // Or use admin email

    await sendTextEmail(to, subject, body, filePath);

    res.status(200).json({ message: "PDF generated and email sent" });
  } catch (err) {
    console.error("PDF generation/email error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router; // ✅ VERY IMPORTANT
