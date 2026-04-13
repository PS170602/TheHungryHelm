const Order  = require('../models/Order');
const Outlet = require('../models/Outlet');

// ── POST /api/orders  ─────────────────────────── student places order
// Called from confirmOrder() in script.js after payment checkout
exports.create = async (req, res, next) => {
  try {
    const { outletId, items } = req.body;
    // items: [{ itemId (mongo _id), itemCode, qty }]
    if (!outletId || !items?.length)
      return res.status(400).json({ success: false, message: 'outletId and items are required' });

    const outlet = await Outlet.findOne({ outletId });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });
    if (outlet.status === 'closed')
      return res.status(400).json({ success: false, message: 'This outlet is currently closed' });

    // Build order items from DB — never trust prices from client
    let total = 0;
    const orderItems = items.map(({ itemId, qty = 1 }) => {
      const mi = outlet.menu.id(itemId);
      if (!mi) throw Object.assign(new Error(`Item ${itemId} not found`), { statusCode: 400 });
      if (!mi.inStock) throw Object.assign(new Error(`${mi.name} is out of stock`), { statusCode: 400 });
      total += mi.price * qty;
      return { menuItemId: mi._id, itemCode: mi.itemCode, name: mi.name, price: mi.price, qty, isVeg: mi.isVeg };
    });

    const order = await Order.create({
      student:      req.user._id,
      studentName:  req.user.name,
      studentEmail: req.user.email,
      outletId,
      outletName:   outlet.name,
      items:        orderItems,
      total,
      timeline:     [{ status: 'incoming', by: req.user._id }]
    });

    res.status(201).json({ success: true, order });
  } catch (err) { next(err); }
};

// ── GET /api/orders/my  ───────────────────────── student: own orders (for My Orders tab)
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ student: req.user._id }).sort('-createdAt');
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

// ── GET /api/orders/:id  ──────────────────────── single order detail
exports.getOne = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('student', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    // Students can only see their own orders
    if (req.user.role === 'student' && order.student._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, order });
  } catch (err) { next(err); }
};

// ── GET /api/orders/outlet/:outletId  ─────────── staff: all orders for their outlet
// Powers the Live Orders (incoming queue + in-progress) in staffPage
exports.getOutletOrders = async (req, res, next) => {
  try {
    const filter = { outletId: req.params.outletId };
    // Optional: ?status=incoming or ?status=preparing etc.
    if (req.query.status) filter.status = req.query.status;
    // Default: only today's orders for the live view
    if (req.query.today !== 'false') {
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      filter.createdAt = { $gte: startOfDay };
    }
    const orders = await Order.find(filter).populate('student', 'name email').sort('-createdAt');
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

// ── PATCH /api/orders/:id/status  ─────────────── staff advances order status
// Maps to staffAct() in script.js: accept → preparing, ready → ready, complete → completed
exports.updateStatus = async (req, res, next) => {
  try {
    const { action } = req.body;
    // action: 'accept' | 'ready' | 'complete' | 'cancel'
    const statusMap = { accept: 'preparing', ready: 'ready', complete: 'completed', cancel: 'cancelled' };
    const newStatus = statusMap[action];
    if (!newStatus)
      return res.status(400).json({ success: false, message: `Invalid action. Use: ${Object.keys(statusMap).join(', ')}` });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'staff' && order.outletId !== req.user.outletId)
      return res.status(403).json({ success: false, message: 'Not your outlet' });

    order.status = newStatus;
    order.timeline.push({ status: newStatus, by: req.user._id });
    await order.save();
    res.json({ success: true, order });
  } catch (err) { next(err); }
};
