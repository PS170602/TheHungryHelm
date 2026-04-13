const mongoose = require('mongoose');

// Matches the item shape in script.js: {id,n,d,p,c,v,stock}
const menuItemSchema = new mongoose.Schema({
  itemCode:    { type: String },          // original id from frontend e.g. 'ik1'
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, required: true },  // Mains, Rice, Breads, Noodles, etc.
  isVeg:       { type: Boolean, default: true },
  inStock:     { type: Boolean, default: true },
  imageUrl:    { type: String, default: null }
});

// Matches outlet shape in script.js: {id,name,icon,cuisine,wait,status,...}
const outletSchema = new mongoose.Schema({
  outletId:    { type: String, required: true, unique: true }, // 'ik','hc','ss','sn','hs'
  name:        { type: String, required: true },
  icon:        { type: String, default: '🍴' },
  cuisine:     { type: String, default: '' },
  waitTime:    { type: String, default: '10–15 min' },
  status:      { type: String, enum: ['open','busy','closed'], default: 'open' },
  color:       { type: String, default: '#e8f5e8' },
  dotColor:    { type: String, default: '#2d7a2d' },
  categories:  [{ type: String }],
  menu:        [menuItemSchema],

  // UPI Payment — filled in manually by you after collecting from each outlet owner
  upiId:       { type: String, default: null },  // e.g. 'infinitykitchens@ybl'
  upiQrUrl:    { type: String, default: null },  // path to QR image e.g. 'uploads/qr/ik.png'
  upiName:     { type: String, default: null },  // display name on payment screen e.g. 'Infinity Kitchens'
}, { timestamps: true });

module.exports = mongoose.model('Outlet', outletSchema);
