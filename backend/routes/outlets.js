const router = require('express').Router();
const { protect, authorize, ownOutlet } = require('../middleware/auth');
const {
  getAll, getOne, updateStatus, addItem, updateItem, deleteItem
} = require('../controllers/outletController');

// ── Public ─────────────────────────────────────────────────
// GET  /api/outlets              — all outlets + menus (for nautical chart)
router.get('/', getAll);

// GET  /api/outlets/:outletId    — single outlet + full menu
router.get('/:outletId', getOne);

// ── Staff only ─────────────────────────────────────────────
// PATCH /api/outlets/:outletId/status        — open / busy / closed toggle
router.patch('/:outletId/status',           protect, authorize('staff'), ownOutlet, updateStatus);

// POST  /api/outlets/:outletId/menu          — add new item (Add Item modal)
router.post('/:outletId/menu',              protect, authorize('staff'), ownOutlet, addItem);

// PATCH /api/outlets/:outletId/menu/:itemId  — edit item (price, stock toggle)
router.patch('/:outletId/menu/:itemId',     protect, authorize('staff'), ownOutlet, updateItem);

// DELETE /api/outlets/:outletId/menu/:itemId — remove item
router.delete('/:outletId/menu/:itemId',    protect, authorize('staff'), ownOutlet, deleteItem);

module.exports = router;
