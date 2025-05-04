const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { sendTextEmail } = require('../controls/emailHelper.js');
const env = require('../utils/config/config.gmail.env');
const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

// UserDetails schema
const userDetailsSchema = new mongoose.Schema({
  addressLine1: String,
  addressLine2: String,
  addressLine3: String
});
const UserDetails = mongoose.models.UserDetails || mongoose.model("UserDetails", userDetailsSchema);

// User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  email: { type: String, required: true },
  phone: { type: String, required: true },
  details: { type: mongoose.Schema.Types.ObjectId, ref: "UserDetails" },
});
const User = mongoose.models.User || mongoose.model("User", userSchema);

router.post("/register", async (req, res) => {
  try {
    let { username, password, role, email, phone, addressLine1, addressLine2, addressLine3 } = req.body;

    // === VALIDATION ===
    // === VALIDATION ===
if (!username || !password || !email || !phone) {
  return res.status(400).json({ message: "Missing required fields" });
}

const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
if (!usernameRegex.test(username)) {
  return res.status(400).json({ message: "Username must be 3-20 characters, no spaces or special characters except _" });
}

const existingUser = await User.findOne({ username });
if (existingUser) {
  return res.status(409).json({ message: "Username already exists" });
}

const emailRegex = /^(?!.*\.{2})(?!.*\.$)(?!.*@.*@)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;


if (!emailRegex.test(email)) {
  return res.status(400).json({ message: 'Invalid email format. Must end in .com, .org, .net, or .edu' });
}

if (!emailRegex.test(email)) {
  return res.status(400).json({ message: "Invalid email format" });
}

const phoneRegex = /^\d{10}$/;
if (!phoneRegex.test(phone)) {
  return res.status(400).json({ message: "Phone number must be 10 digits" });
}

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
if (!passwordRegex.test(password)) {
  return res.status(400).json({
    message: "Password must be at least 6 characters and include at least one letter, one number, and one special character"
  });
}

if (role !== "admin" && role !== "user") {
  return res.status(400).json({ message: "Role must be either 'admin' or 'user'" });
}


    // === HASH PASSWORD ===
    const hashedPassword = bcrypt.hashSync(password, 10);

    // === CREATE USER DETAILS ===
    const userDetails = await UserDetails.create({ addressLine1, addressLine2, addressLine3 });

    // === CREATE USER ===
    const newUser = await User.create({
      username,
      password: hashedPassword,
      role,
      email,
      phone,
      details: userDetails._id,
    });

    // === SEND TEXT EMAIL ===
    const subject = "Email Acknowledgement";
    const body = `Hello ${username},\n\nAccount created successfully.\n\n- Team`;
    await sendTextEmail(email, subject, body);

    // === GENERATE PDF ===
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
        { text: 'User Registration Details', style: 'header' },
        { text: `Username: ${username}` },
        { text: `Email: ${email}` },
        { text: `Phone: ${phone}` },
        { text: `Role: ${role}` },
        { text: `Address: ${addressLine1}, ${addressLine2}, ${addressLine3}` },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const pdfPath = path.join(__dirname, `../pdfs/${username}_details.pdf`);
    pdfDoc.pipe(fs.createWriteStream(pdfPath));
    pdfDoc.end();

    // === SEND EMAIL WITH ATTACHMENT ===
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.mailid,
        pass: env.app_password
      }
    });

    const mailOptions = {
      from: env.mailid,
      to: email,
      subject: "Your Registration Details",
      text: "Please find attached your registration details.",
      attachments: [{
        filename: `${username}_details.pdf`,
        path: pdfPath
      }]
    };

    await transporter.sendMail(mailOptions);

    // === FINAL RESPONSE ===
    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//module.exports = router;
module.exports = {
  router,
  User,
  UserDetails
};

