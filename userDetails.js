// models/userDetails.js
const mongoose = require('mongoose');

const userDetailsSchema = new mongoose.Schema({
  address: { type: String },
  phone: { type: String },
  dob: { type: Date }
});

const UserDetails = mongoose.model('UserDetails', userDetailsSchema);
module.exports = UserDetails;
