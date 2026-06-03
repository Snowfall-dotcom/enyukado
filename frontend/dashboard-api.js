// ======================================================
// ENYUKADO - dashboard-api.js
// ======================================================

// ======================================================
// AUTH GUARD
// ======================================================
(function () {
  const token = localStorage.getItem('userToken');
  if (!token) window.location.replace('index.html');
})();

const API_BASE = 'http://localhost:5000/api';
const token    = localStorage.getItem('userToken');
const myUserID = parseInt(localStorage.getItem('userID'));

let activeCategory = null;
let activeSort     = 'newest';
let activeSearch   = '';

// ======================================================
// PRODUCTS
// ======================================================
async function loadProducts() {
  const grid = document.getElementById('listingsGrid');
  if (!grid) return;

  const params = {};
  if (activeSearch)   params.search   = activeSearch;
  if (activeCategory) params.category = activeCategory;
  if (activeSort)     params.sort     = activeSort;

  const query = new URLSearchParams(params).toString();
  const url   = `${API_BASE}/products${query ? '?' + query : ''}`;

  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#888;">Loading...</div>`;

  try {
    const response = await fetch(url);
    const products = await response.json();

    if (!Array.isArray(products) || !products.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#888;">No listings found.</div>`;
      return;
    }

    grid.innerHTML = products.map(p => {
      // Use first image from images array, or fallback to ImageURL
      const imgURL = (p.images && p.images.length > 0) ? p.images[0].ImageURL : (p.ImageURL || p.imageURL);
      const condClass = p.ProductCondition === 'Poor' ? 'poor'
                      : (p.ProductCondition === 'Fair' || p.ProductCondition === 'Used') ? 'fair' : '';
      return `
      <div class="listing-card" onclick="openItemFromAPI(${p.ProductID})">
        <div class="listing-img">
          ${imgURL ? `<img src="${imgURL}" alt="${p.ProductName}">` : '📦'}
          <span class="listing-badge">${p.CategoryName || 'Others'}</span>
          <button class="listing-fav" data-id="${p.ProductID}" onclick="event.stopPropagation(); toggleFavCard(this)">♡</button>
        </div>
        <div class="listing-info">
          <h4>${p.ProductName}</h4>
          <div class="price">₱${parseFloat(p.Price).toLocaleString()}</div>
          <div class="meta">
            <span class="condition-dot ${condClass}"></span>
            ${p.ProductCondition} · ${p.sellerName || 'Student Seller'}
          </div>
        </div>
      </div>`;
    }).join('');

    syncCardHearts();
  } catch (err) {
    console.error('Failed to load products:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--red);">Failed to load listings. Is the server running?</div>`;
  }
}

// ======================================================
// OPEN ITEM MODAL
// ======================================================
async function openItemFromAPI(productID) {
  try {
    const response = await fetch(`${API_BASE}/products/${productID}`);
    const p = await response.json();

    // ── Images carousel ──
    const carousel = document.getElementById('itemImgCarousel');
    const images = (p.images && p.images.length > 0) ? p.images : (p.ImageURL ? [{ ImageURL: p.ImageURL }] : []);

    if (images.length > 0) {
      carousel.innerHTML = `
        <img src="${images[0].ImageURL}" alt="${p.ProductName}" class="item-img-main" id="itemMainImg"
             style="width:100%;height:200px;object-fit:contain;border-radius:10px;background:#f4f5f7;" />
        ${images.length > 1 ? `
          <div class="item-img-thumbs">
            ${images.map((img, i) => `
              <img src="${img.ImageURL}" class="item-img-thumb ${i === 0 ? 'active' : ''}" onclick="switchItemImg('${img.ImageURL}', this)" />
            `).join('')}
          </div>
        ` : ''}
      `;
    } else {
      carousel.innerHTML = '<div style="font-size:5rem;text-align:center;padding:20px 0;">📦</div>';
    }

    // ── Category ──
    let categoryName = p.CategoryName || 'Others';
    document.getElementById('itemModalCategory').textContent = categoryName;

    // ── Text content ──
    document.getElementById('itemModalTitle').textContent = p.ProductName;
    document.getElementById('itemModalPrice').textContent = `₱${parseFloat(p.Price).toLocaleString()}`;
    document.getElementById('itemModalDesc').textContent  = p.Description || 'No description provided.';

    // ── Seller ──
    const sellerInitials = p.SellerFirstName && p.SellerLastName
      ? (p.SellerFirstName[0] + p.SellerLastName[0]).toUpperCase()
      : (p.sellerName ? p.sellerName[0].toUpperCase() : '?');
    document.getElementById('sellerAvatar').textContent = sellerInitials;
    document.getElementById('sellerName').textContent   = p.sellerName || `${p.SellerFirstName || ''} ${p.SellerLastName || ''}`.trim() || 'Unknown';
    document.getElementById('sellerSub').textContent    = `Condition: ${p.ProductCondition}`;

    // ── Seller rating ──
    try {
      const reviewRes = await fetch(`${API_BASE}/reviews/user/${p.UserID}`);
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        document.getElementById('sellerRating').textContent = reviewData.averageRating || '—';
      }
    } catch(e) {}

    // ── Meta tags ──
    const postedAgo = p.DatePosted ? timeAgo(new Date(p.DatePosted)) : 'Recently';
    const condColor = p.ProductCondition === 'Like new' || p.ProductCondition === 'Good' ? '' :
                      p.ProductCondition === 'Fair' || p.ProductCondition === 'Used' ? 'fair' : 'poor';
    document.getElementById('itemMetaTags').innerHTML = `
      <div class="meta-tag"><span class="dot ${condColor}"></span> ${p.ProductCondition}</div>
      <div class="meta-tag">🏷️ ${categoryName}</div>
      <div class="meta-tag">🕐 ${postedAgo}</div>
      ${p.Quantity > 1 ? `<div class="meta-tag">📦 ${p.Quantity} units</div>` : ''}
    `;

    // ── Stock indicator ──
    const stockEl = document.getElementById('itemModalStock');
    if (p.Quantity > 1) { stockEl.textContent = `${p.Quantity} units available`; stockEl.style.color = 'var(--green)'; }
    else if (p.Quantity === 1) { stockEl.textContent = 'Last unit!'; stockEl.style.color = 'var(--orange)'; }
    else { stockEl.textContent = 'Out of stock'; stockEl.style.color = 'var(--red)'; }

    // ── Store product data on modal for buy/message actions ──
    const modal = document.getElementById('itemModal');
    modal.dataset.productId  = productID;
    modal.dataset.sellerID   = p.UserID;
    modal.dataset.sellerName = p.sellerName || `${p.SellerFirstName || ''} ${p.SellerLastName || ''}`.trim();
    modal.dataset.price      = p.Price;
    modal.dataset.name       = p.ProductName;
    modal.dataset.qrCode     = p.QRCodeImage || '';
    modal.dataset.imgUrl     = images.length > 0 ? images[0].ImageURL : '';

    // ── Show/hide Buy & Message buttons ──
    const buyBtn    = document.getElementById('buyBtn');
    const msgBtn    = document.getElementById('msgSellerBtn');

    if (p.UserID === myUserID) {
      // Own listing — hide buy and message
      buyBtn.style.display = 'none';
      msgBtn.style.display = 'none';
    } else {
      buyBtn.style.display = '';
      msgBtn.style.display = '';
      if (p.Quantity <= 0 || p.Status === 'Sold') {
        buyBtn.disabled = true;
        buyBtn.textContent = 'Out of Stock';
      } else {
        buyBtn.disabled = false;
        buyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          Buy Now`;
      }
    }

    // ── Wire Buy button ──
    buyBtn.onclick = () => openPaymentModal();

    // ── Wire Message Seller button ──
    msgBtn.onclick = () => {
      document.getElementById('itemModal').classList.remove('open');
      openMessagesWithUser(parseInt(modal.dataset.sellerID), modal.dataset.sellerName);
    };

    // ── Wire Save button ──
    document.getElementById('saveRowBtn').onclick = () => toggleSaveItem();

    // Reflect saved state
    updateHeartBtn(productID);

    modal.classList.add('open');
  } catch (err) {
    console.error('Failed to load product:', err);
    showDashToast('Failed to load product.', 'error');
  }
}

// Switch main image in carousel
window.switchItemImg = function(url, thumb) {
  const mainImg = document.getElementById('itemMainImg');
  if (mainImg) mainImg.src = url;
  document.querySelectorAll('.item-img-thumb').forEach(t => t.classList.remove('active'));
  if (thumb) thumb.classList.add('active');
};

// ======================================================
// SAVE / UNSAVE
// ======================================================
window.toggleFavCard = async function(btn) {
  const id = parseInt(btn.dataset.id);
  const isLiked = btn.classList.contains('liked');
  btn.classList.toggle('liked', !isLiked);
  btn.textContent = isLiked ? '♡' : '♥';
  btn.style.color = isLiked ? '' : 'var(--red)';
  try {
    if (isLiked) {
      await fetch(`${API_BASE}/saved/${id}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
    } else {
      await fetch(`${API_BASE}/saved`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ productID: id }) });
    }
  } catch(e) {
    btn.classList.toggle('liked', isLiked);
    btn.textContent = isLiked ? '♥' : '♡';
    btn.style.color = isLiked ? 'var(--red)' : '';
  }
};

async function syncCardHearts() {
  if (!token) return;
  try {
    const res   = await fetch(`${API_BASE}/saved`, { headers: { 'x-auth-token': token } });
    const saved = await res.json();
    const savedIds = new Set(saved.map(p => p.ProductID));
    document.querySelectorAll('.listing-fav[data-id]').forEach(btn => {
      const id = parseInt(btn.dataset.id);
      btn.classList.toggle('liked', savedIds.has(id));
      btn.textContent = savedIds.has(id) ? '♥' : '♡';
      btn.style.color = savedIds.has(id) ? 'var(--red)' : '';
    });
  } catch(e) {}
}

async function updateHeartBtn(productId) {
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/saved/check/${productId}`, { headers: { 'x-auth-token': token } });
    const { saved } = await res.json();
    const btn = document.getElementById('itemFavBtn');
    if (!btn) return;
    btn.textContent = saved ? '♥' : '♡';
    btn.style.color = saved ? 'var(--red)' : '';
  } catch(e) {}
}

window.toggleSaveItem = async function() {
  const modal = document.getElementById('itemModal');
  const id    = parseInt(modal.dataset.productId);
  if (!id) return;
  const btn = document.getElementById('itemFavBtn');
  const isLiked = btn?.textContent === '♥';
  if (btn) { btn.textContent = isLiked ? '♡' : '♥'; btn.style.color = isLiked ? '' : 'var(--red)'; }
  const saveRow = document.getElementById('saveRowBtn');
  try {
    if (isLiked) {
      await fetch(`${API_BASE}/saved/${id}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
      showDashToast('Removed from saved items.');
      if (saveRow) { saveRow.classList.remove('saved'); saveRow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> Save for later`; }
    } else {
      await fetch(`${API_BASE}/saved`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, body: JSON.stringify({ productID: id }) });
      showDashToast('Saved! View in your profile → Saved tab.');
      if (saveRow) { saveRow.classList.add('saved'); saveRow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--blue)" stroke="var(--blue)" stroke-width="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> Saved`; }
    }
    syncCardHearts();
  } catch(e) {
    if (btn) { btn.textContent = isLiked ? '♥' : '♡'; btn.style.color = isLiked ? 'var(--red)' : ''; }
  }
};

// ======================================================
// PAYMENT MODAL
// ======================================================
let selectedPaymentMethod = null;
let proofFileData         = null;
let proofFileDataEbank    = null;

function openPaymentModal() {
  const modal      = document.getElementById('itemModal');
  const name       = modal.dataset.name;
  const price      = modal.dataset.price;
  const imgUrl     = modal.dataset.imgUrl;
  const qrCode     = modal.dataset.qrCode;
  const sellerName = modal.dataset.sellerName;
  const formatted  = `₱${parseFloat(price).toLocaleString()}`;

  // Populate summary
  const imgEl = document.getElementById('paymentItemImg');
  imgEl.innerHTML = imgUrl
    ? `<img src="${imgUrl}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;" />`
    : '📦';

  document.getElementById('paymentItemName').textContent  = name;
  document.getElementById('paymentItemPrice').textContent = formatted;
  document.getElementById('qrAmount').textContent         = formatted;
  document.getElementById('confirmAmount').textContent    = formatted;
  document.getElementById('confirmSeller').textContent    = sellerName || 'the seller';
  document.getElementById('confirmAmountEbank').textContent = formatted;
  document.getElementById('confirmSellerEbank').textContent = sellerName || 'the seller';
  document.getElementById('ebankAmount').textContent      = formatted;

  // QR code — object-fit:contain handles portrait images
  const qrImg  = document.getElementById('qrCodeImg');
  const qrNone = document.getElementById('qrNoCode');
  if (qrCode) {
    qrImg.src = qrCode; qrImg.style.display = 'block'; qrNone.style.display = 'none';
  } else {
    qrImg.style.display = 'none'; qrNone.style.display = 'block';
  }

  // Reset everything
  selectedPaymentMethod = null;
  proofFileData = null;
  proofFileDataEbank = null;
  ['proofPreview','proofPreviewEbank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.src = ''; }
  });
  ['proofFile','proofFileEbank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['confirmPaidCheck','confirmPaidCheckEbank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  ['submitPaymentBtn','submitPaymentBtnEbank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = true; el.style.opacity = '0.5'; }
  });
  // Reset ebank card display
  document.getElementById('ebankCardNum').textContent  = '•••• •••• •••• ••••';
  document.getElementById('ebankCardName').textContent = 'Your Name';
  document.getElementById('ebankCardExp').textContent  = 'MM/YY';
  ['ebankNum','ebankExp','ebankCvc','ebankName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
  const nextBtn = document.getElementById('paymentStep1Next');
  nextBtn.disabled = true; nextBtn.style.opacity = '0.5';
  goToStep(1);

  document.getElementById('itemModal').classList.remove('open');
  document.getElementById('paymentModal').classList.add('open');
}

window.selectPaymentMethod = function(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById(method === 'GCash' ? 'pmGcash' : 'pmEbank').classList.add('selected');
  const nextBtn = document.getElementById('paymentStep1Next');
  nextBtn.disabled = false; nextBtn.style.opacity = '1';
  nextBtn.textContent = method === 'GCash' ? 'Next — View QR Code →' : 'Next — Enter Card Details →';
};

window.goToPaymentStep2 = function() {
  if (!selectedPaymentMethod) return;
  goToStep(2);
};

window.goBackToStep1 = function() {
  goToStep(1);
};

function goToStep(step) {
  const isGCash = selectedPaymentMethod === 'GCash';
  document.getElementById('paymentStep1').style.display         = step === 1 ? 'block' : 'none';
  document.getElementById('paymentStep2GCash').style.display    = step === 2 && isGCash ? 'block' : 'none';
  document.getElementById('paymentStep2Ebank').style.display    = step === 2 && !isGCash ? 'block' : 'none';
  document.getElementById('step1Indicator').className = 'payment-step' + (step === 1 ? ' active' : ' done');
  document.getElementById('step2Indicator').className = 'payment-step' + (step === 2 ? ' active' : '');
}

// ── Card number formatter ──
window.formatCardNum = function(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
  document.getElementById('ebankCardNum').textContent = input.value || '•••• •••• •••• ••••';
};
window.formatExpiry = function(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2);
  input.value = v;
  document.getElementById('ebankCardExp').textContent = input.value || 'MM/YY';
};

// ── GCash proof upload ──
window.handleProofUpload = function(input) {
  const file = input.files[0];
  if (!file) return;
  proofFileData = file;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('proofPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
  updateSubmitBtn();
};
window.updateSubmitBtn = function() {
  const checked  = document.getElementById('confirmPaidCheck').checked;
  const hasProof = proofFileData !== null;
  const btn      = document.getElementById('submitPaymentBtn');
  const enabled  = checked && hasProof;
  btn.disabled = !enabled; btn.style.opacity = enabled ? '1' : '0.5';
};

// ── E-bank proof upload ──
window.handleProofUploadEbank = function(input) {
  const file = input.files[0];
  if (!file) return;
  proofFileDataEbank = file;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('proofPreviewEbank');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
  updateSubmitBtnEbank();
};
window.updateSubmitBtnEbank = function() {
  const checked = document.getElementById('confirmPaidCheckEbank').checked;
  const btn     = document.getElementById('submitPaymentBtnEbank');
  btn.disabled = !checked;
  btn.style.opacity = checked ? '1' : '0.5';
};

// ── Submit GCash payment ──
window.submitPayment = async function() {
  const productID = document.getElementById('itemModal').dataset.productId;
  if (!productID || !proofFileData) { showDashToast('Please upload proof of payment.', 'error'); return; }
  await doSubmitPayment(productID, 'GCash', proofFileData, 'submitPaymentBtn');
};

// ── Submit E-bank payment ──
window.submitPaymentEbank = async function() {
  const productID = document.getElementById('itemModal').dataset.productId;
  if (!productID) { showDashToast('Something went wrong.', 'error'); return; }
  await doSubmitPayment(productID, 'E-bank', null, 'submitPaymentBtnEbank');
};

async function doSubmitPayment(productID, method, proofFile, btnID) {
  const btn = document.getElementById(btnID);
  btn.disabled = true; btn.textContent = 'Submitting…';

  try {
    const formData = new FormData();
    formData.append('productID',     productID);
    formData.append('paymentMethod', method);
    if (proofFile) formData.append('paymentProof', proofFile);

    const response = await fetch(`${API_BASE}/transactions`, {
      method:  'POST',
      headers: { 'x-auth-token': token },
      body:    formData
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('paymentModal').classList.remove('open');
      showDashToast('Purchase submitted! Awaiting admin confirmation. 🎉');
      loadProducts();
      loadActivity();
    } else {
      showDashToast(data.message || 'Failed to submit purchase.', 'error');
      btn.disabled = false; btn.textContent = 'Submit Purchase';
    }
  } catch (err) {
    showDashToast('Server is offline.', 'error');
    btn.disabled = false; btn.textContent = 'Submit Purchase';
  }
}

// ======================================================
// SELL MODAL — multi-image
// ======================================================
let selectedFiles = [];

window.handleImagesSelected = function(input) {
  const newFiles = Array.from(input.files);
  const remaining = 5 - selectedFiles.length;
  const toAdd = newFiles.slice(0, remaining);

  if (newFiles.length > remaining) {
    showDashToast(`Only ${remaining} more photo(s) allowed (max 5).`, 'error');
  }

  toAdd.forEach(file => {
    selectedFiles.push(file);
    addImageThumb(file, selectedFiles.length - 1);
  });

  input.value = ''; // reset so same file can be re-added if removed
  updateUploadUI();
};

function addImageThumb(file, index) {
  const grid = document.getElementById('imgPreviewGrid');
  const reader = new FileReader();
  reader.onload = e => {
    const thumb = document.createElement('div');
    thumb.className = 'img-thumb';
    thumb.dataset.index = index;
    thumb.innerHTML = `
      <img src="${e.target.result}" alt="photo ${index + 1}" />
      <button class="img-thumb-remove" onclick="removeImageThumb(${index})" type="button">✕</button>
      ${index === 0 ? '<div class="img-thumb-primary">MAIN</div>' : ''}
    `;
    grid.appendChild(thumb);
  };
  reader.readAsDataURL(file);
}

window.removeImageThumb = function(index) {
  selectedFiles.splice(index, 1);
  rebuildThumbs();
  updateUploadUI();
};

function rebuildThumbs() {
  const grid = document.getElementById('imgPreviewGrid');
  grid.innerHTML = '';
  selectedFiles.forEach((file, i) => addImageThumb(file, i));
}

function updateUploadUI() {
  const count = selectedFiles.length;
  document.getElementById('uploadCount').textContent = `${count} / 5 photos`;
  document.getElementById('uploadZone').style.display = count >= 5 ? 'none' : 'block';
}

function resetSellForm() {
  selectedFiles = [];
  document.getElementById('imgPreviewGrid').innerHTML = '';
  document.getElementById('uploadCount').textContent = '0 / 5 photos';
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('itemName').value      = '';
  document.getElementById('itemPrice').value     = '';
  document.getElementById('itemCategory').value  = '';
  document.getElementById('itemCondition').value = '';
  document.getElementById('itemDesc').value      = '';
  document.getElementById('itemQuantity').value  = '1';
  document.getElementById('sellModalTitle').textContent = 'Post a listing';
  const btn = document.getElementById('submitListing');
  if (btn) { btn.textContent = 'Post listing'; delete btn.dataset.editProductID; }
}

// ======================================================
// SELLER PROFILE
// ======================================================
window.viewSellerProfile = function() {
  const modal = document.getElementById('itemModal');
  const sellerID = modal?.dataset.sellerID;
  if (!sellerID) return;
  if (String(sellerID) === String(myUserID)) {
    window.location.href = 'profile.html';
  } else {
    window.location.href = `profile.html?id=${sellerID}`;
  }
};

// ======================================================
// CATEGORIES
// ======================================================
async function loadCategories() {
  try {
    const response   = await fetch(`${API_BASE}/categories`);
    const categories = await response.json();
    const sorted = [
      ...categories.filter(c => c.CategoryName !== 'Others'),
      ...categories.filter(c => c.CategoryName === 'Others')
    ];

    // Sell form dropdown
    const select = document.getElementById('itemCategory');
    if (select) {
      select.innerHTML = `<option value="">Select category</option>` +
        sorted.map(c => `<option value="${c.CategoryID}">${c.CategoryName}</option>`).join('');
    }

    // Category chips
    const chipsContainer = document.getElementById('categoryChips');
    if (chipsContainer) {
      const EMOJI = { 'Books':'📚','Electronics':'💻','Clothing':'👕','School Supplies':'🎒','Sports & Recreation':'⚽','Food & Drinks':'🍱','Services':'🛠️','Others':'📦' };
      const allChip = chipsContainer.querySelector('.chip');
      chipsContainer.innerHTML = '';
      if (allChip) chipsContainer.appendChild(allChip);
      sorted.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.dataset.categoryId = c.CategoryID;
        btn.innerHTML = `<span>${EMOJI[c.CategoryName] || '🏷️'}</span> ${c.CategoryName}`;
        chipsContainer.appendChild(btn);
      });
      wireChips();
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function wireChips() {
  document.querySelectorAll('#categoryChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.categoryId || null;
      loadProducts();
    });
  });
}

// ======================================================
// ACTIVITY
// ======================================================
async function loadActivity() {
  const activityList = document.getElementById('activityList');
  if (!activityList) return;
  try {
    const [purchasesRes, listingsRes] = await Promise.all([
      fetch(`${API_BASE}/transactions/my/purchases`, { headers: { 'x-auth-token': token } }),
      fetch(`${API_BASE}/products/my/listings`,      { headers: { 'x-auth-token': token } })
    ]);
    const purchases = await purchasesRes.json();
    const listings  = await listingsRes.json();
    const activities = [];

    purchases.forEach(t => {
      activities.push({
        type: 'buy', icon: '✅',
        title: `You bought "${t.ProductName}"`,
        sub:   `₱${parseFloat(t.Price).toLocaleString()} · Status: ${t.Status}`,
        date:  new Date(t.TransactionDate)
      });
    });
    listings.forEach(p => {
      activities.push({
        type: 'sell', icon: '📦',
        title: `You listed "${p.ProductName}"`,
        sub:   `₱${parseFloat(p.Price).toLocaleString()} · ${p.Status}`,
        date:  new Date(p.DatePosted)
      });
    });

    activities.sort((a, b) => b.date - a.date);

    if (!activities.length) {
      activityList.innerHTML = `<div style="text-align:center;padding:24px;color:#888;font-size:0.88rem;">No activity yet.</div>`;
      return;
    }

    activityList.innerHTML = activities.slice(0, 5).map(a => `
      <div class="activity-item">
        <div class="activity-icon ${a.type}">${a.icon}</div>
        <div class="activity-text"><h5>${a.title}</h5><p>${a.sub}</p></div>
        <span class="activity-time">${timeAgo(a.date)}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load activity:', err);
  }
}

// ======================================================
// ======================================================
// MESSAGING — Full Teams-style
// ======================================================
let activeConvUserID   = null;
let activeConvUserName = null;
let activeConvUserData = null;
let msgPollInterval    = null;
let msgImageFile       = null;

// ── Conversation List ──
async function loadConversations() {
  try {
    const res   = await fetch(`${API_BASE}/messages/conversations`, { headers: { 'x-auth-token': token } });
    const convs = await res.json();
    const container = document.getElementById('convItems');
    const label     = document.getElementById('convSectionLabel');

    if (!Array.isArray(convs) || !convs.length) {
      if (label) label.textContent = '';
      container.innerHTML = `<div class="conv-empty">No conversations yet.<br>Click <strong>New Message</strong> to find someone!</div>`;
      return;
    }

    if (label) label.textContent = 'Recent';

    const BOT_ID = 4;
    container.innerHTML = convs.map(c => {
      const isBot    = c.OtherUserID === BOT_ID;
      const initials = isBot ? '🤖' : (c.OtherFirstName[0] + c.OtherLastName[0]).toUpperCase();
      const name     = `${c.OtherFirstName} ${c.OtherLastName}`;
      const preview  = c.LastImageURL
        ? '📷 Image'
        : c.LastMessage
          ? (c.LastMessage.length > 32 ? c.LastMessage.slice(0, 32) + '…' : c.LastMessage)
          : 'Start the conversation';
      const time = c.LastMessageDate ? timeAgo(new Date(c.LastMessageDate)) : '';
      const isActive = activeConvUserID === c.OtherUserID;

      const avatarStyle = isBot
        ? `style="background:linear-gradient(135deg,#326fca,#4e87d4);font-size:0.9rem;"`
        : '';

      return `
        <div class="conv-item ${isActive ? 'active' : ''}" onclick="openThread(${c.OtherUserID}, '${name.replace(/'/g,"\\'")}')">
          <div class="conv-avatar" ${avatarStyle}>${initials}</div>
          <div class="conv-info">
            <div class="conv-name">${name}</div>
            <div class="conv-last-msg">${preview}</div>
          </div>
          <div class="conv-meta">
            ${time ? `<div class="conv-time">${time}</div>` : ''}
            ${c.UnreadCount > 0 ? `<div class="conv-unread">${c.UnreadCount}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

// ── Unread Badge ──
async function loadUnreadCount() {
  try {
    const res   = await fetch(`${API_BASE}/messages/unread`, { headers: { 'x-auth-token': token } });
    const data  = await res.json();
    const badge = document.getElementById('msgBadge');
    if (data.unreadCount > 0) { badge.textContent = data.unreadCount; badge.classList.add('show'); }
    else badge.classList.remove('show');
  } catch(e) {}
}

// ── Open Thread ──
async function openThread(otherUserID, name) {
  activeConvUserID   = otherUserID;
  activeConvUserName = name;

  const BOT_ID   = 4;
  const isBot    = otherUserID === BOT_ID;
  const initials = isBot ? '🤖' : name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const avatarEl = document.getElementById('msgThreadAvatar');
  avatarEl.textContent = initials;
  avatarEl.style.background = isBot
    ? 'linear-gradient(135deg,#326fca,#4e87d4)'
    : '';
  avatarEl.style.cursor   = isBot ? 'default' : 'pointer';
  avatarEl.style.fontSize = isBot ? '0.9rem' : '';
  // Disable click for bot
  avatarEl.onclick = isBot ? null : () => goToUserProfile();

  const nameEl = document.getElementById('msgThreadName');
  nameEl.textContent = name;
  nameEl.style.cursor = isBot ? 'default' : 'pointer';
  nameEl.onclick = isBot ? null : () => goToUserProfile();

  document.getElementById('msgThreadSub').textContent    = isBot ? 'Enyukado · Automated Notifications' : '';
  document.getElementById('msgThreadEmpty').style.display  = 'none';
  document.getElementById('msgThreadActive').style.display = 'flex';

  // Load user sub-info for non-bot
  if (!isBot) {
    try {
      const uRes  = await fetch(`${API_BASE}/users/${otherUserID}`);
      const uData = await uRes.json();
      activeConvUserData = uData;
      const sub = [uData.Course, uData.Year, uData.CampusArea].filter(Boolean).join(' · ');
      document.getElementById('msgThreadSub').textContent = sub || 'NU Manila Student';
    } catch(e) {}
  }

  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.conv-item').forEach(el => {
    if (el.getAttribute('onclick')?.includes(String(otherUserID))) el.classList.add('active');
  });

  await loadThread();
}

// ── Go to user profile from thread header ──
window.goToUserProfile = function() {
  if (!activeConvUserID) return;
  if (String(activeConvUserID) === String(myUserID)) window.location.href = 'profile.html';
  else window.location.href = `profile.html?id=${activeConvUserID}`;
};

// ── Load Thread Messages ──
async function loadThread() {
  if (!activeConvUserID) return;
  try {
    const res  = await fetch(`${API_BASE}/messages/thread/${activeConvUserID}`, { headers: { 'x-auth-token': token } });
    const msgs = await res.json();
    const container = document.getElementById('msgMessages');

    if (!Array.isArray(msgs) || !msgs.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--charcoal-3);font-size:0.84rem;padding:32px;">Say hi! 👋</div>`;
    } else {
      const BOT_ID = 4;
      let lastDate = null;
      container.innerHTML = msgs.map(m => {
        const isBot    = m.SenderID === BOT_ID;
        const isMine   = m.SenderID === myUserID;
        const msgDate  = new Date(m.DateSent);
        const dateStr  = msgDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        const time     = msgDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

        let dateSep = '';
        if (dateStr !== lastDate) {
          dateSep = `<div class="msg-date-sep">${dateStr}</div>`;
          lastDate = dateStr;
        }

        const initials = isMine
          ? ''
          : isBot
            ? '🤖'
            : activeConvUserName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

        // Bot avatar — no click, gradient style
        const avatarHTML = !isMine
          ? isBot
            ? `<div class="msg-row-avatar" style="background:linear-gradient(135deg,#326fca,#4e87d4);cursor:default;font-size:0.85rem;">${initials}</div>`
            : `<div class="msg-row-avatar" onclick="goToUserProfile()">${initials}</div>`
          : '';

        const content = m.ImageURL
          ? `<img src="${m.ImageURL}" class="msg-image" onclick="openMsgLightbox('${m.ImageURL}')" alt="Image" />`
          : m.Content || '';

        return `${dateSep}
          <div class="msg-bubble-row ${isMine ? 'mine' : 'theirs'}">
            ${avatarHTML}
            <div class="msg-bubble">${content}</div>
          </div>
          <div class="msg-time-row">
            <span>${time}</span>
          </div>`;
      }).join('');
    }

    container.scrollTop = container.scrollHeight;
    loadConversations();
    loadUnreadCount();
  } catch(err) {
    console.error('Failed to load thread:', err);
  }
}

// ── Send Message ──
window.sendMessageInThread = async function() {
  const input   = document.getElementById('msgInput');
  const content = input.value.trim();
  if ((!content && !msgImageFile) || !activeConvUserID) return;

  input.value = '';
  autoResizeMsgInput(input);

  const formData = new FormData();
  formData.append('receiverID', activeConvUserID);
  if (content)      formData.append('content', content);
  if (msgImageFile) formData.append('messageImage', msgImageFile);

  removeMsgImage();

  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method:  'POST',
      headers: { 'x-auth-token': token },
      body:    formData
    });
    if (response.ok) await loadThread();
    else { const data = await response.json(); showDashToast(data.message || 'Failed to send.', 'error'); }
  } catch(err) {
    showDashToast('Server is offline.', 'error');
  }
};

// ── Image selection for message ──
window.handleMsgImageSelected = function(input) {
  const file = input.files[0];
  if (!file) return;
  msgImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const wrap = document.getElementById('msgImgPreviewWrap');
    const prev = document.getElementById('msgImgPreview');
    prev.src = e.target.result;
    wrap.classList.add('show');
  };
  reader.readAsDataURL(file);
  input.value = '';
};

window.removeMsgImage = function() {
  msgImageFile = null;
  const wrap = document.getElementById('msgImgPreviewWrap');
  const prev = document.getElementById('msgImgPreview');
  if (wrap) wrap.classList.remove('show');
  if (prev) prev.src = '';
  const input = document.getElementById('msgImageInput');
  if (input) input.value = '';
};

// ── Lightbox ──
window.openMsgLightbox = function(src) {
  const lb = document.getElementById('msgLightbox');
  document.getElementById('msgLightboxImg').src = src;
  lb.style.display = 'flex';
};
window.closeMsgLightbox = function() {
  document.getElementById('msgLightbox').style.display = 'none';
};

// ── Emoji Picker ──
window.toggleEmojiPicker = function(e) {
  e.stopPropagation();
  document.getElementById('emojiPicker').classList.toggle('open');
};

// Wire emoji buttons after DOM ready
function wireEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (!picker) return;
  picker.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('msgInput');
      input.value += btn.textContent;
      input.focus();
      picker.classList.remove('open');
    });
  });
  // Convert text nodes to buttons
  if (!picker.querySelector('.emoji-btn')) {
    const emojis = picker.textContent.trim().split(/\s+/).filter(e => e);
    picker.innerHTML = emojis.map(e => `<button class="emoji-btn" type="button">${e}</button>`).join('');
    picker.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('msgInput');
        input.value += btn.textContent;
        input.focus();
        picker.classList.remove('open');
      });
    });
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('#emojiPicker') && !e.target.closest('#emojiToggleBtn')) {
      picker.classList.remove('open');
    }
  });
}

// ── Auto-resize textarea ──
window.autoResizeMsgInput = function(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
};

window.handleMsgKeydown = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessageInThread();
  }
};

// ── User search for new conversation ──
async function searchUsers(query) {
  if (!query || query.length < 2) {
    document.getElementById('convSearchResults').classList.remove('open');
    return;
  }
  try {
    const res   = await fetch(`${API_BASE}/messages/search?q=${encodeURIComponent(query)}`, { headers: { 'x-auth-token': token } });
    const users = await res.json();
    const results = document.getElementById('convSearchResults');

    if (!users.length) {
      results.innerHTML = `<div style="padding:12px 14px;font-size:0.82rem;color:var(--charcoal-3);">No students found.</div>`;
    } else {
      results.innerHTML = users.map(u => {
        const initials = (u.FirstName[0] + u.LastName[0]).toUpperCase();
        const sub = [u.Course, u.Year].filter(Boolean).join(' · ') || 'NU Manila';
        return `
          <div class="conv-search-result-item" onclick="startNewConversation(${u.UserID}, '${u.FirstName} ${u.LastName}')">
            <div class="conv-search-avatar">${initials}</div>
            <div>
              <div class="conv-search-name">${u.FirstName} ${u.LastName}</div>
              <div class="conv-search-sub">${sub}</div>
            </div>
          </div>`;
      }).join('');
    }
    results.classList.add('open');
  } catch(err) {
    console.error('Search error:', err);
  }
}

window.startNewConversation = function(userID, name) {
  document.getElementById('convSearchResults').classList.remove('open');
  document.getElementById('convSearchInput').value = '';
  openThread(userID, name);
};

// ── Open messages modal ──
window.openMessagesWithUser = function(userID, userName) {
  document.getElementById('messagesModal').classList.add('open');
  loadConversations();
  if (userID && userName) setTimeout(() => openThread(userID, userName), 300);
  if (msgPollInterval) clearInterval(msgPollInterval);
  msgPollInterval = setInterval(() => {
    loadConversations();
    if (activeConvUserID) loadThread();
    loadUnreadCount();
  }, 5000);
};

// ======================================================
// DOM READY
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {

  // User greeting + avatar
  const firstName = localStorage.getItem('userName')     || '';
  const lastName  = localStorage.getItem('userLastName') || '';
  const greeting  = document.getElementById('heroGreeting');
  if (greeting && firstName) greeting.textContent = `Welcome back, ${firstName}! 👋`;
  const avatarBtn = document.getElementById('avatarBtn');
  if (avatarBtn) {
    if (firstName && lastName) avatarBtn.textContent = (firstName[0] + lastName[0]).toUpperCase();
    avatarBtn.addEventListener('click', () => { window.location.href = 'profile.html'; });
  }

  // Load initial data
  loadProducts();
  loadActivity();
  loadUnreadCount();
  await loadCategories();

  // Poll unread count every 30s
  setInterval(loadUnreadCount, 30000);

  // Handle redirect from profile (edit listing)
  const openProductID   = localStorage.getItem('openProductID');
  const editProductID   = localStorage.getItem('editProductID');
  const editProductData = localStorage.getItem('editProductData');

  if (openProductID) {
    localStorage.removeItem('openProductID');
    setTimeout(() => openItemFromAPI(parseInt(openProductID)), 400);
  }

  if (editProductID && editProductData) {
    localStorage.removeItem('editProductID');
    localStorage.removeItem('editProductData');
    const data = JSON.parse(editProductData);
    document.getElementById('itemName').value      = data.name        || '';
    document.getElementById('itemPrice').value     = data.price       || '';
    document.getElementById('itemCondition').value = data.condition   || '';
    document.getElementById('itemDesc').value      = data.description || '';
    document.getElementById('itemQuantity').value  = data.quantity    || 1;
    const catSelect = document.getElementById('itemCategory');
    if (catSelect && data.categoryID) catSelect.value = String(data.categoryID);
    document.getElementById('sellModalTitle').textContent = 'Update listing';
    const submitBtn = document.getElementById('submitListing');
    if (submitBtn) { submitBtn.textContent = 'Update listing'; submitBtn.dataset.editProductID = editProductID; }
    document.getElementById('sellModal').classList.add('open');
  }

  // ── Close item modal ──
  document.getElementById('closeItemModal').addEventListener('click', () => {
    document.getElementById('itemModal').classList.remove('open');
  });
  document.getElementById('itemModal').addEventListener('click', e => {
    if (e.target === document.getElementById('itemModal')) document.getElementById('itemModal').classList.remove('open');
  });

  // ── Item modal heart ──
  document.getElementById('itemFavBtn').addEventListener('click', () => toggleSaveItem());

  // ── Payment modal close ──
  document.getElementById('closePaymentModal').addEventListener('click', () => {
    document.getElementById('paymentModal').classList.remove('open');
  });
  document.getElementById('paymentModal').addEventListener('click', e => {
    if (e.target === document.getElementById('paymentModal')) document.getElementById('paymentModal').classList.remove('open');
  });

  // ── Sell modal ──
  const openSell = () => { resetSellForm(); document.getElementById('sellModal').classList.add('open'); };
  document.getElementById('openSellModal').addEventListener('click',  openSell);
  document.getElementById('openSellModal2').addEventListener('click', openSell);
  document.getElementById('closeSellModal').addEventListener('click', () => {
    document.getElementById('sellModal').classList.remove('open');
    resetSellForm();
  });
  document.getElementById('sellModal').addEventListener('click', e => {
    if (e.target === document.getElementById('sellModal')) {
      document.getElementById('sellModal').classList.remove('open');
      resetSellForm();
    }
  });

  // ── Submit listing ──
  const submitBtn = document.getElementById('submitListing');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const productName      = document.getElementById('itemName').value.trim();
      const price            = document.getElementById('itemPrice').value;
      const categoryID       = document.getElementById('itemCategory').value;
      const productCondition = document.getElementById('itemCondition').value;
      const description      = document.getElementById('itemDesc').value.trim();
      const quantity         = parseInt(document.getElementById('itemQuantity')?.value) || 1;

      if (!productName)          { showDashToast('Please enter an item name', 'error'); return; }
      if (!price || price <= 0)  { showDashToast('Please enter a valid price', 'error'); return; }
      if (!categoryID)           { showDashToast('Please select a category', 'error'); return; }
      if (!productCondition)     { showDashToast('Please select the item condition', 'error'); return; }
      if (selectedFiles.length === 0) { showDashToast('Please upload at least 1 photo', 'error'); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      try {
        const editID = submitBtn.dataset.editProductID;
        const url    = editID ? `${API_BASE}/products/${editID}` : `${API_BASE}/products/add`;
        const method = editID ? 'PUT' : 'POST';

        const formData = new FormData();
        formData.append('productName',      productName);
        formData.append('price',            parseFloat(price));
        formData.append('description',      description);
        formData.append('productCondition', productCondition);
        formData.append('categoryID',       parseInt(categoryID));
        formData.append('quantity',         quantity);
        selectedFiles.forEach(f => formData.append('productImages', f));

        const response = await fetch(url, {
          method,
          headers: { 'x-auth-token': token },
          body:    formData
        });
        const data = await response.json();

        if (response.ok) {
          document.getElementById('sellModal').classList.remove('open');
          showDashToast(editID
            ? `"${productName}" updated and re-submitted for approval! ✅`
            : `"${productName}" submitted for admin approval! 🎉`);
          resetSellForm();
          loadProducts();
        } else {
          showDashToast(data.message || 'Failed to save listing.', 'error');
        }
      } catch (err) {
        showDashToast('Server is offline.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.editProductID ? 'Update listing' : 'Post listing';
      }
    });
  }

  // ── Messages modal ──
  document.getElementById('openMessagesModal').addEventListener('click', () => {
    openMessagesWithUser(null, null);
  });
  document.getElementById('closeMessagesModal').addEventListener('click', () => {
    document.getElementById('messagesModal').classList.remove('open');
    if (msgPollInterval) { clearInterval(msgPollInterval); msgPollInterval = null; }
  });
  document.getElementById('messagesModal').addEventListener('click', e => {
    if (e.target === document.getElementById('messagesModal')) {
      document.getElementById('messagesModal').classList.remove('open');
      if (msgPollInterval) { clearInterval(msgPollInterval); msgPollInterval = null; }
    }
  });

  // New Message button
  document.getElementById('msgNewChatBtn')?.addEventListener('click', () => {
    const input = document.getElementById('convSearchInput');
    if (input) { input.focus(); input.select(); }
  });

  // Conversation search input
  const convSearchInput = document.getElementById('convSearchInput');
  if (convSearchInput) {
    let searchTimer;
    convSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = convSearchInput.value.trim();
      if (!q) {
        document.getElementById('convSearchResults').classList.remove('open');
        return;
      }
      searchTimer = setTimeout(() => searchUsers(q), 300);
    });
    convSearchInput.addEventListener('blur', () => {
      setTimeout(() => document.getElementById('convSearchResults')?.classList.remove('open'), 200);
    });
  }

  wireEmojiPicker();

  // ── Sort ──
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => { activeSort = sortSelect.value || 'newest'; loadProducts(); });
  }

  // ── Search ──
  const searchInput = document.getElementById('mainSearch');
  if (searchInput) {
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { activeSearch = searchInput.value.trim(); loadProducts(); }, 400);
    });
  }

  // ── See all ──
  const seeAllLink = document.getElementById('seeAllLink');
  if (seeAllLink) {
    seeAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      activeCategory = null; activeSearch = '';
      const searchInput = document.getElementById('mainSearch');
      if (searchInput) searchInput.value = '';
      document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
      const allChip = document.querySelector('#categoryChips .chip');
      if (allChip) allChip.classList.add('active');
      loadProducts();
    });
  }
});

// ======================================================
// UTILITIES
// ======================================================
function timeAgo(date) {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showDashToast(message, type = 'success') {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast) return;
  toastMsg.textContent = message;
  const icon = toast.querySelector('svg');
  if (icon) icon.style.color = type === 'error' ? '#e0504a' : '#5ddf7a';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
