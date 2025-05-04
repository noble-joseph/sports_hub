const jwt = require("jsonwebtoken");
//const User = require("../models/userSchema");
const { User } = require("../routes/userRegister");


const JWT_SECRET = "SecretKey123";

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const isAdmin = async (req, res, next) => {
  await verifyToken(req, res, () => {
    if (req.user.role === "admin") {
      next();
    } else {
      return res.status(403).json({ message: "Admins only" });
    }
  });
};

const isUser = async (req, res, next) => {
  await verifyToken(req, res, () => {
    if (req.user.role === "user") {
      next();
    } else {
      return res.status(403).json({ message: "Users only" });
    }
  });
};

module.exports = {
  verifyToken,
  isAdmin,
  isUser
};
