const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItemId:  { type: mongoose.Schema.Types.ObjectId },
  itemCode:    { type: String },        // e.g. 'ik1'
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  qty:         { type: Number, default: 1, min: 1 },
  isVeg:       { type: Boolean, default: true }
});

const orderSchema = new mongoose.Schema({
  // Human-readable ID shown in the UI e.g. #101
  displayId: { type: String, unique: true },

  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:{ type: String },
  studentEmail:{ type: String },

  outletId:   { type: String, required: true },   // 'ik','hc', etc.
  outletName: { type: String, required: true },

  items:      [orderItemSchema],
  total:      { type: Number, required: true },

  // Status matches script.js flow: incoming → preparing → ready → completed
  status: {
    type: String,
    enum: ['incoming', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'incoming'
  },

  // Status timeline
  timeline: [{
    status:    { type: String },
    at:        { type: Date, default: Date.now },
    by:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Payment
  paymentMethod: {
    type: String,
    enum: ['upi', 'cash'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  // UPI payment details — student submits UTR after paying
  utrNumber:   { type: String, default: null },  // 12-digit transaction ref from GPay/PhonePe
  upiId:       { type: String, default: null },  // which UPI ID was used (outlet's)

  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-generate a sequential display ID like #101
orderSchema.pre('save', async function(next) {
  if (!this.displayId) {
    const count = await mongoose.model('Order').countDocuments();
    this.displayId = `#${101 + count}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
