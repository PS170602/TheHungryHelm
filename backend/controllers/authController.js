const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const respond = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:           user._id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      outletId:     user.outletId,
      staffId:      user.staffId,
      enrollmentNo: user.enrollmentNo,
      phone:        user.phone
    }
  });
};

// ── POST /api/auth/register  (students and staff) ───────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, enrollmentNo, phone, role, outletId, staffId } = req.body;
    
    // Determine if this is staff or student registration
    const userRole = role || 'student';
    
    if (userRole === 'student') {
      // Student registration
      if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'name, email and password are required' });

      const user = await User.create({ name, email, password, enrollmentNo, phone, role: 'student' });
      respond(user, 201, res);
    } else if (userRole === 'staff') {
      // Staff registration
      if (!name || !email || !password || !outletId || !staffId)
        return res.status(400).json({ success: false, message: 'name, email, password, outletId and staffId are required for staff registration' });

      const user = await User.create({ name, email, password, phone, outletId, staffId, role: 'staff' });
      respond(user, 201, res);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be student or staff' });
    }
  } catch (err) { next(err); }
};

// ── POST /api/auth/login  (students) ─────────────────────────
exports.loginStudent = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email, role: 'student' }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is deactivated' });

    respond(user, 200, res);
  } catch (err) { next(err); }
};

// ── POST /api/auth/staff-login ───────────────────────────────
// Matches the staffForm in index.html: outlet select + staffId + password
exports.loginStaff = async (req, res, next) => {
  try {
    const { outletId, staffId, password } = req.body;
    if (!outletId || !staffId || !password)
      return res.status(400).json({ success: false, message: 'outletId, staffId and password are required' });

    const user = await User.findOne({ outletId, staffId, role: 'staff' }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid staff credentials' });

    respond(user, 200, res);
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ─────────────────────────────────────────
exports.getMe = (req, res) => {
  res.json({ success: true, user: req.user });
};
