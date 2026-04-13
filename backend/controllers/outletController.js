const Outlet = require('../models/Outlet');

// ── GET /api/outlets  ─────────────────────────── public
exports.getAll = async (req, res, next) => {
  try {
    const outlets = await Outlet.find({});
    res.json({ success: true, outlets });
  } catch (err) { next(err); }
};

// ── GET /api/outlets/:outletId  ───────────────── public
exports.getOne = async (req, res, next) => {
  try {
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });
    res.json({ success: true, outlet });
  } catch (err) { next(err); }
};

// ── PATCH /api/outlets/:outletId/status  ─────── staff only
// Toggles between open / closed (matches the toggle switch in staffPage)
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // 'open' | 'busy' | 'closed'
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });
    outlet.status = status;
    await outlet.save();
    res.json({ success: true, status: outlet.status });
  } catch (err) { next(err); }
};

// ── POST /api/outlets/:outletId/menu  ─────────── staff only (Add Item modal)
exports.addItem = async (req, res, next) => {
  try {
    const { name, description, price, category, isVeg, inStock } = req.body;
    if (!name || !price || !category)
      return res.status(400).json({ success: false, message: 'name, price and category are required' });

    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });

    const item = { name, description, price, category, isVeg: isVeg !== false, inStock: inStock !== false };
    outlet.menu.push(item);
    // Add category to list if new
    if (!outlet.categories.includes(category)) outlet.categories.push(category);
    await outlet.save();

    res.status(201).json({ success: true, item: outlet.menu[outlet.menu.length - 1] });
  } catch (err) { next(err); }
};

// ── PATCH /api/outlets/:outletId/menu/:itemId  ── staff only (toggle stock / edit price)
exports.updateItem = async (req, res, next) => {
  try {
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });

    const item = outlet.menu.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });

    Object.assign(item, req.body);
    await outlet.save();
    res.json({ success: true, item });
  } catch (err) { next(err); }
};

// ── DELETE /api/outlets/:outletId/menu/:itemId  ─ staff only
exports.deleteItem = async (req, res, next) => {
  try {
    const outlet = await Outlet.findOne({ outletId: req.params.outletId });
    if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });

    outlet.menu = outlet.menu.filter(i => i._id.toString() !== req.params.itemId);
    await outlet.save();
    res.json({ success: true, message: 'Item removed' });
  } catch (err) { next(err); }
};
