const mongoose = require('mongoose');

// First define userDetailsSchema
const userDetailsSchema = new mongoose.Schema({
  address: String
});

// Then create a model for it
const UserDetails = mongoose.models.UserDetails || mongoose.model('UserDetails', userDetailsSchema);
//const User = mongoose.models.User || mongoose.model('User', userSchema);


// Now define userSchema and reference UserDetails
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  userDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserDetails'
  }
});

// Fix: Use check to avoid OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Export the models
module.exports = { User, UserDetails };
