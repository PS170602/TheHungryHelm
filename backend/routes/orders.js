const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  create, getMyOrders, getOne, getOutletOrders, updateStatus
} = require('../controllers/orderController');

// ── Student ────────────────────────────────────────────────
// POST /api/orders              — place an order (after checkout confirm)
router.post('/',      protect, authorize('student'), create);

// GET  /api/orders/my           — student's own orders (My Orders + Voyage Log tabs)
router.get('/my',     protect, authorize('student'), getMyOrders);

// ── Staff ──────────────────────────────────────────────────
// GET  /api/orders/outlet/:outletId   — all orders for an outlet (Live Orders tab)
//      ?status=incoming|preparing|ready|completed
//      ?today=false  to get all-time orders
router.get('/outlet/:outletId',  protect, authorize('staff'), getOutletOrders);

// PATCH /api/orders/:id/status  — advance order: accept|ready|complete|cancel
router.patch('/:id/status',      protect, authorize('staff'), updateStatus);

// ── Shared ─────────────────────────────────────────────────
// GET  /api/orders/:id          — single order detail
router.get('/:id',    protect, getOne);

module.exports = router;
