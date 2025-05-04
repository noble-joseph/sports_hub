const mongoose = require('mongoose'); // Import the Mongoose library (helper tool for MongoDB)
const UserModel = require('./models/user.model'); // Import the User model (blueprint for users) from the specified file

// Your MongoDB connection string (replace with your actual one - this is like the database address and login key)
const uri = 'mongodb+srv://noblejoseph2026:x1B42PVjhiPnppTj@cluster0.89nyh2u.mongodb.net/?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true';

// Connect to the MongoDB database using the provided URI
mongoose.connect(uri) // This is a function call that tries to connect to MongoDB
  .then(() => console.log('Connected to MongoDB for testing!')) // '.then()' runs a function if 'mongoose.connect()' is successful
  .catch(err => console.error('Error connecting to MongoDB:', err)); // '.catch()' runs a function if 'mongoose.connect()' fails

// Define an asynchronous function named 'main' - 'async' allows us to use 'await' inside
async function main() { // 'function' keyword defines a function, 'async' makes it handle time-consuming operations
  // 'try' block: Code that might potentially cause an error is placed here
  try {
    // --- Create a new user ---
    const newUser = new UserModel({ // 'new UserModel({...})' calls the UserModel function (which is like a factory) to create a new user object
      firstName: 'Test',
      lastName: 'User',
      email: 'test.user1@example.com',
      password: 'password123'
    });

    const savedUser = await newUser.save(); // 'newUser.save()' calls a function that takes the 'newUser' object and saves it to the database. 'await' makes the code wait for this function to finish
    console.log('Test user saved:', savedUser); // 'console.log()' is a function that prints information to the terminal

    // --- Find the user by email ---
    const foundUserByEmail = await UserModel.findOne({ email: 'test.user@example.com' }); // 'UserModel.findOne()' is a function that tells the database to find the first user matching the criteria
    console.log('Found user by email:', foundUserByEmail); // 'console.log()' prints the found user's information

    // --- Find all users ---
    const allUsers = await UserModel.find({}); // 'UserModel.find()' is a function that tells the database to find all users matching the criteria (empty object means all)
    console.log('All users:', allUsers); // 'console.log()' prints the list of all users

    // --- Find user by ID (you'll need an actual ID from a saved user) ---
    if (savedUser && savedUser._id) { // 'if (...)' is a way to check a condition. '&&' means "and".
      const foundUserById = await UserModel.findById(savedUser._id); // 'UserModel.findById()' is a function that tells the database to find a user by their unique ID
      console.log('Found user by ID:', foundUserById); // 'console.log()' prints the found user's information
    }

    // --- Update the user's last name ---
    const updateResult = await UserModel.updateOne( // 'UserModel.updateOne()' is a function that tells the database to update the first user matching the criteria
      { email: 'test.user@example.com' }, // Criteria to find the user to update
      { lastName: 'Updated' }              // The information to update (change lastName to 'Updated')
    );
    console.log('Update result (updateOne):', updateResult); // 'console.log()' prints the result of the update operation

    // --- Find the updated user ---
    const updatedUser = await UserModel.findOne({ email: 'test.user@example.com' }); // 'UserModel.findOne()' is used again to find the user after the update
    console.log('Updated user:', updatedUser); // 'console.log()' prints the information of the updated user

    // --- Delete the test user ---
    const deleteResult = await UserModel.deleteOne({ email: 'test.user@example.com' }); // 'UserModel.deleteOne()' is a function that tells the database to delete the first user matching the criteria
    console.log('Delete result (deleteOne):', deleteResult); // 'console.log()' prints the result of the delete operation

  } catch (error) { // 'catch (error)' defines a block that runs if any function in the 'try' block caused an error. 'error' is a variable holding the error details.
    console.error('Error during test:', error); // 'console.error()' is a function that prints an error message (usually in red) to the terminal
  } finally { // 'finally' defines a block that always runs after 'try' and 'catch', often used for cleanup
    // Disconnect from MongoDB when done
    mongoose.disconnect(); // 'mongoose.disconnect()' is a function that closes the connection to the MongoDB database
    console.log('Disconnected from MongoDB.'); // 'console.log()' prints a message confirming disconnection
  }
}

// Call the 'main' function to start the test process
main(); // 'main()' is a function call that executes the code inside the 'main' function