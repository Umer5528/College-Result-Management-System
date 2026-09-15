const rateLimit = require('express-rate-limit');

// Public submission-link routes are unauthenticated, so they get a strict
// per-IP limit to prevent abuse/scraping/brute-forcing tokens.
const publicSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this device. Please try again later.',
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
});

module.exports = { publicSubmissionLimiter, loginLimiter };
