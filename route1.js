const User = require('../models/user');
const UserDetails = require('../models/userDetails');

async function insertUser() {
  const details = new UserDetails({ address: 'abc123abc'});
  await details.save();

  const user = new User({
    name: 'Noble',
    email: 'noblejoseph@gmail.com',
    userDetails: details._id
  });

  const users = await User.find();
  console.log('📦 All users in DB:', users);

  await user.save();
  console.log('User inserted ✅');
  console.log(user);
  console.log(details);
}

module.exports = insertUser;
