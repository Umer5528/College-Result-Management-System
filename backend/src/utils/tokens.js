const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAuthToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const verifyAuthToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Cryptographically secure random token for public submission links.
// 32 bytes -> 64 hex chars, unguessable.
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

module.exports = { generateAuthToken, verifyAuthToken, generateSecureToken };
