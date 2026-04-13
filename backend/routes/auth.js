const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { register, loginStudent, loginStaff, getMe } = require('../controllers/authController');

// POST /api/auth/register      — new student account
router.post('/register', register);

// POST /api/auth/login         — student login (email + password)
router.post('/login', loginStudent);

// POST /api/auth/staff-login   — staff login (outletId + staffId + password)
router.post('/staff-login', loginStaff);

// GET  /api/auth/me            — get logged-in user info
router.get('/me', protect, getMe);

module.exports = router;
