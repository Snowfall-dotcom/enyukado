// ======================================================
// ENYUKADO - dashboard-api.js
// Connects dashboard UI to the backend API
// ======================================================

// ======================================================
// AUTH GUARD — redirect to login if not logged in
// ======================================================
(function () {
  const token = localStorage.getItem('userToken');
  if (!token) {
    window.location.replace('index.html');
  }
})();

const API_BASE = 'http://localhost:5000/api';
const token    = localStorage.getItem('userToken');





let activeCategory = null;
let activeSort     = 'newest';
let activeSearch   = '';

// ===== LOAD PRODUCTS FROM API =====
async function loadProducts() {
    const grid = document.getElementById('listingsGrid');
    if (!grid) return;

    const params = {};
    if (activeSearch)  params.search = activeSearch;
    if (activeCategory) params.category = activeCategory;
    if (activeSort)    params.sort = activeSort;

    const query = new URLSearchParams(params).toString();
    const url   = `${API_BASE}/products${query ? '?' + query : ''}`;

    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#888;">Loading...</div>`;

    try {
        const response = await fetch(url);
        const products = await response.json();

        if (!products.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#888;">No listings found.</div>`;
            return;
        }

        grid.innerHTML = products.map(p => {
            const imgURL = p.ImageURL || p.imageURL;
            const condClass = p.ProductCondition === 'Poor' ? 'poor'
                            : p.ProductCondition === 'Fair' || p.ProductCondition === 'Used' ? 'fair' : '';
            return `
            <div class="listing-card" onclick="openItemFromAPI(${p.ProductID})">
                <div class="listing-img">
                    ${imgURL
                        ? `<img src="${imgURL}" alt="${p.ProductName}">`
                        : '📦'
                    }
                    <span class="listing-badge">${p.CategoryName || 'Others'}</span>
                    <button class="listing-fav" data-id="${p.ProductID}" data-name="${p.ProductName}" data-price="${p.Price}" data-condition="${p.ProductCondition}" data-img="${imgURL || ''}" onclick="event.stopPropagation(); toggleFav(this)">♡</button>
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
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#e0504a;">Failed to load listings. Is the server running?</div>`;
    }
}

// ===== OPEN ITEM MODAL FROM API =====
async function openItemFromAPI(productID) {
    try {
        const response = await fetch(`${API_BASE}/products/${productID}`);
        const p = await response.json();

        const emojiEl = document.getElementById('itemModalEmoji');
        const imgURL = p.ImageURL || p.imageURL;
        if (imgURL) {
            emojiEl.innerHTML = `<img src="${imgURL}" alt="${p.ProductName}" style="width:100%;height:220px;object-fit:cover;border-radius:12px;">`;
        } else {
            emojiEl.textContent = '📦';
        }
        // Category name — use joined CategoryName, fallback to fetching if missing
        let categoryName = p.CategoryName || 'Others';
        if (!p.CategoryName) {
            try {
                const catRes = await fetch(`${API_BASE}/categories/${p.CategoryID}`);
                if (catRes.ok) {
                    const cat = await catRes.json();
                    categoryName = cat.CategoryName;
                }
            } catch(e) {}
        }

        document.getElementById('itemModalCategory').textContent = categoryName;
        document.getElementById('itemModalTitle').textContent    = p.ProductName;
        document.getElementById('itemModalPrice').textContent    = `₱${parseFloat(p.Price).toLocaleString()}`;
        document.getElementById('itemModalDesc').textContent     = p.Description || 'No description provided.';
        document.getElementById('sellerName').textContent        = p.sellerName || 'Unknown Seller';
        document.getElementById('sellerSub').textContent        = `Condition: ${p.ProductCondition}`;

        // Update meta tags with real data
        const metaTags = document.getElementById('itemMetaTags');
        if (metaTags) {
            const postedAgo = p.DatePosted ? timeAgo(new Date(p.DatePosted)) : 'Recently';
            const conditionColor = p.ProductCondition?.toLowerCase().includes('new') ? '#2ecc71' :
                                   p.ProductCondition?.toLowerCase().includes('good') ? '#3498db' : '#e67e22';
            metaTags.innerHTML = `
                <div class="meta-tag"><span class="dot" style="background:${conditionColor}"></span> ${p.ProductCondition}</div>
                <div class="meta-tag">🏷️ ${categoryName}</div>
                <div class="meta-tag">🕐 ${postedAgo}</div>
            `;
        }

        // Store product info for buy button
        const modal = document.getElementById('itemModal');
        // Update seller rating from reviews API
        try {
            const reviewRes = await fetch(`${API_BASE}/reviews/user/${p.UserID}`);
            if (reviewRes.ok) {
                const reviewData = await reviewRes.json();
                const ratingEl = document.getElementById('sellerRating');
                if (ratingEl) ratingEl.textContent = reviewData.averageRating || 'No ratings';
            }
        } catch(e) {}

        modal.dataset.productId     = productID;
        modal.dataset.sellerName    = p.sellerName;
        modal.dataset.price         = p.Price;
        modal.dataset.messengerLink = p.MessengerLink || '';
        modal.dataset.sellerUserID  = p.UserID;

        // Hide Buy Now if logged-in user is the seller
        const buyBtn     = document.querySelector('.btn-buy');
        const contactBtn = document.querySelector('.btn-contact');
        const currentUserID = parseInt(localStorage.getItem('userID'));

        if (buyBtn) {
            if (p.UserID === currentUserID) {
                buyBtn.style.display = 'none';
            } else {
                buyBtn.style.display = '';
            }
        }

        // Replace Message Seller with Messenger link
        if (contactBtn) {
            if (p.MessengerLink) {
                contactBtn.textContent = '💬 Contact via Messenger';
                contactBtn.onclick = () => window.open(p.MessengerLink, '_blank');
            } else if (p.ContactNumber) {
                contactBtn.textContent = `📞 ${p.ContactNumber}`;
                contactBtn.onclick = null;
            } else {
                contactBtn.textContent = '💬 No contact info available';
                contactBtn.onclick = null;
            }
        }

        // Stock display
        const stockEl = document.getElementById('itemModalStock');
        if (stockEl) {
            if (p.Quantity > 1) {
                stockEl.textContent = `${p.Quantity} units available`;
                stockEl.style.color = '#5ddf7a';
            } else if (p.Quantity === 1) {
                stockEl.textContent = 'Last unit!';
                stockEl.style.color = '#f5a623';
            } else {
                stockEl.textContent = 'Out of stock';
                stockEl.style.color = '#e0504a';
            }
        }

        // Reset Add to Cart button state
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.disabled = false;
            addToCartBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart`;
            if (p.Quantity <= 0 || p.Status === 'Sold') {
                addToCartBtn.disabled = true;
                addToCartBtn.textContent = 'Out of Stock';
            }
        }

        modal.classList.add('open');
        // Reflect saved state on the heart button
        updateHeartBtn(productID);
    } catch (err) {
        console.error('Failed to load product:', err);
    }
}

// ===== SAVE / UNSAVE ITEM =====
// ===== CARD HEART: toggleFav wired to save API =====
window.toggleFav = async function(btn) {
    const id    = parseInt(btn.dataset.id);
    const token = localStorage.getItem('userToken');
    if (!token) return;

    const isLiked = btn.classList.contains('liked');
    // Optimistic UI update
    if (isLiked) {
        btn.classList.remove('liked');
        btn.textContent = '♡';
        btn.style.color = '';
    } else {
        btn.classList.add('liked');
        btn.textContent = '♥';
        btn.style.color = '#e0504a';
    }

    try {
        if (isLiked) {
            await fetch(`http://localhost:5000/api/saved/${id}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            });
        } else {
            await fetch(`http://localhost:5000/api/saved`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ productID: id })
            });
        }
    } catch(e) {
        // Revert on error
        if (isLiked) { btn.classList.add('liked'); btn.textContent = '♥'; btn.style.color = '#e0504a'; }
        else { btn.classList.remove('liked'); btn.textContent = '♡'; btn.style.color = ''; }
    }
};

// Reflect saved state on all card hearts after listings load
async function syncCardHearts() {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
        const res   = await fetch('http://localhost:5000/api/saved', { headers: { 'x-auth-token': token } });
        const saved = await res.json();
        const savedIds = new Set(saved.map(p => p.ProductID));
        document.querySelectorAll('.listing-fav[data-id]').forEach(btn => {
            const id = parseInt(btn.dataset.id);
            if (savedIds.has(id)) {
                btn.classList.add('liked');
                btn.textContent = '♥';
                btn.style.color = '#e0504a';
            } else {
                btn.classList.remove('liked');
                btn.textContent = '♡';
                btn.style.color = '';
            }
        });
    } catch(e) {}
}

// Override toggleItemFav to use save API
window.toggleItemFav = window.toggleSaveItem = async function() {
    const modal = document.getElementById('itemModal');
    const id    = parseInt(modal.dataset.productId);
    const token = localStorage.getItem('userToken');
    if (!token || !id) return;

    const heartBtn = document.getElementById('itemFavBtn');
    const isLiked  = heartBtn?.textContent === '♥';

    // Optimistic update
    if (heartBtn) {
        heartBtn.textContent = isLiked ? '♡' : '♥';
        heartBtn.style.color = isLiked ? '' : '#e0504a';
    }

    try {
        if (isLiked) {
            await fetch(`http://localhost:5000/api/saved/${id}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            });
            showDashToast('Removed from saved items.');
        } else {
            await fetch('http://localhost:5000/api/saved', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ productID: id })
            });
            showDashToast('Saved! View in your profile → Saved tab.');
        }
        syncCardHearts();
    } catch(e) {
        // Revert
        if (heartBtn) { heartBtn.textContent = isLiked ? '♥' : '♡'; heartBtn.style.color = isLiked ? '#e0504a' : ''; }
    }
};

// Update heart button to reflect saved state from API
async function updateHeartBtn(productId) {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
        const res = await fetch(`http://localhost:5000/api/saved/check/${productId}`, { headers: { 'x-auth-token': token } });
        const { saved } = await res.json();
        const heartBtn = document.getElementById('itemFavBtn');
        if (!heartBtn) return;
        heartBtn.textContent = saved ? '♥' : '♡';
        heartBtn.style.color = saved ? '#e0504a' : '';
    } catch(e) {}
}

// ===== OVERRIDE openBuyModal to work with API data =====
window.openBuyModal = function() {
    const modal = document.getElementById('itemModal');
    const name  = document.getElementById('itemModalTitle')?.textContent;
    const price = document.getElementById('itemModalPrice')?.textContent;

    document.getElementById('buyModalEmoji').textContent = '📦';
    document.getElementById('buyModalName').textContent  = name  || '';
    document.getElementById('buyModalPrice').textContent = price || '';
    document.getElementById('buyModal').classList.add('open');
};

// ===== OVERRIDE openContactModal to work with API data =====
window.openContactModal = function() {
    const modal    = document.getElementById('itemModal');
    const name     = document.getElementById('itemModalTitle')?.textContent;
    const price    = document.getElementById('itemModalPrice')?.textContent;
    const seller   = document.getElementById('sellerName')?.textContent;
    const messenger = modal?.dataset.messengerLink;

    document.getElementById('contactItemEmoji').textContent = '📦';
    document.getElementById('contactItemName').textContent  = name  || '';
    document.getElementById('contactItemPrice').textContent = price || '';
    document.getElementById('contactMsg').value    = '';
    document.getElementById('contactMeetup').value = '';

    // If seller has a messenger link, show it
    const messengerNote = document.getElementById('contactModal').querySelector('p, .messenger-note');
    if (messenger && messengerNote) {
        messengerNote.innerHTML = `Contact via <a href="${messenger}" target="_blank">${messenger}</a>`;
    }

    document.getElementById('contactModal').classList.add('open');
};

// ===== VIEW SELLER PROFILE =====
window.viewSellerProfile = function() {
    const modal    = document.getElementById('itemModal');
    const sellerID = modal?.dataset.sellerUserID;
    if (!sellerID) return;
    const currentUserID = localStorage.getItem('userID');
    if (String(sellerID) === String(currentUserID)) {
        window.location.href = 'profile.html';
    } else {
        window.location.href = `profile.html?id=${sellerID}`;
    }
};
window.addToCart = async function() {
    const modal     = document.getElementById('itemModal');
    const productID = modal?.dataset.productId;
    if (!productID) return;

    const btn = document.getElementById('addToCartBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ productID: parseInt(productID) })
        });
        const data = await response.json();

        if (response.ok) {
            showDashToast('Added to cart! View it in your profile → Cart tab. 🛒');
            if (btn) { btn.textContent = '✓ In Cart'; }
        } else {
            showDashToast(data.message || 'Could not add to cart.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Add to Cart`; }
        }
    } catch (err) {
        showDashToast('Server is offline.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Add to Cart'; }
    }
};

// ===== LOAD CATEGORIES INTO SELL FORM DROPDOWN + CHIPS =====
async function loadCategories() {
    try {
        const response   = await fetch(`${API_BASE}/categories`);
        const categories = await response.json();

        // Sort so "Others" is always last
        const sorted = [
            ...categories.filter(c => c.CategoryName !== 'Others'),
            ...categories.filter(c => c.CategoryName === 'Others')
        ];

        // ── Sell form dropdown ──
        const select = document.getElementById('itemCategory');
        if (select) {
            select.innerHTML = `<option value="">Select category</option>` +
                sorted.map(c => `<option value="${c.CategoryID}">${c.CategoryName}</option>`).join('');
        }

        // ── Category chips ──
        const chipsContainer = document.getElementById('categoryChips');
        if (chipsContainer) {
            // Emoji map — falls back to 🏷️ for anything not listed
            const EMOJI = {
                'Books':           '📚',
                'Electronics':     '💻',
                'Clothing':        '👕',
                'Uniforms':        '👔',
                'Gadgets':         '🎮',
                'School Supplies': '🎒',
                'Food & Drinks':   '🍱',
                'Food':            '🍱',
                'Sports & Recreation': '⚽',
                'Services':        '🛠️',
                'Others':          '📦'
            };

            // Keep the "All" chip, append the rest
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

            // Wire all chips (including the All chip)
            wireChips();
        }
    } catch (err) {
        console.error('Failed to load categories:', err);
    }
}

// ===== WIRE EVERYTHING ON DOM READY =====
document.addEventListener('DOMContentLoaded', async () => {

    loadProducts();
    loadActivity();

    // Wait for categories to load before attempting any pre-fill
    await loadCategories();

    // Handle redirect from profile page — open product modal or edit form
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

        // Pre-fill the sell form — categories are already loaded so dropdown has options
        const sellModal = document.getElementById('sellModal');
        const titleEl   = sellModal?.querySelector('h3');
        const submitBtn = document.getElementById('submitListing');

        document.getElementById('itemName').value      = data.name        || '';
        document.getElementById('itemPrice').value     = data.price       || '';
        document.getElementById('itemCondition').value = data.condition   || '';
        document.getElementById('itemDesc').value      = data.description || '';
        if (document.getElementById('itemQuantity'))
            document.getElementById('itemQuantity').value = data.quantity || 1;
        // Note: existing image shown in preview only — user can upload a new file to replace it

        // Set category dropdown — options exist now
        const catSelect = document.getElementById('itemCategory');
        if (catSelect && data.categoryID) catSelect.value = String(data.categoryID);

        // Show image preview if URL exists
        if (data.imageURL) {
            const preview    = document.getElementById('imagePreview');
            const previewImg = document.getElementById('previewImg');
            if (preview && previewImg) {
                previewImg.src        = data.imageURL;
                preview.style.display = 'block';
            }
        }

        // Change title and button to "Update"
        if (titleEl)   titleEl.textContent          = 'Update listing';
        if (submitBtn) {
            submitBtn.textContent               = 'Update listing →';
            submitBtn.dataset.editProductID     = editProductID;
        }

        if (sellModal) sellModal.classList.add('open');
    }

    // Update greeting and avatar with real user name
    const firstName = localStorage.getItem('userName') || '';
    const lastName  = localStorage.getItem('userLastName') || '';
    const greeting  = document.getElementById('heroGreeting');
    if (greeting && firstName) greeting.textContent = `Welcome back, ${firstName}! 👋`;

    // File input — show preview when a file is selected
    const imageFileInput = document.getElementById('itemImageFile');
    if (imageFileInput) {
        imageFileInput.addEventListener('change', () => {
            const file       = imageFileInput.files[0];
            const preview    = document.getElementById('imagePreview');
            const previewImg = document.getElementById('previewImg');
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    previewImg.src        = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
            }
        });
    }

    // Avatar → Profile page
    const avatarBtn = document.querySelector(".avatar-btn");
    if (avatarBtn) {
        const first = localStorage.getItem("userName") || "";
        const last  = localStorage.getItem("userLastName") || "";
        if (first && last) avatarBtn.textContent = (first[0] + last[0]).toUpperCase();
        avatarBtn.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }

    // ── "See all" resets filter to All and scrolls to grid ──
    const seeAllLink = document.getElementById('seeAllLink');
    if (seeAllLink) {
        seeAllLink.addEventListener('click', () => {
            activeCategory = null;
            activeSearch   = '';
            const searchInput = document.getElementById('mainSearch');
            if (searchInput) searchInput.value = '';
            document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
            const allChip = document.querySelector('#categoryChips .chip');
            if (allChip) allChip.classList.add('active');
            loadProducts();
        });
    }

    // ── Category chips — wired after loadCategories() builds them ──
    // wireChips() is called inside loadCategories() once chips are in the DOM

    // ── Sort dropdown ──
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            activeSort = sortSelect.value || 'newest';
            loadProducts();
        });
    }

    // ── Search ──
    const searchInput = document.getElementById('mainSearch');
    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                activeSearch = searchInput.value.trim();
                loadProducts();
            }, 400);
        });
    }

    // ── Submit listing ──
    // Override dashboard.html's inline submit to also call API
    const submitBtn = document.getElementById('submitListing');
    if (submitBtn) {
        // Clone to remove the inline listener from dashboard.html
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);

        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const productName      = document.getElementById('itemName').value.trim();
            const price            = document.getElementById('itemPrice').value;
            const categoryID       = document.getElementById('itemCategory').value;
            const productCondition = document.getElementById('itemCondition').value;
            const description      = document.getElementById('itemDesc').value.trim();
            const imageURL         = document.getElementById('itemImageURL')?.value.trim() || null;
            const quantity         = parseInt(document.getElementById('itemQuantity')?.value) || 1;

            if (!productName)      { showDashToast('Please enter an item name', 'error'); return; }
            if (!price || price <= 0) { showDashToast('Please enter a valid price', 'error'); return; }
            if (!categoryID)       { showDashToast('Please select a category', 'error'); return; }
            if (!productCondition) { showDashToast('Please select the item condition', 'error'); return; }

            try {
                const editID = newBtn.dataset.editProductID;
                const url    = editID ? `${API_BASE}/products/${editID}` : `${API_BASE}/products/add`;
                const method = editID ? 'PUT' : 'POST';

                // Build FormData so we can include a file upload
                const formData = new FormData();
                formData.append('productName',      productName);
                formData.append('price',            parseFloat(price));
                formData.append('description',      description);
                formData.append('productCondition', productCondition);
                formData.append('categoryID',       parseInt(categoryID));
                formData.append('quantity',         quantity);

                // Attach image file if one was selected
                const imgFile = document.getElementById('itemImageFile')?.files[0];
                if (imgFile) formData.append('productImage', imgFile);

                const response = await fetch(url, {
                    method,
                    headers: { 'x-auth-token': token },
                    // No Content-Type header — browser sets it with the boundary for multipart
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    document.getElementById('sellModal').classList.remove('open');
                    const isEdit = !!newBtn.dataset.editProductID;
                    showDashToast(isEdit ? `"${productName}" updated successfully! ✅` : `"${productName}" listed successfully! 🎉`);
                    // Reset form
                    document.getElementById('itemName').value      = '';
                    document.getElementById('itemPrice').value     = '';
                    document.getElementById('itemCategory').value  = '';
                    document.getElementById('itemCondition').value = '';
                    document.getElementById('itemDesc').value      = '';
                    if (document.getElementById('itemQuantity'))   document.getElementById('itemQuantity').value = '1';
                    const fi = document.getElementById('itemImageFile');
                    const fl = document.getElementById('itemImageFileLabel');
                    const pv = document.getElementById('imagePreview');
                    if (fi) fi.value = '';
                    if (fl) fl.textContent = 'Click to upload an image';
                    if (pv) pv.style.display = 'none';
                    const titleEl = document.getElementById('sellModal')?.querySelector('h3');
                    const submitBtn = document.getElementById('submitListing');
                    if (titleEl)   titleEl.textContent  = 'Post a listing';
                    if (submitBtn) { submitBtn.textContent = 'Post listing →'; delete submitBtn.dataset.editProductID; }
                    loadProducts();
                } else {
                    showDashToast(data.message || 'Failed to save listing.', 'error');
                }
            } catch (err) {
                showDashToast('Server is offline.', 'error');
            }
        });
    }
});

// ===== WIRE CHIP CLICK EVENTS =====
function wireChips() {
    document.querySelectorAll('#categoryChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#categoryChips .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            // data-category-id is "" for All, or the numeric ID for a real category
            activeCategory = chip.dataset.categoryId || null;
            loadProducts();
        });
    });
}

// ===== LOAD REAL ACTIVITY =====
async function loadActivity() {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;

    try {
        // Fetch purchases and my listings in parallel
        const [purchasesRes, listingsRes] = await Promise.all([
            fetch(`${API_BASE}/transactions/my/purchases`, { headers: { 'x-auth-token': token } }),
            fetch(`${API_BASE}/products/my/listings`,      { headers: { 'x-auth-token': token } })
        ]);

        const purchases = await purchasesRes.json();
        const listings  = await listingsRes.json();

        // Build activity items
        const activities = [];

        // Add purchases
        purchases.forEach(t => {
            activities.push({
                type: 'buy',
                icon: '✅',
                title: `You bought "${t.ProductName}"`,
                sub: `₱${parseFloat(t.Price).toLocaleString()} from ${t.SellerFirstName} ${t.SellerLastName}`,
                date: new Date(t.TransactionDate)
            });
        });

        // Add listings
        listings.forEach(p => {
            activities.push({
                type: 'sell',
                icon: '📦',
                title: `You listed "${p.ProductName}"`,
                sub: `Listed for ₱${parseFloat(p.Price).toLocaleString()}`,
                date: new Date(p.DatePosted)
            });
        });

        // Sort by date newest first
        activities.sort((a, b) => b.date - a.date);

        if (!activities.length) {
            activityList.innerHTML = `<div style="text-align:center;padding:24px;color:#888;font-size:0.88rem;">No activity yet.</div>`;
            return;
        }

        activityList.innerHTML = activities.slice(0, 5).map(a => `
            <div class="activity-item">
                <div class="activity-icon ${a.type}">${a.icon}</div>
                <div class="activity-text">
                    <h5>${a.title}</h5>
                    <p>${a.sub}</p>
                </div>
                <span class="activity-time">${timeAgo(a.date)}</span>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load activity:', err);
    }
}

function timeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ===== UTILITIES =====
function showDashToast(message, type = 'success') {
    const toast    = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast) return;
    toastMsg.textContent = message;
    const icon = toast.querySelector('svg');
    if (icon) icon.style.color = type === 'error' ? '#e0504a' : '#5ddf7a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
