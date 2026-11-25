// app.js - POS MVP Simplified Cash-Only (Vanilla JS + Firebase)

import { db } from './firebase-config.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ============ STATE ============
let products = [];
let cart = [];
let selectedCustomerType = 'normal';
let unsubscribeProducts = null;
let confirmCallback = null;
let editingProductId = null;

// ============ DOM ELEMENTS (populated in initElements) ============
const views = {};
const elements = {};

// ============ CONSTANTS ============
const COL = {
  products: 'products',
  sales: 'sales'
};

const DISCOUNTS = { normal: 0, forta: 0 }; // Forta price already includes discount, no extra %
// Formato simple sin problemas de locale ARS
const FORMAT = (val) => '$' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cash register sound using Web Audio API - realistic mechanical "ka-ching"
function playCashRegisterSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Master gain
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.4, now);
    
    // ===== FIRST "KA" - Lower thud =====
    const kaOsc = ctx.createOscillator();
    const kaGain = ctx.createGain();
    kaOsc.type = 'sine';
    kaOsc.frequency.setValueAtTime(220, now);      // A3
    kaOsc.frequency.exponentialRampToValueAtTime(110, now + 0.08); // Drop to A2
    kaGain.gain.setValueAtTime(0, now);
    kaGain.gain.linearRampToValueAtTime(0.5, now + 0.005);
    kaGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    kaOsc.connect(kaGain);
    kaGain.connect(masterGain);
    kaOsc.start(now);
    kaOsc.stop(now + 0.2);
    
    // ===== SECOND "CHING" - Metallic ring =====
    const chingTime = now + 0.08;
    
    // Fundamental
    const ching1 = ctx.createOscillator();
    const chingGain1 = ctx.createGain();
    ching1.type = 'sine';
    ching1.frequency.value = 1320; // E6
    chingGain1.gain.setValueAtTime(0, chingTime);
    chingGain1.gain.linearRampToValueAtTime(0.6, chingTime + 0.003);
    chingGain1.gain.exponentialRampToValueAtTime(0.001, chingTime + 0.8);
    ching1.connect(chingGain1);
    chingGain1.connect(masterGain);
    
    // Harmonic 2x
    const ching2 = ctx.createOscillator();
    const chingGain2 = ctx.createGain();
    ching2.type = 'sine';
    ching2.frequency.value = 2640; // E7
    chingGain2.gain.setValueAtTime(0, chingTime);
    chingGain2.gain.linearRampToValueAtTime(0.3, chingTime + 0.003);
    chingGain2.gain.exponentialRampToValueAtTime(0.001, chingTime + 0.6);
    ching2.connect(chingGain2);
    chingGain2.connect(masterGain);
    
    // Harmonic 3x
    const ching3 = ctx.createOscillator();
    const chingGain3 = ctx.createGain();
    ching3.type = 'sine';
    ching3.frequency.value = 3960; // ~B7
    chingGain3.gain.setValueAtTime(0, chingTime);
    chingGain3.gain.linearRampToValueAtTime(0.15, chingTime + 0.003);
    chingGain3.gain.exponentialRampToValueAtTime(0.001, chingTime + 0.5);
    ching3.connect(chingGain3);
    chingGain3.connect(masterGain);
    
    // Inharmonic partial for metallic quality (bell-like)
    const ching4 = ctx.createOscillator();
    const chingGain4 = ctx.createGain();
    ching4.type = 'sine';
    ching4.frequency.value = 1760 * 1.4; // ~2464 Hz (non-integer ratio)
    chingGain4.gain.setValueAtTime(0, chingTime);
    chingGain4.gain.linearRampToValueAtTime(0.2, chingTime + 0.003);
    chingGain4.gain.exponentialRampToValueAtTime(0.001, chingTime + 0.4);
    ching4.connect(chingGain4);
    chingGain4.connect(masterGain);
    
    // Fifth partial
    const ching5 = ctx.createOscillator();
    const chingGain5 = ctx.createGain();
    ching5.type = 'sine';
    ching5.frequency.value = 1760 * 2.5; // ~4400 Hz
    chingGain5.gain.setValueAtTime(0, chingTime);
    chingGain5.gain.linearRampToValueAtTime(0.1, chingTime + 0.003);
    chingGain5.gain.exponentialRampToValueAtTime(0.001, chingTime + 0.3);
    ching5.connect(chingGain5);
    chingGain5.connect(masterGain);
    
    ching1.start(chingTime);
    ching1.stop(chingTime + 0.9);
    ching2.start(chingTime);
    ching2.stop(chingTime + 0.7);
    ching3.start(chingTime);
    ching3.stop(chingTime + 0.6);
    ching4.start(chingTime);
    ching4.stop(chingTime + 0.5);
    ching5.start(chingTime);
    ching5.stop(chingTime + 0.4);
    
    // ===== MECHANICAL CLICK (drawer) =====
    const clickTime = now + 0.16;
    const clickNoise = ctx.createBufferSource();
    const clickGain = ctx.createGain();
    const bufferSize = ctx.sampleRate * 0.02; // 20ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Short noise burst
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    clickNoise.buffer = buffer;
    clickGain.gain.setValueAtTime(0.3, clickTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.05);
    clickNoise.connect(clickGain);
    clickGain.connect(masterGain);
    clickNoise.start(clickTime);
    
    // Master fade out
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
  } catch (e) {
    console.log('Audio not available:', e);
  }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initNavigation();
  initProductEntry();
  initCustomerType();
  initCartActions();
  initModal();
  initPosListeners();
  loadSalesHistory();
});

function initElements() {
  views.pos = document.getElementById('view-pos');
  views.history = document.getElementById('view-history');
  views.products = document.getElementById('view-products');

  elements.customerType = document.getElementById('customer-type');
  elements.productEntryModule = document.getElementById('product-entry');
  elements.formProductEntry = document.getElementById('form-product-entry');
  elements.peName = document.getElementById('pe-name');
  elements.pePriceNormal = document.getElementById('pe-price-normal');
  elements.pePriceForta = document.getElementById('pe-price-forta');
  elements.peStock = document.getElementById('pe-stock');
  elements.productGrid = document.getElementById('product-grid');
  elements.productCount = document.getElementById('product-count');
  elements.emptyState = document.getElementById('empty-state');
  elements.cartItems = document.getElementById('cart-items');
  elements.cartEmpty = document.getElementById('cart-empty');
  elements.cartSubtotal = document.getElementById('cart-subtotal');
  elements.cartDiscount = document.getElementById('cart-discount');
  elements.cartTotal = document.getElementById('cart-total');
  elements.btnCheckout = document.getElementById('btn-checkout');
  elements.btnClearCart = document.getElementById('btn-clear-cart');
  elements.salesList = document.getElementById('sales-list');
  elements.salesEmpty = document.getElementById('sales-empty');
  elements.productsManagementList = document.getElementById('products-management-list');
  elements.productsEmpty = document.getElementById('products-empty');
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.confirmModal = document.getElementById('confirm-modal');
  elements.modalMessage = document.getElementById('modal-message');
  elements.modalCancel = document.getElementById('modal-cancel');
  elements.modalConfirm = document.getElementById('modal-confirm');
}

// ============ NAVIGATION ============
function initNavigation() {
  elements.navItems.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(viewName) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('active', key === viewName);
    el.classList.toggle('is-hidden', key !== viewName);
  });
  elements.navItems.forEach(btn => {
    const active = btn.dataset.view === viewName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  if (viewName !== 'products') {
    closeProductEntry();
    cancelEdit();
  }
}

// ============ PRODUCT ENTRY FORM ============
function initProductEntry() {
  const toggle = elements.productEntryModule.querySelector('.module-toggle');
  toggle.addEventListener('click', toggleProductEntry);
  elements.formProductEntry.addEventListener('submit', saveProductEntry);
}

function toggleProductEntry() {
  const module = elements.productEntryModule;
  const form = elements.formProductEntry;
  const isClosed = module.classList.toggle('closed');
  const isHidden = form.classList.toggle('is-hidden');
  module.querySelector('.module-toggle').setAttribute('aria-expanded', !isClosed);
  if (!isClosed) {
    elements.peName.focus();
  }
}

function closeProductEntry() {
  elements.productEntryModule.classList.add('closed');
  elements.formProductEntry.classList.add('is-hidden');
  elements.productEntryModule.querySelector('.module-toggle').setAttribute('aria-expanded', 'false');
  elements.formProductEntry.reset();
  editingProductId = null;
  const submitBtn = elements.formProductEntry.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Guardar Producto';
}

async function saveProductEntry(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = editingProductId ? 'Actualizando...' : 'Guardando...';

  const data = {
    name: elements.peName.value.trim(),
    prices: {
      normal: parseFloat(elements.pePriceNormal.value) || 0,
      forta: parseFloat(elements.pePriceForta.value) || null
    },
    stock: parseInt(elements.peStock.value) || 0,
    minStock: 5,
    active: true,
    updatedAt: serverTimestamp()
  };

  if (!data.name || data.prices.normal <= 0) {
    showAlert('Completa nombre y precio normal', 'error');
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }

  if (data.prices.forta === null) delete data.prices.forta;

  try {
    if (editingProductId) {
      await updateDoc(doc(db, COL.products, editingProductId), data);
      showAlert('Producto actualizado', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COL.products), data);
      showAlert('Producto guardado', 'success');
    }
    closeProductEntry();
  } catch (err) {
    showAlert('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function startEditProduct(product) {
  editingProductId = product.id;
  elements.peName.value = product.name;
  elements.pePriceNormal.value = product.prices?.normal || product.priceNormal || '';
  elements.pePriceForta.value = product.prices?.forta || '';
  elements.peStock.value = product.stock || 0;
  
  elements.productEntryModule.classList.remove('closed');
  elements.formProductEntry.classList.remove('is-hidden');
  elements.productEntryModule.querySelector('.module-toggle').setAttribute('aria-expanded', 'true');
  
  const submitBtn = elements.formProductEntry.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Actualizar Producto';
  
  elements.peName.focus();
  elements.peName.select();
  
  elements.productEntryModule.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  if (editingProductId) {
    closeProductEntry();
  }
}

// ============ CUSTOMER TYPE ============
function initCustomerType() {
  elements.customerType.addEventListener('change', (e) => {
    selectedCustomerType = e.target.value;
    recalcCart();
    renderProducts();
    showAlert(selectedCustomerType === 'forta' ? 'Cliente Forta (VIP)' : 'Cliente Normal', 'info');
  });
}

// ============ CART ACTIONS ============
function initCartActions() {
  elements.btnClearCart.addEventListener('click', () => confirmAction('¿Limpiar todo el carrito?', clearCart));
  elements.btnCheckout.addEventListener('click', completeSale);
}

// ============ MODAL ============
function initModal() {
  elements.modalCancel.addEventListener('click', closeModal);
  elements.modalConfirm.addEventListener('click', () => { confirmCallback?.(); closeModal(); });
  elements.confirmModal.addEventListener('click', (e) => { if (e.target === elements.confirmModal) closeModal(); });
}

function confirmAction(message, callback) {
  elements.modalMessage.textContent = message;
  confirmCallback = callback;
  elements.confirmModal.showModal();
}

function closeModal() {
  elements.confirmModal.close();
  confirmCallback = null;
}

// ============ FIREBASE REAL-TIME ============
function initPosListeners() {
  console.log('Setting up products listener...');
  unsubscribeProducts = onSnapshot(
    query(collection(db, COL.products), orderBy('name')),
    (snap) => {
      console.log('Products snapshot received:', snap.docs.length, 'docs');
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderProducts();
      renderProductsManagement();
    },
    (err) => {
      console.error('Products listener error:', err);
      showAlert('Error cargando productos: ' + err.message, 'error');
    }
  );
}

// ============ RENDER PRODUCTS (POS Grid) ============
function renderProducts() {
  const activeProducts = products.filter(p => p.active !== false);
  elements.productCount.textContent = activeProducts.length;
  elements.emptyState.classList.toggle('is-hidden', activeProducts.length > 0);

  elements.productGrid.innerHTML = activeProducts.map(p => {
    const price = getPriceForType(p, selectedCustomerType);
    const stock = p.stock || 0;
    const isLow = stock > 0 && stock <= (p.minStock || 5);
    const isOut = stock <= 0;
    const isFortaPrice = selectedCustomerType === 'forta' && p.prices?.forta != null;

    return `
      <button class="product-btn ${isFortaPrice ? 'forta' : ''} ${isLow ? 'low-stock' : ''} ${isOut ? 'out-of-stock' : ''}"
              data-id="${p.id}"
              ${isOut ? 'disabled aria-disabled="true"' : ''}
              aria-label="${escapeHtml(p.name)} - ${FORMAT(price)}${isLow ? ' - Stock bajo' : ''}${isOut ? ' - Sin stock' : ''}">
        <span class="product-name">${escapeHtml(p.name)}</span>
        <span class="product-price">${FORMAT(price)}</span>
        <span class="product-stock">Stock: ${stock}</span>
      </button>
    `;
  }).join('');

  elements.productGrid.querySelectorAll('.product-btn:not(.out-of-stock)').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
    btn.addEventListener('touchstart', () => btn.style.transform = 'scale(0.96)', { passive: true });
    btn.addEventListener('touchend', () => btn.style.transform = '', { passive: true });
  });
}

function getPriceForType(product, type) {
  const prices = product.prices || {};
  if (type === 'forta' && prices.forta != null) return prices.forta;
  return prices.normal || 0;
}

// ============ RENDER PRODUCTS MANAGEMENT ============
function renderProductsManagement() {
  const activeProducts = products.filter(p => p.active !== false);
  elements.productsEmpty.classList.toggle('is-hidden', activeProducts.length > 0);

  elements.productsManagementList.innerHTML = activeProducts.map(p => {
    const normalPrice = p.prices?.normal || p.priceNormal || 0;
    const fortaPrice = p.prices?.forta;
    const stock = p.stock || 0;
    const isLow = stock > 0 && stock <= (p.minStock || 5);
    
    return `
      <li class="management-item" data-id="${p.id}">
        <div class="item-info">
          <div class="item-name">${escapeHtml(p.name)}</div>
          <div class="item-meta">
            <span>Normal: ${FORMAT(normalPrice)}</span>
            ${fortaPrice != null ? `<span>• Forta: ${FORMAT(fortaPrice)}</span>` : ''}
            <span>• Stock: ${stock}${isLow ? ' ⚠️' : ''}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-secondary btn-edit" data-id="${p.id}" aria-label="Editar ${escapeHtml(p.name)}">✏️</button>
          <button class="btn btn-sm btn-danger btn-delete" data-id="${p.id}" aria-label="Eliminar ${escapeHtml(p.name)}">🗑️</button>
        </div>
      </li>
    `;
  }).join('');

  elements.productsManagementList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const product = products.find(p => p.id === btn.dataset.id);
      if (product) startEditProduct(product);
    });
  });
  
  elements.productsManagementList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const product = products.find(p => p.id === btn.dataset.id);
      if (product) confirmAction(`¿Eliminar "${product.name}"?`, () => deleteProduct(btn.dataset.id));
    });
  });
}

async function deleteProduct(productId) {
  try {
    await updateDoc(doc(db, COL.products, productId), { active: false, updatedAt: serverTimestamp() });
    showAlert('Producto desactivado', 'success');
  } catch (err) {
    showAlert('Error: ' + err.message, 'error');
  }
}

// ============ CART LOGIC ============
let currentCartTotal = 0; // Store calculated total to avoid DOM parsing issues

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const stock = product.stock || 0;
  const existing = cart.find(i => i.productId === productId);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty >= stock) {
    showAlert('Sin stock disponible', 'error');
    return;
  }

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: getPriceForType(product, selectedCustomerType),
      cost: product.cost || 0,
      qty: 1
    });
  }
  recalcCart();
  showAlert(`Agregado: ${product.name}`, 'success');
  if (navigator.vibrate) navigator.vibrate(10);
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.productId !== productId);
  recalcCart();
}

function updateQty(productId, delta) {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  const product = products.find(p => p.id === productId);
  const maxStock = product?.stock || 0;
  const newQty = item.qty + delta;
  if (newQty <= 0) return removeFromCart(productId);
  if (newQty > maxStock) { showAlert(`Máximo ${maxStock} unidades`, 'error'); return; }
  item.qty = newQty;
  recalcCart();
}

function recalcCart() {
  let subtotal = 0;
  cart.forEach(item => { subtotal += item.price * item.qty; });

  const discountPct = DISCOUNTS[selectedCustomerType] || 0;
  const discountAmt = subtotal * discountPct;
  const finalTotal = subtotal - discountAmt;
  
  // Store for completeSale to avoid DOM parsing issues
  currentCartTotal = finalTotal;

  elements.cartSubtotal.textContent = FORMAT(subtotal);
  elements.cartDiscount.textContent = discountAmt > 0 ? `-${FORMAT(discountAmt)}` : '-$0.00';
  elements.cartTotal.textContent = FORMAT(finalTotal);
  elements.btnCheckout.disabled = cart.length === 0;

  renderCart();
}

function renderCart() {
  if (cart.length === 0) {
    elements.cartItems.innerHTML = '';
    elements.cartEmpty.classList.remove('is-hidden');
    return;
  }
  elements.cartEmpty.classList.add('is-hidden');
  elements.cartItems.innerHTML = cart.map(item => `
    <li class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${FORMAT(item.price)} c/u</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" data-action="dec" data-id="${item.productId}" aria-label="Disminuir">−</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn" data-action="inc" data-id="${item.productId}" aria-label="Aumentar">+</button>
      </div>
      <div class="cart-item-total">${FORMAT(item.price * item.qty)}</div>
      <button class="cart-item-remove" data-id="${item.productId}" aria-label="Eliminar">🗑️</button>
    </li>
  `).join('');

  elements.cartItems.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => updateQty(btn.dataset.id, btn.dataset.action === 'inc' ? 1 : -1));
  });
  elements.cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });
}

function clearCart() {
  cart = [];
  currentCartTotal = 0;
  recalcCart();
}

// ============ COMPLETE SALE - ONE TAP ============
async function completeSale() {
  if (cart.length === 0) return;

  const btn = elements.btnCheckout;
  btn.disabled = true;
  btn.classList.add('processing');
  btn.textContent = 'Procesando...';

  const total = currentCartTotal;

  const batch = writeBatch(db);
  const saleRef = doc(collection(db, COL.sales));

  const saleData = {
    customerType: selectedCustomerType,
    paymentMethod: 'cash',
    items: cart.map(i => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      cost: i.cost,
      qty: i.qty,
      subtotal: i.price * i.qty
    })),
    subtotal: cart.reduce((s, i) => s + i.price * i.qty, 0),
    discount: 0, // No extra discount - Forta price already includes it
    total,
    paid: total,
    change: 0,
    status: 'completed',
    createdAt: serverTimestamp()
  };
  batch.set(saleRef, saleData);

  // Atomic stock decrement using increment() to avoid race conditions
  for (const item of cart) {
    const productRef = doc(db, COL.products, item.productId);
    batch.update(productRef, { stock: increment(-item.qty) });
  }

  try {
    await batch.commit();
    playCashRegisterSound();
    showAlert(`Vendido - ${FORMAT(total)}`, 'success');
    clearCart();
    loadSalesHistory();
  } catch (e) {
    showAlert('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('processing');
    btn.textContent = 'COBRAR EFECTIVO';
  }
}

// ============ SALES HISTORY ============
function loadSalesHistory() {
  console.log('Loading sales history...');
  onSnapshot(query(collection(db, COL.sales), orderBy('createdAt', 'desc')), (snap) => {
    console.log('Sales snapshot received:', snap.docs.length, 'docs');
    const sales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('Sales data:', sales);
    renderSalesHistory(sales);
  }, (err) => {
    console.error('Sales listener error:', err);
    showAlert('Error cargando ventas: ' + err.message, 'error');
  });
}

function renderSalesHistory(sales) {
  elements.salesEmpty.classList.toggle('is-hidden', sales.length > 0);
  elements.salesList.innerHTML = sales.map(s => {
    const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
    const timeStr = date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const customerLabel = s.customerType === 'forta' ? 'Forta (VIP)' : 'Normal';
    return `
      <li class="sale-item">
        <div class="item-info">
          <div class="item-name">${s.items?.length || 0} productos</div>
          <div class="item-meta">
            <span class="sale-customer ${s.customerType}">${customerLabel}</span>
            <span>${timeStr}</span>
          </div>
        </div>
        <div class="sale-total">${FORMAT(s.total || 0)}</div>
      </li>
    `;
  }).join('');
}

// ============ ALERTS (replacing toasts) ============
function showAlert(message, type = 'info') {
  // Disabled - alerts interfered with workflow
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============ HELPERS ============
function escapeHtml(str) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": "'" };
  return String(str).replace(/[&<>"']/g, s => map[s]);
}