const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    // Both students and staff must have @bennett.edu.in
    validate: {
      validator: v => v.endsWith('@bennett.edu.in'),
      message:   'Only @bennett.edu.in email addresses are allowed'
    }
  },
  password:     { type: String, required: true, minlength: 6, select: false },
  role:         { type: String, enum: ['student', 'staff'], default: 'student' },

  // Students
  enrollmentNo: { type: String, trim: true, default: null },
  phone:        { type: String, trim: true, default: null },

  // Staff — matches outlet IDs in the UI: 'ik','hc','ss','sn','hs'
  outletId:     { type: String, default: null },
  staffId:      { type: String, trim: true, default: null }, // e.g. IK-STAFF-001

  isActive:     { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
