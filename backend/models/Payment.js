const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order:             { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  displayId:         { type: String },          // Order display ID e.g. #101
  outletId:          { type: String },
  outletName:        { type: String },

  amount:            { type: Number, required: true }, // in paise (₹1 = 100 paise)
  currency:          { type: String, default: 'INR' },

  razorpayOrderId:   { type: String, required: true },
  razorpayPaymentId: { type: String, default: null },
  razorpaySignature: { type: String, default: null },

  status: {
    type: String,
    enum: ['created', 'captured', 'failed', 'refunded'],
    default: 'created'
  },
  method:            { type: String, default: null }, // upi / card / netbanking / wallet
  errorDescription:  { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
