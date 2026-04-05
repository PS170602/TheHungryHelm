// ═══════════════════════════════════════════════════════════
//  THE HUNGRY HELM — script.js  (backend-connected version)
// ═══════════════════════════════════════════════════════════

const API = 'http://localhost:5000/api';

// Chart positions are visual only — kept hardcoded
const PORT_POSITIONS = {
  ik: { left:'20%', top:'35%' },
  hc: { left:'52%', top:'28%' },
  ss: { left:'30%', top:'72%' },
  sn: { left:'70%', top:'68%' },
  hs: { left:'76%', top:'38%' }
};

// ── Runtime state ──────────────────────────────────────────
let OUTLETS = [];
let currentUser = null, currentStaff = null, authToken = null;
let selectedOutletId = null, drawerCat = 'All', drawerCart = {};
let cart = {}, cartOutletId = null;
let currentOrderId = null; // mongo _id of last placed order (for payment)

const vars = {'--teal':'#1a5f5a','--teal2':'#2a7f78'};

// ═══════════════ API HELPER ═══════════════
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// Map DB outlet format → UI format (keeps UI rendering code unchanged)
function mapOutlet(o) {
  return {
    id:       o.outletId,
    name:     o.name,
    icon:     o.icon,
    cuisine:  o.cuisine,
    wait:     o.waitTime,
    status:   o.status,
    color:    o.color,
    dotColor: o.dotColor,
    upiId:    o.upiId,
    upiName:  o.upiName,
    upiQrUrl: o.upiQrUrl,
    pos:      PORT_POSITIONS[o.outletId] || { left:'50%', top:'50%' },
    cats:     ['All', ...(o.categories || [])],
    items:    (o.menu || []).map(i => ({
      id:    i._id,
      n:     i.name,
      d:     i.description,
      p:     i.price,
      c:     i.category,
      v:     i.isVeg,
      stock: i.inStock
    }))
  };
}

// ═══════════════ NAVIGATION ═══════════════
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page + 'Page')?.classList.add('active');
  window.scrollTo(0, 0);
}

// ═══════════════ LOGIN ═══════════════
function switchLoginTab(type) {
  document.querySelectorAll('.ltab').forEach((el, i) =>
    el.classList.toggle('on', (i === 0 && type === 'student') || (i === 1 && type === 'staff'))
  );
  document.getElementById('studentForm').style.display = type === 'student' ? 'flex' : 'none';
  document.getElementById('studentRegForm').style.display = type === 'studentReg' ? 'flex' : 'none';
  document.getElementById('staffForm').style.display   = type === 'staff'   ? 'flex' : 'none';
  document.getElementById('staffRegForm').style.display   = type === 'staffReg'   ? 'flex' : 'none';
}

async function loginStudent() {
  const email    = document.getElementById('sEmail').value.trim();
  const password = document.getElementById('sPass').value;

  if (!email.includes('@bennett.edu.in')) {
    toast('Please use your @bennett.edu.in email'); return;
  }
  try {
    const data = await api('POST', '/auth/login', { email, password });
    authToken   = data.token;
    currentUser = {
      id:       data.user.id,
      name:     data.user.name,
      email:    data.user.email,
      initials: data.user.name.split(' ').map(w => w[0].toUpperCase()).join('').slice(0, 2)
    };

    // Load outlets from DB
    const outletData = await api('GET', '/outlets');
    OUTLETS = outletData.outlets.map(mapOutlet);

    // Update hero
    document.getElementById('heroName').textContent = currentUser.name.split(' ')[0] + '.';
    const day = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
    const openCount = OUTLETS.filter(o => o.status !== 'closed').length;
    document.getElementById('heroDate').textContent = `${day} · ${openCount} ports open`;
    document.getElementById('tbRight').innerHTML = `
      <button class="tb-btn" onclick="navigate('orders')">My Orders</button>
      <div class="tb-avatar" title="${currentUser.name}">${currentUser.initials}</div>
      <button class="tb-btn" onclick="logout()">Sign Out</button>`;

    renderChartPorts();
    await renderHomeOrders();
    navigate('home');
    toast(`Welcome aboard, ${currentUser.name.split(' ')[0]}! 🧭`);
  } catch (err) { toast(err.message); }
}

async function loginStaff() {
  const outletId = document.getElementById('staffOutletSel').value;
  const staffId  = document.getElementById('staffId').value.trim();
  const password = document.getElementById('staffPass').value;
  try {
    const data = await api('POST', '/auth/staff-login', { outletId, staffId, password });
    authToken    = data.token;
    currentStaff = { outletId: data.user.outletId };

    // Load this outlet's data
    const outletData = await api('GET', `/outlets/${outletId}`);
    const outlet = mapOutlet(outletData.outlet);
    OUTLETS = [outlet];
    currentStaff.outlet = outlet;

    document.getElementById('sbTitle').textContent = outlet.name;
    document.getElementById('tbRight').innerHTML = `
      <span class="tb-pill tp-staff">${outlet.name.split(' ').map(w=>w[0]).join('')} STAFF</span>
      <div class="tb-avatar staff">${outlet.name.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>
      <button class="tb-btn" onclick="logout()">Sign Out</button>`;

    await renderStaffOrders();
    renderStaffMenu();
    navigate('staff');
    toast(`Staff portal — ${outlet.name}`);
  } catch (err) { toast(err.message); }
}

// ═══════════════ REGISTRATION ═══════════════
async function registerStudent() {
  const name       = document.getElementById('regSName').value.trim();
  const email      = document.getElementById('regSEmail').value.trim();
  const enrollmentNo = document.getElementById('regSEnrollment').value.trim();
  const phone      = document.getElementById('regSPhone').value.trim();
  const password   = document.getElementById('regSPass').value;
  const password2  = document.getElementById('regSPass2').value;

  if (!name || !email || !password || !phone) {
    toast('Please fill all required fields'); return;
  }
  if (!email.includes('@bennett.edu.in')) {
    toast('Please use your @bennett.edu.in email'); return;
  }
  if (phone.length !== 10 || isNaN(phone)) {
    toast('Please enter a valid 10-digit phone number'); return;
  }
  if (password !== password2) {
    toast('Passwords do not match'); return;
  }
  if (password.length < 6) {
    toast('Password must be at least 6 characters'); return;
  }

  try {
    const data = await api('POST', '/auth/register', { name, email, password, enrollmentNo, phone });
    authToken   = data.token;
    currentUser = {
      id:       data.user.id,
      name:     data.user.name,
      email:    data.user.email,
      initials: data.user.name.split(' ').map(w => w[0].toUpperCase()).join('').slice(0, 2)
    };

    // Load outlets from DB
    const outletData = await api('GET', '/outlets');
    OUTLETS = outletData.outlets.map(mapOutlet);

    // Update hero
    document.getElementById('heroName').textContent = currentUser.name.split(' ')[0] + '.';
    const day = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
    const openCount = OUTLETS.filter(o => o.status !== 'closed').length;
    document.getElementById('heroDate').textContent = `${day} · ${openCount} ports open`;
    document.getElementById('tbRight').innerHTML = `
      <button class="tb-btn" onclick="navigate('orders')">My Orders</button>
      <div class="tb-avatar" title="${currentUser.name}">${currentUser.initials}</div>
      <button class="tb-btn" onclick="logout()">Sign Out</button>`;

    renderChartPorts();
    await renderHomeOrders();
    navigate('home');
    toast(`Welcome aboard, ${currentUser.name.split(' ')[0]}! 🧭 Your account has been created successfully.`);
  } catch (err) { toast(err.message); }
}

async function registerStaff() {
  const name    = document.getElementById('regStaffName').value.trim();
  const email   = document.getElementById('regStaffEmail').value.trim();
  const outletId = document.getElementById('regStaffOutletSel').value;
  const staffId = document.getElementById('regStaffId').value.trim();
  const phone   = document.getElementById('regStaffPhone').value.trim();
  const password = document.getElementById('regStaffPass').value;
  const password2 = document.getElementById('regStaffPass2').value;

  if (!name || !email || !staffId || !password || !phone) {
    toast('Please fill all required fields'); return;
  }
  if (phone.length !== 10 || isNaN(phone)) {
    toast('Please enter a valid 10-digit phone number'); return;
  }
  if (password !== password2) {
    toast('Passwords do not match'); return;
  }
  if (password.length < 6) {
    toast('Password must be at least 6 characters'); return;
  }

  try {
    const data = await api('POST', '/auth/register', { name, email, password, phone, outletId, staffId, role: 'staff' });
    toast(`Staff account created successfully! Your credentials have been registered.`);
    // Clear form
    document.getElementById('regStaffName').value = '';
    document.getElementById('regStaffEmail').value = '';
    document.getElementById('regStaffPhone').value = '';
    document.getElementById('regStaffPass').value = '';
    document.getElementById('regStaffPass2').value = '';
    // Switch back to login
    switchLoginTab('staff');
  } catch (err) { toast(err.message); }
}

function logout() {
  authToken = null; currentUser = null; currentStaff = null;
  cart = {}; OUTLETS = []; currentOrderId = null;
  document.getElementById('tbRight').innerHTML =
    `<button class="tb-btn gold" onclick="navigate('login')">Log In</button>`;
  navigate('login');
}

// ═══════════════ HOME TABS ═══════════════
function switchHomeTab(tab) {
  document.querySelectorAll('.snav-item').forEach((el, i) =>
    el.classList.toggle('on', ['ports','orders','history'][i] === tab)
  );
  document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('on'));
  document.getElementById('htab-' + tab).classList.add('on');
  if (tab === 'orders' || tab === 'history') renderHomeOrders();
}

// ═══════════════ NAUTICAL CHART ═══════════════
function renderChartPorts() {
  const container = document.getElementById('chartPorts');
  container.innerHTML = OUTLETS.map(o => {
    const sClass = o.status==='open' ? 'pms-open' : o.status==='busy' ? 'pms-busy' : 'pms-closed';
    const sLabel = o.status==='open' ? 'Open'     : o.status==='busy' ? 'Busy'     : 'Closed';
    return `<div class="port-marker" id="pm-${o.id}"
      style="left:${o.pos.left};top:${o.pos.top}"
      onclick="${o.status!=='closed' ? `openDrawer('${o.id}')` : ''}"
      title="${o.name}">
      <div class="pm-ring" style="color:${o.dotColor}"></div>
      <div class="pm-ring2" style="color:${o.dotColor}"></div>
      <div class="pm-dot" style="background:${o.color};color:${o.dotColor}">${o.icon}</div>
      <div class="pm-label">
        <div class="pm-name">${o.name}</div>
        <div class="pm-tag">${o.wait}</div>
        <span class="pm-status ${sClass}">${sLabel}</span>
      </div>
    </div>`;
  }).join('');
}

let currentDrawerOutlet = null;
function openDrawer(outletId) {
  const o = OUTLETS.find(x => x.id === outletId);
  if (!o) return;
  currentDrawerOutlet = o;
  selectedOutletId    = outletId;
  drawerCat           = 'All';

  document.querySelectorAll('.port-marker').forEach(el => el.classList.remove('active'));
  document.getElementById('pm-' + outletId)?.classList.add('active');

  document.getElementById('pdIcon').textContent    = o.icon;
  document.getElementById('pdName').textContent    = o.name;
  document.getElementById('pdCuisine').textContent = o.cuisine;
  document.getElementById('pdWait').textContent    = o.wait;

  const sClass = o.status==='open' ? 'pms-open' : o.status==='busy' ? 'pms-busy' : 'pms-closed';
  const sLabel = o.status==='open' ? 'Open'     : o.status==='busy' ? 'Busy'     : 'Closed';
  document.getElementById('pdStatusItem').innerHTML =
    `<span class="pm-status ${sClass}" style="margin-left:4px">${sLabel}</span>`;

  renderDrawerCats(o);
  renderDrawerItems(o);
  document.getElementById('portDrawer').classList.add('open');
  document.getElementById('btnGoToOrder').disabled = false;
}

function closeDrawer() {
  document.getElementById('portDrawer').classList.remove('open');
  document.querySelectorAll('.port-marker').forEach(el => el.classList.remove('active'));
  selectedOutletId = null;
}

function renderDrawerCats(o) {
  document.getElementById('pdCats').innerHTML = o.cats.map(c =>
    `<div class="pdcat ${c===drawerCat?'on':''}" onclick="filterDrawer('${o.id}','${c}')">${c}</div>`
  ).join('');
}

function filterDrawer(id, cat) {
  drawerCat = cat;
  const o = OUTLETS.find(x => x.id === id);
  renderDrawerCats(o);
  renderDrawerItems(o);
}

function renderDrawerItems(o) {
  const items = drawerCat === 'All' ? o.items : o.items.filter(i => i.c === drawerCat);
  const avail = items.filter(i => i.stock);
  document.getElementById('pdItems').innerHTML = avail.length === 0
    ? `<div style="padding:24px;text-align:center;color:var(--ink4);font-size:13px">No available items in this category</div>`
    : items.map(i => `<div class="pd-item ${!i.stock?'oos':''}">
        <div class="pdi-badge ${i.v?'pdi-veg':'pdi-nv'}">${i.v?'🟢':'🔴'}</div>
        <div class="pdi-body"><div class="pdi-name">${i.n}</div><div class="pdi-desc">${i.d}</div></div>
        <div class="pdi-right">
          <div class="pdi-price">₹${i.p}</div>
          ${i.stock
            ? `<button class="pdi-add" onclick="addDrawerCart('${o.id}','${i.id}','${i.n.replace(/'/g,"\\'")}',${i.p})">+</button>`
            : `<span style="font-size:9px;color:var(--ink4)">OOS</span>`}
        </div>
      </div>`).join('');
}

function addDrawerCart(outletId, itemId, name, price) {
  if (!drawerCart[itemId]) drawerCart[itemId] = { name, price, qty: 0, outletId };
  drawerCart[itemId].qty++;
  updateDrawerCartDisplay();
  toast(`${name} added to cart`);
}

function updateDrawerCartDisplay() {
  const keys  = Object.keys(drawerCart).filter(k => drawerCart[k].qty > 0);
  const total = keys.reduce((s, k) => s + drawerCart[k].price * drawerCart[k].qty, 0);
  const qty   = keys.reduce((s, k) => s + drawerCart[k].qty, 0);
  document.getElementById('drawerCart').textContent =
    qty > 0 ? `${qty} item${qty>1?'s':''} · ₹${total}` : 'empty';
}

function goToOutletPage() {
  if (!selectedOutletId) return;
  cart        = { ...drawerCart };
  cartOutletId = selectedOutletId;
  loadOutletPage(selectedOutletId);
  navigate('outlet');
  closeDrawer();
}

// ═══════════════ OUTLET PAGE ═══════════════
function loadOutletPage(outletId) {
  const o = OUTLETS.find(x => x.id === outletId);
  cartOutletId = outletId;

  document.getElementById('ohIcon').textContent    = o.icon;
  document.getElementById('ohName').textContent    = o.name;
  document.getElementById('ohCuisine').textContent = o.cuisine;

  const sClass = o.status==='open' ? 'pms-open' : o.status==='busy' ? 'pms-busy' : 'pms-closed';
  const sLabel = o.status==='open' ? 'Open'     : o.status==='busy' ? 'Busy'     : 'Closed';
  document.getElementById('ohMeta').innerHTML = `
    <span style="font-size:12px;color:var(--ink4)">⏱ ${o.wait}</span>
    <span class="pm-status ${sClass}" style="padding:5px 12px">${sLabel}</span>`;

  // Sidebar
  const sidebar = document.getElementById('outletSidebar');
  sidebar.innerHTML = `<div class="os-label" style="padding:20px 20px 8px">Categories</div>` +
    o.cats.filter(c => c !== 'All').map(c =>
      `<div class="os-cat" onclick="scrollToSection('${c}')">${c}</div>`
    ).join('');

  // Menu
  const menuEl  = document.getElementById('outletMenu');
  const allCats = [...new Set(o.items.map(i => i.c))];
  menuEl.innerHTML = allCats.map(cat => {
    const catItems = o.items.filter(i => i.c === cat);
    return `<div class="menu-cat-section" id="sec-${cat}">
      <div class="mcs-title">${cat} <span class="mcs-count">${catItems.length} items</span></div>
      <div class="menu-items-grid">${catItems.map(item => `
        <div class="menu-card ${!item.stock?'oos':''}"
          onclick="${item.stock ? `addToCart('${o.id}','${item.id}','${item.n.replace(/'/g,"\\'")}',${item.p})` : ''}">
          ${!item.stock ? '<div class="mc-oos-badge">Out of Stock</div>' : ''}
          <div class="mc-top">
            <div class="mc-icon ${item.v?'mc-veg':'mc-nv'}">${item.v?'🟢':'🔴'}</div>
            <div><div class="mc-name">${item.n}</div><div class="mc-desc">${item.d}</div></div>
          </div>
          <div class="mc-footer">
            <div class="mc-price">₹${item.p}</div>
            ${item.stock ? `<button class="mc-add">+</button>` : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
  renderCartPanel();
}

function scrollToSection(cat) {
  const el = document.getElementById('sec-' + cat);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  document.querySelectorAll('.os-cat').forEach(el2 =>
    el2.classList.toggle('on', el2.textContent === cat)
  );
}

function addToCart(outletId, itemId, name, price) {
  if (cartOutletId && cartOutletId !== outletId) { cart = {}; cartOutletId = outletId; }
  if (!cart[itemId]) cart[itemId] = { name, price, qty: 0, outletId };
  cart[itemId].qty++;
  renderCartPanel();
  toast(`${name} added`);
}

function removeFromCart(itemId) {
  if (cart[itemId]) cart[itemId].qty = Math.max(0, cart[itemId].qty - 1);
  if (cart[itemId]?.qty === 0) delete cart[itemId];
  renderCartPanel();
}

function renderCartPanel() {
  const keys    = Object.keys(cart).filter(k => cart[k].qty > 0);
  const total   = keys.reduce((s, k) => s + cart[k].price * cart[k].qty, 0);
  const cartEl  = document.getElementById('cartItemsEl');
  const footerEl = document.getElementById('cartFooter');
  if (keys.length === 0) {
    cartEl.innerHTML = `<div class="cp-empty">Your cart is empty.<br>
      <span style="font-size:11px;margin-top:6px;display:block">Add items from the menu</span></div>`;
    footerEl.style.display = 'none';
    return;
  }
  cartEl.innerHTML = keys.map(k => `<div class="cart-item">
    <div class="ci-name">${cart[k].name}<small>₹${cart[k].price} each</small></div>
    <div class="ci-qty">
      <button class="ci-btn" onclick="removeFromCart('${k}')">−</button>
      <span class="ci-n">${cart[k].qty}</span>
      <button class="ci-btn" onclick="addToCart('${cartOutletId}','${k}','${cart[k].name.replace(/'/g,"\\'")}',${cart[k].price})">+</button>
    </div>
    <div class="ci-price">₹${cart[k].price * cart[k].qty}</div>
  </div>`).join('');
  document.getElementById('cartTotal').textContent = `₹${total}`;
  footerEl.style.display = 'block';
}

// ═══════════════ ORDER CONFIRM ═══════════════
function openOrderConfirm() {
  const keys  = Object.keys(cart).filter(k => cart[k].qty > 0);
  const total = keys.reduce((s, k) => s + cart[k].price * cart[k].qty, 0);
  document.getElementById('confirmItems').innerHTML = keys.map(k =>
    `<div class="confirm-item-row">
      <span>${cart[k].name} × ${cart[k].qty}</span>
      <span>₹${cart[k].price * cart[k].qty}</span>
    </div>`).join('');
  document.getElementById('confirmTotal').innerHTML =
    `<span>Total</span><span style="color:var(--gold)">₹${total}</span>`;
  openModal('confirmModal');
}

async function confirmOrder() {
  const keys  = Object.keys(cart).filter(k => cart[k].qty > 0);
  const total = keys.reduce((s, k) => s + cart[k].price * cart[k].qty, 0);
  const items = keys.map(k => ({ itemId: cart[k].id || k, qty: cart[k].qty }));

  try {
    // 1. Create order in DB
    const data = await api('POST', '/orders', { outletId: cartOutletId, items });
    currentOrderId = data.order._id;

    cart = {};
    closeModal('confirmModal');
    renderCartPanel();

    // 2. Show payment options modal
    showPaymentModal(data.order, total);
  } catch (err) { toast(err.message); }
}

// ═══════════════ PAYMENT MODAL ═══════════════
function showPaymentModal(order, total) {
  const outlet = OUTLETS.find(o => o.id === order.outletId);

  // Build modal HTML and inject into confirmModal (reuse it)
  const box = document.querySelector('#confirmModal .modal-box');
  box.innerHTML = `
    <div class="modal-title">Choose Payment
      <button class="modal-close" onclick="closeModal('confirmModal')">✕</button>
    </div>
    <div style="margin-bottom:18px;padding:14px 16px;background:var(--parchment);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--ink3)">${order.displayId} · ${outlet?.name || ''}</span>
      <span style="font-family:'Libre Baskerville',serif;font-size:18px;color:var(--gold)">₹${total}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button onclick="payUPI('${order._id}','${outlet?.upiId || ''}',${total},'${outlet?.upiQrUrl || ''}','${outlet?.upiName || outlet?.name || ''}')"
        style="width:100%;padding:13px;background:var(--teal);color:#fff;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:all .18s"
        onmouseover="this.style.background=vars['--teal2']" onmouseout="this.style.background=vars['--teal']">
        📱 Pay via UPI / QR
      </button>
      <button onclick="payCash('${order._id}')"
        style="width:100%;padding:13px;background:transparent;color:var(--ink2);border-radius:8px;font-size:14px;font-weight:600;border:1.5px solid var(--border);cursor:pointer;transition:all .18s"
        onmouseover="this.style.background=vars['--parchment']" onmouseout="this.style.background='transparent'">
        💵 Pay Cash at Counter
      </button>
    </div>`;
  openModal('confirmModal');
}

// ── UPI Payment ────────────────────────────────────────────
function payUPI(orderId, upiId, amount, qrUrl, upiName) {
  if (!upiId) { toast('UPI not set up for this outlet yet'); return; }

  // UPI deep link — opens GPay/PhonePe/Paytm directly on mobile
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR`;

  const box = document.querySelector('#confirmModal .modal-box');
  box.innerHTML = `
    <div class="modal-title" style="font-size:17px">Scan & Pay
      <button class="modal-close" onclick="closeModal('confirmModal')">✕</button>
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:13px;color:var(--ink4);margin-bottom:12px">
        Scan QR or tap the button to open your payment app
      </div>
      ${qrUrl
        ? `<img src="${API.replace('/api','')}${qrUrl}" alt="UPI QR"
            style="width:180px;height:180px;border-radius:12px;border:1.5px solid var(--border);object-fit:contain;padding:8px"
            onerror="this.style.display='none'">`
        : `<div style="width:180px;height:180px;background:var(--parchment);border-radius:12px;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px;color:var(--ink4)">QR image not set</div>`}
      <div style="margin-top:10px;font-size:12px;color:var(--ink4)">Pay to: <strong style="color:var(--ink)">${upiId}</strong></div>
    </div>
    <a href="${upiLink}"
      style="display:block;width:100%;padding:13px;background:var(--teal);color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-align:center;text-decoration:none;margin-bottom:14px"
      onclick="toast('Opening your payment app...')">
      Open Payment App →
    </a>
    <div style="font-size:12px;color:var(--ink3);margin-bottom:8px;font-weight:600">Enter UTR after paying:</div>
    <div style="display:flex;gap:8px">
      <input id="utrInput" class="lform-input" placeholder="12-digit UTR number" maxlength="12"
        style="flex:1" oninput="this.value=this.value.replace(/\\D/g,'')">
      <button onclick="submitUTR('${orderId}','${upiId}')"
        style="padding:11px 18px;background:var(--teal);color:#fff;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer;white-space:nowrap">
        Confirm ⚓
      </button>
    </div>
    <div style="font-size:10px;color:var(--ink4);margin-top:6px">UTR is the 12-digit reference shown in GPay/PhonePe after payment</div>`;
}

async function submitUTR(orderId, upiId) {
  const utr = document.getElementById('utrInput')?.value.trim();
  if (!utr || utr.length !== 12) { toast('Please enter a valid 12-digit UTR'); return; }
  try {
    await api('POST', '/payment/confirm', { orderId, utrNumber: utr, upiId });
    closeModal('confirmModal');
    resetConfirmModal();
    await renderHomeOrders();
    updateHeroStats();
    navigate('orders');
    await renderOrdersPage();
    toast(`Order confirmed! ⚓ UTR: ${utr}`);
  } catch (err) { toast(err.message); }
}

// ── Cash Payment ───────────────────────────────────────────
async function payCash(orderId) {
  try {
    await api('POST', '/payment/cash', { orderId });
    closeModal('confirmModal');
    resetConfirmModal();
    await renderHomeOrders();
    updateHeroStats();
    navigate('orders');
    await renderOrdersPage();
    toast('Order placed! Pay cash at the counter 💵');
  } catch (err) { toast(err.message); }
}

// Restore confirm modal to original state for next use
function resetConfirmModal() {
  const box = document.querySelector('#confirmModal .modal-box');
  box.innerHTML = `
    <div class="modal-title">Confirm Order
      <button class="modal-close" onclick="closeModal('confirmModal')">✕</button>
    </div>
    <div id="confirmItems" class="confirm-items"></div>
    <div id="confirmTotal" class="confirm-total-row"
      style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:18px"></div>
    <div class="mf-btns">
      <button class="btn-cancel" onclick="closeModal('confirmModal')">Cancel</button>
      <button class="btn-save" onclick="confirmOrder()">Place Order ⚓</button>
    </div>`;
}

// ═══════════════ ORDERS PAGE ═══════════════
async function renderOrdersPage() {
  const statusMap = {
    incoming:  { badge:'oc2b-recv',  label:'Received',   done:[0],       now:[1] },
    preparing: { badge:'oc2b-prep',  label:'Preparing',  done:[0,1],     now:[2] },
    ready:     { badge:'oc2b-ready', label:'Ready ✓',    done:[0,1,2],   now:[3] },
    completed: { badge:'oc2b-done',  label:'Done',       done:[0,1,2,3], now:[]  },
    cancelled: { badge:'oc2b-done',  label:'Cancelled',  done:[],        now:[]  },
  };
  const steps = ['Received','Preparing','Ready','Done'];

  try {
    const data   = await api('GET', '/orders/my');
    const orders = data.orders || [];
    const active    = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    const completed = orders.filter(o => o.status === 'completed');

    const activeEl = document.getElementById('ordersActiveList');
    if (active.length === 0) {
      activeEl.innerHTML = `<div style="color:var(--ink4);font-size:13px;padding:20px 0">
        No active orders. <a href="#" onclick="navigate('home');return false" style="color:var(--teal)">Browse the ports →</a></div>`;
    } else {
      activeEl.innerHTML = active.map(ord => {
        const sm    = statusMap[ord.status] || statusMap.incoming;
        const track = steps.map((s, i) => {
          const cls = sm.done.includes(i) ? 'done' : sm.now.includes(i) ? 'now' : '';
          return `<div class="otrack ${cls}"><div class="otdot"></div><div class="otlbl">${s}</div></div>`;
        }).join('');
        const itemStr = ord.items.map(i => `${i.name} × ${i.qty}`).join(', ');
        return `<div class="order-card2">
          <div class="oc2-top">
            <div class="oc2-ref">${ord.displayId}</div>
            <div class="oc2-outlet">${ord.outletName}</div>
            <div class="oc2-time">${new Date(ord.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
            <div class="oc2-badge ${sm.badge}">${sm.label}</div>
          </div>
          <div class="oc2-name">${ord.items[0]?.name || ''}${ord.items.length > 1 ? ` + ${ord.items.length-1} more` : ''}</div>
          <div class="oc2-items">${itemStr}</div>
          <div class="oc2-track">${track}</div>
          <div class="oc2-total">₹${ord.total}</div>
        </div>`;
      }).join('');
    }

    // Completed orders (voyage log)
    const compEl = document.getElementById('ordersCompletedList');
    if (completed.length === 0) {
      compEl.innerHTML = `<div style="color:var(--ink4);font-size:13px;padding:20px 0">No completed orders yet.</div>`;
    } else {
      compEl.innerHTML = completed.map(ord => {
        const itemStr = ord.items.map(i => `${i.name} × ${i.qty}`).join(', ');
        return `<div class="order-card2">
          <div class="oc2-top">
            <div class="oc2-ref">${ord.displayId}</div>
            <div class="oc2-outlet">${ord.outletName}</div>
            <div class="oc2-time">${new Date(ord.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
            <div class="oc2-badge oc2b-done">Done</div>
          </div>
          <div class="oc2-name">${ord.items[0]?.name || ''}</div>
          <div class="oc2-items">${itemStr} · ₹${ord.total}</div>
          <div class="oc2-track">
            <div class="otrack done"><div class="otdot"></div><div class="otlbl">Received</div></div>
            <div class="otrack done"><div class="otdot"></div><div class="otlbl">Preparing</div></div>
            <div class="otrack done"><div class="otdot"></div><div class="otlbl">Ready</div></div>
            <div class="otrack done"><div class="otdot"></div><div class="otlbl">Done</div></div>
          </div>
          <div class="oc2-total">₹${ord.total}</div>
        </div>`;
      }).join('');
    }
  } catch (err) { console.error(err); }
}

// ═══════════════ HOME ORDERS ═══════════════
async function renderHomeOrders() {
  await renderOrdersPage();
  document.getElementById('homeOrdersList').innerHTML =
    document.getElementById('ordersActiveList').innerHTML;
  document.getElementById('homeHistoryList').innerHTML =
    document.getElementById('ordersCompletedList').innerHTML;
  updateHeroStats();
}

async function updateHeroStats() {
  try {
    const data   = await api('GET', '/orders/my');
    const orders = data.orders || [];
    const active = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    const spent  = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
    document.getElementById('heroActiveCount').textContent = active.length;
    document.getElementById('heroSpent').textContent       = `₹${spent}`;
  } catch (err) { /* silently ignore */ }
}

// ═══════════════ STAFF ═══════════════
function switchStaffTab(tab) {
  document.querySelectorAll('.staff-tab').forEach((el, i) =>
    el.classList.toggle('on', ['orders','menu','reports'][i] === tab)
  );
  document.querySelectorAll('.staff-tab-content').forEach(el => el.classList.remove('on'));
  document.getElementById('stc-' + tab).classList.add('on');
  if (tab === 'reports') loadStaffReports();
}

async function toggleOutletStatus(el) {
  const pill     = document.getElementById('portStatusPill');
  const newStatus = el.checked ? 'open' : 'closed';
  try {
    await api('PATCH', `/outlets/${currentStaff.outletId}/status`, { status: newStatus });
    if (el.checked) {
      pill.textContent = 'OPEN';
      pill.className   = 'tb-pill tp-online';
    } else {
      pill.textContent = 'CLOSED';
      pill.style.cssText = 'font-size:10px;padding:3px 10px;border-radius:20px;font-weight:600;background:rgba(139,58,42,.1);color:var(--rust);border:1px solid rgba(139,58,42,.2)';
    }
    toast(el.checked ? 'Port is now open' : 'Port marked as closed');
  } catch (err) { toast(err.message); el.checked = !el.checked; }
}

async function renderStaffOrders() {
  try {
    const data   = await api('GET', `/orders/outlet/${currentStaff.outletId}`);
    const orders = data.orders || [];

    const incoming = orders.filter(o => o.status === 'incoming');
    const inProg   = orders.filter(o => o.status === 'preparing' || o.status === 'ready');
    const done     = orders.filter(o => o.status === 'completed');

    document.getElementById('sc-inc').textContent   = incoming.length;
    document.getElementById('sc-prep').textContent  = orders.filter(o => o.status === 'preparing').length;
    document.getElementById('sc-ready').textContent = orders.filter(o => o.status === 'ready').length;
    document.getElementById('sc-done').textContent  = done.length;

    // Incoming queue
    const incEl = document.getElementById('staffIncoming');
    incEl.innerHTML = incoming.length
      ? incoming.map(ord => {
          const itemStr = ord.items.map(i => `${i.name} × ${i.qty}`).join(' · ');
          return `<div class="ticket">
            <div class="tk-head">
              <div class="tk-ref">${ord.displayId}</div>
              <div class="tk-cust">${ord.studentName || 'Student'}</div>
              <div class="tk-time">${new Date(ord.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div class="tk-items">${itemStr}</div>
            <div class="tk-amt">₹${ord.total}
              <span style="font-size:9px;font-weight:400;color:var(--ink4);margin-left:6px">
                ${ord.paymentMethod === 'upi' ? '📱 UPI' : '💵 Cash'}
              </span>
            </div>
            <div class="tk-btns">
              <button class="tkbtn tkbtn-acc" onclick="staffAct('${ord._id}','accept')">Accept</button>
              <button class="tkbtn tkbtn-dec" onclick="staffAct('${ord._id}','cancel')">Decline</button>
            </div>
          </div>`;
        }).join('')
      : `<div style="color:var(--ink4);font-size:12px;padding:16px 0;grid-column:span 2">No incoming orders at the moment.</div>`;

    // In progress
    const progEl = document.getElementById('staffInProgress');
    progEl.innerHTML = inProg.map(ord => {
      const isReady = ord.status === 'ready';
      const pct     = isReady ? 90 : 40;
      const itemStr = ord.items.map(i => `${i.name} × ${i.qty}`).join(' · ');
      return `<div class="ipcard">
        <div class="tk-head">
          <div class="tk-ref">${ord.displayId}</div>
          <div class="tk-cust">${ord.studentName || 'Student'}</div>
          <div class="tk-time">${isReady ? 'Ready' : 'Preparing...'}</div>
        </div>
        <div class="tk-items">${itemStr}</div>
        <div class="ip-bar"><div class="ip-fill" style="width:${pct}%"></div></div>
        <div class="ip-steps">
          <span class="ips done">Received</span>
          <span class="ips done">Accepted</span>
          <span class="ips ${isReady?'done':'now'}">Preparing</span>
          <span class="ips ${isReady?'now':''}">Ready</span>
        </div>
        <div class="tk-btns" style="margin-top:10px">
          ${isReady
            ? `<button class="tkbtn tkbtn-done" onclick="staffAct('${ord._id}','complete')">Mark Complete ✓</button>`
            : `<button class="tkbtn tkbtn-next" onclick="staffAct('${ord._id}','ready')">Mark Ready →</button>`}
        </div>
      </div>`;
    }).join('');
  } catch (err) { console.error(err); }
}

async function staffAct(mongoId, action) {
  try {
    await api('PATCH', `/orders/${mongoId}/status`, { action });
    if (action === 'complete') toast('Order completed!');
    if (action === 'cancel')   toast('Order declined');
    await renderStaffOrders();
  } catch (err) { toast(err.message); }
}

// ── Staff Menu ─────────────────────────────────────────────
function renderStaffMenu() {
  const outlet = currentStaff?.outlet;
  if (!outlet) return;
  const el = document.getElementById('staffMenuTable');
  el.innerHTML = `<div class="mmtable">
    <div class="mmt-hdr"><div>Item</div><div>Category</div><div>Price</div><div>Availability</div><div>Actions</div></div>
    ${outlet.items.map(item => `
      <div class="mmt-row" id="mmr-${item.id}">
        <div><div class="mmr-name">${item.n}</div><div class="mmr-cat">${item.c} · ${item.v?'Veg':'Non-Veg'}</div></div>
        <div style="font-size:11px;color:var(--ink4)">${item.c}</div>
        <div class="mmr-price">₹${item.p}</div>
        <div class="tog-wr">
          <div class="tog2 ${item.stock?'on':''}" onclick="toggleStock('${outlet.id}','${item.id}',this)"></div>
          <span class="tog2-lbl">${item.stock?'In Stock':'Out'}</span>
        </div>
        <div class="mmr-btns">
          <button class="mmr-btn" onclick="editPrice('${outlet.id}','${item.id}')">Edit</button>
          <button class="mmr-btn del" onclick="delItem('${outlet.id}','${item.id}')">Del</button>
        </div>
      </div>`).join('')}
  </div>`;
}

async function toggleStock(outletId, itemId, el) {
  const outlet = OUTLETS.find(o => o.id === outletId);
  const item   = outlet?.items.find(i => i.id === itemId);
  if (!item) return;
  const newVal = !item.stock;
  try {
    await api('PATCH', `/outlets/${outletId}/menu/${itemId}`, { inStock: newVal });
    item.stock = newVal;
    el.classList.toggle('on');
    el.nextElementSibling.textContent = newVal ? 'In Stock' : 'Out';
    toast(`${item.n} → ${newVal ? 'available' : 'out of stock'}`);
  } catch (err) { toast(err.message); }
}

async function editPrice(outletId, itemId) {
  const outlet = OUTLETS.find(o => o.id === outletId);
  const item   = outlet?.items.find(i => i.id === itemId);
  if (!item) return;
  const np = prompt(`New price for "${item.n}" (current ₹${item.p}):`, item.p);
  if (np && !isNaN(np) && +np > 0) {
    try {
      await api('PATCH', `/outlets/${outletId}/menu/${itemId}`, { price: +np });
      item.p = +np;
      renderStaffMenu();
      toast(`Price updated to ₹${item.p}`);
    } catch (err) { toast(err.message); }
  }
}

async function delItem(outletId, itemId) {
  const outlet = OUTLETS.find(o => o.id === outletId);
  const item   = outlet?.items.find(i => i.id === itemId);
  if (!item || !confirm(`Remove "${item.n}"?`)) return;
  try {
    await api('DELETE', `/outlets/${outletId}/menu/${itemId}`);
    outlet.items = outlet.items.filter(i => i.id !== itemId);
    renderStaffMenu();
    toast(`${item.n} removed`);
  } catch (err) { toast(err.message); }
}

function openAddModal() { openModal('addItemModal'); }

async function addMenuItem() {
  const name  = document.getElementById('newName').value.trim();
  const price = parseInt(document.getElementById('newPrice').value);
  if (!name || !price) { toast('Please fill name and price'); return; }
  const outlet = currentStaff.outlet;
  try {
    const data = await api('POST', `/outlets/${outlet.id}/menu`, {
      name,
      description: document.getElementById('newDesc').value || 'Fresh item',
      price,
      category: document.getElementById('newCat').value,
      isVeg:    document.getElementById('newType').value === 'veg',
      inStock:  document.getElementById('newStock').value === '1'
    });
    // Add to local OUTLETS array so it shows immediately
    outlet.items.push({
      id: data.item._id, n: name,
      d: data.item.description, p: price,
      c: data.item.category, v: data.item.isVeg, stock: data.item.inStock
    });
    closeModal('addItemModal');
    renderStaffMenu();
    document.getElementById('newName').value  = '';
    document.getElementById('newPrice').value = '';
    document.getElementById('newDesc').value  = '';
    toast(`${name} added to the manifest`);
  } catch (err) { toast(err.message); }
}

// ── Staff Reports ──────────────────────────────────────────
async function loadStaffReports() {
  try {
    const data = await api('GET', `/payment/outlet/${currentStaff.outletId}/summary`);
    const s    = data.summary;
    // Update the stat cards in the reports tab
    const cards = document.querySelectorAll('#stc-reports .scard-num');
    if (cards[0]) cards[0].textContent = `₹${s.totalRevenue.toLocaleString('en-IN')}`;
    if (cards[1]) cards[1].textContent = s.totalOrders;
  } catch (err) { console.error(err); }
}

// ═══════════════ MODALS ═══════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-ov').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); })
);

// ═══════════════ TOAST ═══════════════
function toast(msg, dur = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

// ═══════════════ HELM SCROLL ═══════════════
window.addEventListener('scroll', () => {
  const g = document.getElementById('homeHelmG');
  if (g) { g.style.animation = 'none'; g.style.transform = `rotate(${window.scrollY * 0.3}deg)`; }
}, { passive: true });

// ═══════════════ SCROLL SPY ═══════════════
document.getElementById('outletMenu')?.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('.menu-cat-section');
  let current = '';
  sections.forEach(s => { if (s.offsetTop <= outletMenu.scrollTop + 80) current = s.id.replace('sec-',''); });
  document.querySelectorAll('.os-cat').forEach(el => el.classList.toggle('on', el.textContent === current));
});