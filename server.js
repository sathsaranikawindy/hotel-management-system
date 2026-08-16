const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotel_booking_secret_key_2026_super_secure';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database File Paths
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');

// Helper functions for reading/writing JSON data
function readData(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired session token.' });
    }
    req.user = user;
    next();
  });
}

// Optional Auth middleware (populates req.user if token provided)
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) req.user = user;
      next();
    });
  } else {
    next();
  }
}

// ==========================================
// API 1: USER REGISTRATION SERVICE
// ==========================================
/**
 * @route POST /api/auth/register
 * @desc  Registers a new guest or user
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Input Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const users = readData(USERS_FILE);
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    // Password Hashing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: 'usr_' + Date.now(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: passwordHash,
      role: role || 'guest',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeData(USERS_FILE, users);

    // Generate JWT Token for immediate login
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token: token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
});

// ==========================================
// API 2: USER LOGIN SERVICE
// ==========================================
/**
 * @route POST /api/auth/login
 * @desc  Authenticates user & returns JWT token
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const users = readData(USERS_FILE);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc  Gets profile of currently logged-in user
 */
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const users = readData(USERS_FILE);
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(444).json({ success: false, message: 'User account not found.' });
  }

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

// ==========================================
// API 3: GUEST REVIEW AND RATING SERVICE
// ==========================================

/**
 * @route POST /api/reviews
 * @desc  Create a new guest review & rating for a room/hotel
 */
app.post('/api/reviews', authenticateToken, (req, res) => {
  try {
    const { roomId, roomName, rating, title, comment } = req.body;

    if (!roomId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Room ID, rating (1-5), and comment are required.'
      });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be a number between 1 and 5 stars.'
      });
    }

    const reviews = readData(REVIEWS_FILE);

    const newReview = {
      id: 'rev_' + Date.now(),
      roomId: roomId,
      roomName: roomName || 'Standard Luxury Room',
      userId: req.user.id,
      userName: req.user.name,
      rating: numericRating,
      title: title ? title.trim() : 'Guest Review',
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    };

    reviews.unshift(newReview); // Newest first
    writeData(REVIEWS_FILE, reviews);

    res.status(201).json({
      success: true,
      message: 'Guest review submitted successfully!',
      review: newReview
    });

  } catch (error) {
    console.error('Create Review Error:', error);
    res.status(500).json({ success: false, message: 'Failed to save review.' });
  }
});

/**
 * @route GET /api/reviews
 * @desc  Get all reviews (Optionally filtered by roomId)
 */
app.get('/api/reviews', (req, res) => {
  try {
    let reviews = readData(REVIEWS_FILE);
    const { roomId } = req.query;

    if (roomId) {
      reviews = reviews.filter(r => r.roomId === roomId);
    }

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews: reviews
    });
  } catch (error) {
    console.error('Fetch Reviews Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reviews.' });
  }
});

/**
 * @route GET /api/reviews/summary/:roomId
 * @desc  Get rating statistics and summary metrics for a specific room
 */
app.get('/api/reviews/summary/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const reviews = readData(REVIEWS_FILE).filter(r => r.roomId === roomId);

    if (reviews.length === 0) {
      return res.status(200).json({
        success: true,
        roomId: roomId,
        totalReviews: 0,
        averageRating: 0,
        starBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
    }

    const totalReviews = reviews.length;
    const sumRatings = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const averageRating = (sumRatings / totalReviews).toFixed(1);

    const starBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (starBreakdown[r.rating] !== undefined) {
        starBreakdown[r.rating] += 1;
      }
    });

    res.status(200).json({
      success: true,
      roomId: roomId,
      totalReviews: totalReviews,
      averageRating: parseFloat(averageRating),
      starBreakdown: starBreakdown
    });
  } catch (error) {
    console.error('Review Summary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to compute rating summary.' });
  }
});

/**
 * @route DELETE /api/reviews/:id
 * @desc  Delete a review by ID (Owner or Admin only)
 */
app.delete('/api/reviews/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    let reviews = readData(REVIEWS_FILE);
    const reviewIndex = reviews.findIndex(r => r.id === id);

    if (reviewIndex === -1) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const review = reviews[reviewIndex];

    // Authorization check
    if (review.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only delete your own reviews.' });
    }

    reviews.splice(reviewIndex, 1);
    writeData(REVIEWS_FILE, reviews);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Review Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏨 Hotel Booking System APIs running on port ${PORT}`);
  console.log(`🌐 Web UI Dashboard: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
