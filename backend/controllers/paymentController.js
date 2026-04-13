const Order  = require('../models/Order');
const Outlet = require('../models/Outlet');

// ── GET /api/payment/upi-details/:outletId ───────────────────
// Frontend calls this when student taps "Pay Online"
// Returns the outlet's UPI ID, UPI name and QR image URL
exports.getUpiDetails = async (req, res, next) => {
  try {
    const outlet = await Outlet.findOne({ outletId: req.params.outletId })
      .select('name upiId upiQrUrl upiName');

    if (!outlet)
      return res.status(404).json({ success: false, message: 'Outlet not found' });

    if (!outlet.upiId)
      return res.status(404).json({ success: false, message: 'This outlet has not set up UPI payment yet' });

    res.json({
      success:  true,
      upiId:    outlet.upiId,
      upiName:  outlet.upiName || outlet.name,
      upiQrUrl: outlet.upiQrUrl,
      // Ready-made UPI deep link — frontend uses this directly for the "Open Payment App" button
      // window.location.href = upiLink  →  opens GPay / PhonePe / Paytm on the device
      upiLink: null // built dynamically in frontend with the order amount
    });
  } catch (err) { next(err); }
};

// ── POST /api/payment/confirm ────────────────────────────────
// Called after student has paid and enters their UTR number
// Marks the order as paid and stores the UTR for staff to verify
exports.confirmPayment = async (req, res, next) => {
  try {
    const { orderId, utrNumber, upiId } = req.body;

    if (!orderId || !utrNumber)
      return res.status(400).json({ success: false, message: 'orderId and utrNumber are required' });

    // Basic UTR format check — must be 12 digits
    if (!/^\d{12}$/.test(utrNumber))
      return res.status(400).json({ success: false, message: 'UTR number must be exactly 12 digits' });

    const order = await Order.findById(orderId);
    if (!order)
      return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.student.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not your order' });

    if (order.paymentStatus === 'paid')
      return res.status(400).json({ success: false, message: 'Order already marked as paid' });

    order.paymentStatus = 'paid';
    order.paymentMethod = 'upi';
    order.utrNumber     = utrNumber;
    order.upiId         = upiId || null;
    await order.save();

    res.json({ success: true, message: 'Payment confirmed', order });
  } catch (err) { next(err); }
};

// ── POST /api/payment/cash ───────────────────────────────────
// Student chooses to pay cash at counter — order goes through without UTR
exports.confirmCash = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId)
      return res.status(400).json({ success: false, message: 'orderId is required' });

    const order = await Order.findById(orderId);
    if (!order)
      return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.student.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not your order' });

    order.paymentMethod = 'cash';
    order.paymentStatus = 'pending'; // staff marks paid when cash is collected at counter
    await order.save();

    res.json({ success: true, message: 'Order placed — pay cash at counter', order });
  } catch (err) { next(err); }
};

// ── GET /api/payment/history ─────────────────────────────────
// Student's full payment history (Voyage Log tab)
exports.getHistory = async (req, res, next) => {
  try {
    const orders = await Order.find({
      student:       req.user._id,
      paymentStatus: 'paid'
    }).sort('-createdAt');

    res.json({ success: true, count: orders.length, orders });
  } catch (err) { next(err); }
};

// ── GET /api/payment/outlet/:outletId/summary ────────────────
// Staff reports tab — today's revenue, order count, top items
exports.getOutletSummary = async (req, res, next) => {
  try {
    if (req.user.role === 'staff' && req.user.outletId !== req.params.outletId)
      return res.status(403).json({ success: false, message: 'Not your outlet' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      outletId:      req.params.outletId,
      paymentStatus: 'paid',
      createdAt:     { $gte: startOfDay }
    });

    const totalRevenue  = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders   = orders.length;
    const avgOrderValue = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;

    // Count UPI vs cash split
    const upiOrders  = orders.filter(o => o.paymentMethod === 'upi').length;
    const cashOrders = orders.filter(o => o.paymentMethod === 'cash').length;

    // Top items
    const itemMap = {};
    orders.forEach(o => o.items.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, orders: 0, revenue: 0 };
      itemMap[i.name].orders  += i.qty;
      itemMap[i.name].revenue += i.price * i.qty;
    }));
    const topItems = Object.values(itemMap)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);

    res.json({
      success: true,
      summary: { totalRevenue, totalOrders, avgOrderValue, upiOrders, cashOrders, topItems }
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/payment/outlet/:outletId/upi ──────────────────
// Staff updates their outlet's UPI details
exports.updateUpiDetails = async (req, res, next) => {
  try {
    if (req.user.outletId !== req.params.outletId)
      return res.status(403).json({ success: false, message: 'Not your outlet' });

    const { upiId, upiName, upiQrUrl } = req.body;
    if (!upiId)
      return res.status(400).json({ success: false, message: 'upiId is required' });

    const outlet = await Outlet.findOneAndUpdate(
      { outletId: req.params.outletId },
      { upiId, upiName, upiQrUrl },
      { new: true }
    ).select('name upiId upiName upiQrUrl');

    res.json({ success: true, outlet });
  } catch (err) { next(err); }
};
