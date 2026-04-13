/**
 * SEED SCRIPT
 * Run once to populate MongoDB with the 5 outlets + menus from script.js
 * and create demo staff accounts (one per outlet).
 *
 * Usage:
 *   cp .env.example .env        # fill in your MONGO_URI
 *   npm run seed
 */
require('dotenv').config();
const mongoose  = require('mongoose');
const connectDB = require('./db');
const Outlet    = require('../models/Outlet');
const User      = require('../models/User');

// ─── Outlet + menu data (mirrors OUTLETS array in script.js exactly) ───────
const OUTLETS_DATA = [
  {
    outletId: 'ik', name: 'Infinity Kitchens', icon: '🍛',
    cuisine: 'North Indian · Thalis · Curries', waitTime: '15–20 min',
    status: 'open', color: '#e8f5e8', dotColor: '#2d7a2d',
    // ── Replace these with real values from the outlet owner ──
    upiId:    'infinitykitchens@ybl',
    upiName:  'Infinity Kitchens',
    upiQrUrl: '/uploads/qr/ik.png',   // place actual QR image at uploads/qr/ik.png
    categories: ['Mains','Rice','Breads','Drinks'],
    menu: [
      { itemCode:'ik1', name:'Butter Chicken',       description:'Tomato cream gravy, tender chicken',          price:150, category:'Mains',  isVeg:false, inStock:true  },
      { itemCode:'ik2', name:'Dal Makhani',           description:'Overnight slow-cooked black lentils',         price:110, category:'Mains',  isVeg:true,  inStock:true  },
      { itemCode:'ik3', name:'Paneer Butter Masala',  description:'Cottage cheese in aromatic tomato gravy',     price:130, category:'Mains',  isVeg:true,  inStock:true  },
      { itemCode:'ik4', name:'Shahi Paneer',          description:'Rich cashew-cream gravy, saffron',            price:140, category:'Mains',  isVeg:true,  inStock:false },
      { itemCode:'ik5', name:'Chicken Biryani',       description:'Dum-cooked basmati, whole spices',            price:175, category:'Rice',   isVeg:false, inStock:true  },
      { itemCode:'ik6', name:'Veg Biryani',           description:'Garden vegetables, aromatic dum rice',        price:130, category:'Rice',   isVeg:true,  inStock:true  },
      { itemCode:'ik7', name:'Jeera Rice',            description:'Cumin-tempered basmati',                      price:60,  category:'Rice',   isVeg:true,  inStock:true  },
      { itemCode:'ik8', name:'Butter Naan',           description:'Tandoor-baked, fresh butter',                 price:15,  category:'Breads', isVeg:true,  inStock:true  },
      { itemCode:'ik9', name:'Laccha Paratha',        description:'Layered whole-wheat, ghee-finished',          price:20,  category:'Breads', isVeg:true,  inStock:true  },
      { itemCode:'ik10',name:'Masala Chai',           description:'Ginger, cardamom, strong brew',               price:20,  category:'Drinks', isVeg:true,  inStock:true  },
    ]
  },
  {
    outletId: 'hc', name: 'House of Chow', icon: '🍜',
    cuisine: 'Chinese · Noodles · Fried Rice', waitTime: '10–15 min',
    status: 'open', color: '#fef5e7', dotColor: '#b8860b',
    upiId:    'houseofchow@ybl',
    upiName:  'House of Chow',
    upiQrUrl: '/uploads/qr/hc.png',
    categories: ['Noodles','Rice','Soups','Sides'],
    menu: [
      { itemCode:'hc1', name:'Veg Hakka Noodles',    description:'Stir-fried, chilli-soy toss',                 price:90,  category:'Noodles', isVeg:true,  inStock:true  },
      { itemCode:'hc2', name:'Chicken Chow Mein',    description:'Wok-tossed, scallions, dark soy',             price:120, category:'Noodles', isVeg:false, inStock:true  },
      { itemCode:'hc3', name:'Schezwan Noodles',     description:'Fiery Schezwan sauce, loaded veggies',        price:100, category:'Noodles', isVeg:true,  inStock:true  },
      { itemCode:'hc4', name:'Fried Rice',           description:'Egg fried, seasonal vegetables',              price:95,  category:'Rice',    isVeg:true,  inStock:true  },
      { itemCode:'hc5', name:'Chicken Fried Rice',   description:'Wok-tossed chicken, scallions',               price:120, category:'Rice',    isVeg:false, inStock:true  },
      { itemCode:'hc6', name:'Manchow Soup',         description:'Thick spiced broth, crispy noodles',          price:60,  category:'Soups',   isVeg:true,  inStock:true  },
      { itemCode:'hc7', name:'Spring Rolls (3)',     description:'Crispy, spiced vegetable filling',            price:70,  category:'Sides',   isVeg:true,  inStock:true  },
      { itemCode:'hc8', name:'Veg Momos (6)',        description:'Steamed dumplings, chilli dip',               price:80,  category:'Sides',   isVeg:true,  inStock:true  },
    ]
  },
  {
    outletId: 'ss', name: 'Southern Stories', icon: '🌶️',
    cuisine: 'South Indian · Dosas · Idli', waitTime: '20–25 min',
    status: 'busy', color: '#fce8e8', dotColor: '#c05030',
    upiId:    'southernstories@ybl',
    upiName:  'Southern Stories',
    upiQrUrl: '/uploads/qr/ss.png',
    categories: ['Dosas','Tiffin','Rice','Drinks'],
    menu: [
      { itemCode:'ss1', name:'Masala Dosa',          description:'Crisp rice crepe, spiced potato',             price:70,  category:'Dosas',  isVeg:true, inStock:true  },
      { itemCode:'ss2', name:'Onion Rava Dosa',      description:'Lacy thin crepe, caramelised onions',         price:80,  category:'Dosas',  isVeg:true, inStock:true  },
      { itemCode:'ss3', name:'Plain Dosa',           description:'Classic thin crispy dosa, chutneys',          price:50,  category:'Dosas',  isVeg:true, inStock:true  },
      { itemCode:'ss4', name:'Idli (2 pcs)',         description:'Steamed rice cakes, sambar, chutney',         price:45,  category:'Tiffin', isVeg:true, inStock:true  },
      { itemCode:'ss5', name:'Medu Vada',            description:'Crispy lentil fritter, sambar',               price:40,  category:'Tiffin', isVeg:true, inStock:true  },
      { itemCode:'ss6', name:'Curd Rice',            description:'Tempered yoghurt rice, pomegranate',          price:65,  category:'Rice',   isVeg:true, inStock:true  },
      { itemCode:'ss7', name:'Filter Coffee',        description:'South-Indian decoction, frothy milk',         price:25,  category:'Drinks', isVeg:true, inStock:true  },
    ]
  },
  {
    outletId: 'sn', name: 'Snapeats', icon: '🥪',
    cuisine: 'Snacks · Sandwiches · Beverages', waitTime: '5–8 min',
    status: 'open', color: '#e8eef8', dotColor: '#2a6db5',
    upiId:    'snapeats@ybl',
    upiName:  'Snapeats',
    upiQrUrl: '/uploads/qr/sn.png',
    categories: ['Sandwiches','Snacks','Cold Drinks'],
    menu: [
      { itemCode:'sn1', name:'Grilled Veg Sandwich', description:'Cheese, peppers, sourdough',                  price:65,  category:'Sandwiches',  isVeg:true,  inStock:true  },
      { itemCode:'sn2', name:'Chicken Wrap',         description:'Tandoori chicken, mint mayo',                 price:100, category:'Sandwiches',  isVeg:false, inStock:true  },
      { itemCode:'sn3', name:'Club Sandwich',        description:'Triple-decker, egg, cheese, veggies',         price:90,  category:'Sandwiches',  isVeg:true,  inStock:true  },
      { itemCode:'sn4', name:'Peri-Peri Fries',      description:'Crinkle cut, house seasoning',                price:70,  category:'Snacks',       isVeg:true,  inStock:true  },
      { itemCode:'sn5', name:'Samosa (2)',           description:'Spiced potato, tamarind chutney',             price:30,  category:'Snacks',       isVeg:true,  inStock:true  },
      { itemCode:'sn6', name:'Cold Coffee',          description:'House blend, sweetened, iced',                price:60,  category:'Cold Drinks',  isVeg:true,  inStock:true  },
      { itemCode:'sn7', name:'Mango Lassi',          description:'Fresh mango, thick curd, chilled',            price:55,  category:'Cold Drinks',  isVeg:true,  inStock:true  },
    ]
  },
  {
    outletId: 'hs', name: 'Hotspot', icon: '🌮',
    cuisine: 'Burgers · Fast Food · Wraps', waitTime: 'Opens 4:00 PM',
    status: 'closed', color: '#f0ece8', dotColor: '#8b6a4a',
    upiId:    'hotspot@ybl',
    upiName:  'Hotspot',
    upiQrUrl: '/uploads/qr/hs.png',
    categories: ['Burgers','Wraps','Sides'],
    menu: [
      { itemCode:'hs1', name:'Classic Veg Burger',   description:'Aloo tikki, coleslaw, sesame bun',            price:80,  category:'Burgers', isVeg:true,  inStock:true },
      { itemCode:'hs2', name:'Chicken Zinger',       description:'Crispy fried chicken, sriracha mayo',         price:120, category:'Burgers', isVeg:false, inStock:true },
      { itemCode:'hs3', name:'Mexican Wrap',         description:'Beans, corn, jalapeños, sour cream',          price:90,  category:'Wraps',   isVeg:true,  inStock:true },
      { itemCode:'hs4', name:'Loaded Nachos',        description:'Cheese sauce, jalapeños, salsa',              price:85,  category:'Sides',   isVeg:true,  inStock:true },
    ]
  }
];

// ─── Staff accounts (one per outlet) ────────────────────────────────────────
const STAFF_DATA = [
  { name:'IK Staff',  email:'staff.ik@bennett.edu.in',  password:'staff123', outletId:'ik', staffId:'IK-STAFF-001' },
  { name:'HC Staff',  email:'staff.hc@bennett.edu.in',  password:'staff123', outletId:'hc', staffId:'HC-STAFF-001' },
  { name:'SS Staff',  email:'staff.ss@bennett.edu.in',  password:'staff123', outletId:'ss', staffId:'SS-STAFF-001' },
  { name:'SN Staff',  email:'staff.sn@bennett.edu.in',  password:'staff123', outletId:'sn', staffId:'SN-STAFF-001' },
  { name:'HS Staff',  email:'staff.hs@bennett.edu.in',  password:'staff123', outletId:'hs', staffId:'HS-STAFF-001' },
];

// ─── Demo student account ─────────────────────────────────────────────────
const STUDENT_DATA = {
  name: 'Arsh Kumar',
  email: 'S24CSEU1785@bennett.edu.in',
  password: 'password',
  enrollmentNo: 'E21CSE001'
};

async function seed() {
  await connectDB();

  console.log('\n🌱  Seeding Hungry Helm database...\n');

  // Clear existing data
  await Outlet.deleteMany({});
  await User.deleteMany({ role: 'staff' });
  console.log('🗑   Cleared existing outlets and staff accounts');

  // Seed outlets
  await Outlet.insertMany(OUTLETS_DATA);
  console.log(`✅  Seeded ${OUTLETS_DATA.length} outlets`);

  // Seed staff accounts
  for (const s of STAFF_DATA) {
    await User.create({ ...s, role: 'staff' });
  }
  console.log(`✅  Seeded ${STAFF_DATA.length} staff accounts`);

  // Seed demo student (skip if already exists)
  const existing = await User.findOne({ email: STUDENT_DATA.email });
  if (!existing) {
    await User.create({ ...STUDENT_DATA, role: 'student' });
    console.log('✅  Seeded demo student account');
  } else {
    console.log('ℹ️   Demo student already exists — skipped');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋  DEMO LOGIN CREDENTIALS\n');
  console.log('  🎓 Student');
  console.log(`     Email    : ${STUDENT_DATA.email}`);
  console.log(`     Password : ${STUDENT_DATA.password}\n`);
  console.log('  👷 Staff (password for all: staff123)');
  STAFF_DATA.forEach(s =>
    console.log(`     ${s.outletId.toUpperCase().padEnd(4)}  staffId: ${s.staffId.padEnd(14)}  email: ${s.email}`)
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
