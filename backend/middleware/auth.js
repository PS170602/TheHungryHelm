const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Attach authenticated user to req.user
exports.protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user)
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token is invalid or expired' });
  }
};

// Role guard: authorize('student') or authorize('staff')
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: `Access denied for role '${req.user.role}'` });
  next();
};

// Staff can only touch their own outlet
exports.ownOutlet = (req, res, next) => {
  const outletId = req.params.outletId || req.body.outletId;
  if (req.user.role === 'staff' && req.user.outletId !== outletId)
    return res.status(403).json({ success: false, message: 'You can only manage your own outlet' });
  next();
};
