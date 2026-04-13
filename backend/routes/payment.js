const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getUpiDetails, confirmPayment, confirmCash,
  getHistory, getOutletSummary, updateUpiDetails
} = require('../controllers/paymentController');

// ── Student ────────────────────────────────────────────────────────────────

// GET  /api/payment/upi-details/:outletId
//      Called when student taps "Pay Online" — returns UPI ID + QR URL
router.get('/upi-details/:outletId', protect, authorize('student'), getUpiDetails);

// POST /api/payment/confirm
//      Student submits UTR number after paying via UPI app / scanning QR
//      Body: { orderId, utrNumber, upiId }
router.post('/confirm', protect, authorize('student'), confirmPayment);

// POST /api/payment/cash
//      Student chooses to pay cash at counter
//      Body: { orderId }
router.post('/cash', protect, authorize('student'), confirmCash);

// GET  /api/payment/history
//      Student's paid order history (Voyage Log tab)
router.get('/history', protect, authorize('student'), getHistory);

// ── Staff ──────────────────────────────────────────────────────────────────

// GET  /api/payment/outlet/:outletId/summary
//      Today's revenue, order count, top items (Reports tab)
router.get('/outlet/:outletId/summary', protect, authorize('staff'), getOutletSummary);

// PATCH /api/payment/outlet/:outletId/upi
//       Staff updates their outlet's UPI ID and QR image URL
//       Body: { upiId, upiName, upiQrUrl }
router.patch('/outlet/:outletId/upi', protect, authorize('staff'), updateUpiDetails);

module.exports = router;
