// ======================================================
// ENYUKADO - profile-api.js
// Wires profile page to backend API
// ======================================================

const API_BASE = 'http://localhost:5000/api';
const token    = localStorage.getItem('userToken');
const userID   = localStorage.getItem('userID');

// Detect if viewing someone else's profile via ?id=
const urlParams     = new URLSearchParams(window.location.search);
const viewingUserID = urlParams.get('id');
const isOwnProfile  = !viewingUserID || viewingUserID === String(userID);

// Auth guard
if (!token) {
    window.location.href = 'index.html';
}

// ===== LOAD PROFILE =====
async function loadProfile() {
    try {
        let user;
        if (isOwnProfile) {
            const response = await fetch(`${API_BASE}/users/profile`, {
                headers: { 'x-auth-token': token }
            });
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'index.html';
                return;
            }
            user = await response.json();
        } else {
            const response = await fetch(`${API_BASE}/users/${viewingUserID}`);
            if (!response.ok) { window.location.href = 'dashboard.html'; return; }
            user = await response.json();
        }

        // Update profile name and handle
        const nameEl   = document.querySelector('.profile-name');
        const handleEl = document.querySelector('.profile-handle');
        if (nameEl) nameEl.textContent = `${user.FirstName} ${user.LastName}`;
        if (handleEl) {
            const joined = user.DateCreated
                ? new Date(user.DateCreated).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : 'Unknown';
            handleEl.textContent = `@${user.FirstName.toLowerCase()}${user.LastName.toLowerCase()} · Member since ${joined}`;
        }

        // Update avatar
        const avatar = document.querySelector('.profile-avatar');
        if (avatar) {
            avatar.textContent = `${user.FirstName[0]}${user.LastName[0]}`.toUpperCase();
        }

        // Share button
        const shareBtn = document.getElementById('shareProfileBtn');
        if (shareBtn) {
            shareBtn.onclick = () => window.open(user.MessengerLink || '#', '_blank');
        }

        // Hide edit controls when viewing someone else
        if (!isOwnProfile) {
            const editBtn = document.querySelector('.btn-edit-profile');
            if (editBtn) editBtn.style.display = 'none';
            document.querySelectorAll('.tab').forEach(tab => {
                const txt = tab.textContent;
                if (txt.includes('Cart') || txt.includes('Purchases') ||
                    txt.includes('Saved') || txt.includes('Settings')) {
                    tab.style.display = 'none';
                }
            });
            return;
        }

        // Own profile only below
        document.querySelectorAll('.settings-row').forEach(row => {
            const title = row.querySelector('.settings-row-title')?.textContent.trim();
            const sub   = row.querySelector('.settings-row-sub');
            if (title === 'Change Password' && sub) {
                sub.textContent = user.PasswordChangedAt
                    ? 'Last changed ' + new Date(user.PasswordChangedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'You have not changed your password yet';
            }
        });

        document.querySelectorAll('#editModal .modal-field').forEach(field => {
            const label = field.querySelector('label')?.textContent.trim();
            const input = field.querySelector('input');
            if (!input) return;
            if (label === 'First Name')      input.value = user.FirstName      || '';
            if (label === 'Last Name')       input.value = user.LastName       || '';
            if (label === 'Contact Number')  input.value = user.ContactNumber  || '';
            if (label === 'Messenger Link')  input.value = user.MessengerLink  || '';
        });

    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

// ===== LOAD SAVED ITEMS (from localStorage) =====
async function loadSavedItems() {
    const savedTab = document.getElementById('tab-saved');
    if (!savedTab) return;

    try {
        const res   = await fetch(`${API_BASE}/saved`, { headers: { 'x-auth-token': token } });
        const saved = await res.json();

        const savedCountEl = document.getElementById('savedTabCount');
        if (savedCountEl) savedCountEl.textContent = saved.length || 0;

        if (!saved.length) {
            savedTab.innerHTML = `<div class="empty-state"><div class="empty-icon">❤️</div><div class="empty-title">No saved items</div><div class="empty-sub">Heart items on the marketplace to save them here.</div></div>`;
            return;
        }

        savedTab.innerHTML = `<div class="listings-grid">` + saved.map(p => `
            <div class="listing-card" onclick="viewOnMarketplace(${p.ProductID})" style="cursor:pointer;">
                <div class="listing-img">
                    ${p.ImageURL ? `<img src="${p.ImageURL.startsWith('http') ? p.ImageURL : 'http://localhost:5000' + p.ImageURL}" alt="${p.ProductName}" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
                </div>
                <div class="listing-info">
                    <h4>${p.ProductName}</h4>
                    <div class="price">₱${parseFloat(p.Price).toLocaleString()}</div>
                    <div class="meta">${p.ProductCondition}</div>
                    <div style="margin-top:8px;display:flex;gap:8px;">
                        <button onclick="event.stopPropagation(); viewOnMarketplace(${p.ProductID})" style="flex:1;padding:6px 8px;border:none;background:var(--blue);color:white;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">👁 View</button>
                        <button onclick="event.stopPropagation(); unsaveItem(${p.ProductID})" style="flex:1;padding:6px 8px;border:1.5px solid rgba(224,80,74,0.3);background:rgba(224,80,74,0.05);color:#c0392b;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">🗑 Remove</button>
                    </div>
                </div>
            </div>
        `).join('') + `</div>`;
    } catch(err) {
        console.error('Load saved items error:', err);
    }
}

// Open item modal from profile listing
window.openListingModal = function(productID) {
    openEditListingModal(productID);
};

// Edit listing — opens inline edit modal on profile page
window.editMyListing = function(productID, name, price, categoryID, condition, description, imageURL, quantity) {
    window.openEditListingModal(productID, { name, price, categoryID, condition, description, imageURL, quantity });
};

window.openEditListingModal = async function(productID, data) {
    // Load categories into the edit modal dropdown first
    const select = document.getElementById('editListingCategory');
    if (select && select.options.length <= 1) {
        try {
            const res  = await fetch(`${API_BASE}/categories`);
            const cats = await res.json();
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value       = c.CategoryID;
                opt.textContent = c.CategoryName;
                select.appendChild(opt);
            });
        } catch(e) {}
    }

    // If data not passed, fetch from API
    if (!data) {
        try {
            const res = await fetch(`${API_BASE}/products/${productID}`);
            const p   = await res.json();
            data = {
                name:        p.ProductName,
                price:       p.Price,
                categoryID:  p.CategoryID,
                condition:   p.ProductCondition,
                description: p.Description || '',
                imageURL:    p.ImageURL    || '',
                quantity:    p.Quantity
            };
        } catch(e) { return; }
    }

    // Fill form
    document.getElementById('editListingID').value          = productID;
    document.getElementById('editListingName').value        = data.name        || '';
    document.getElementById('editListingPrice').value       = data.price       || '';
    document.getElementById('editListingQuantity').value    = data.quantity    || 1;
    document.getElementById('editListingCondition').value   = data.condition   || '';
    document.getElementById('editListingDesc').value        = data.description || '';
    if (select) select.value = String(data.categoryID || '');

    // Show existing image preview
    const preview    = document.getElementById('editListingImgPreview');
    const previewImg = document.getElementById('editListingPreviewImg');
    if (data.imageURL && previewImg && preview) {
        previewImg.src        = data.imageURL.startsWith('http') ? data.imageURL : `http://localhost:5000${data.imageURL}`;
        preview.style.display = 'block';
    } else if (preview) {
        preview.style.display = 'none';
    }

    const m = document.getElementById('editListingModal');
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

window.closeEditListingModal = function() {
    const m = document.getElementById('editListingModal');
    m.style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('editListingImgFile').value = '';
    document.getElementById('editListingImgLabel').textContent = 'Click to upload image';
    document.getElementById('editListingImgPreview').style.display = 'none';
};

window.submitEditListing = async function() {
    const productID       = document.getElementById('editListingID').value;
    const productName     = document.getElementById('editListingName').value.trim();
    const price           = document.getElementById('editListingPrice').value;
    const categoryID      = document.getElementById('editListingCategory').value;
    const productCondition = document.getElementById('editListingCondition').value;
    const description     = document.getElementById('editListingDesc').value.trim();
    const quantity        = document.getElementById('editListingQuantity').value;
    const imgFile         = document.getElementById('editListingImgFile').files[0];

    if (!productName) { showProfileToast('Item name is required.', 'error'); return; }
    if (!price || price <= 0) { showProfileToast('Enter a valid price.', 'error'); return; }
    if (!categoryID)  { showProfileToast('Select a category.', 'error'); return; }
    if (!productCondition) { showProfileToast('Select a condition.', 'error'); return; }

    const formData = new FormData();
    formData.append('productName',      productName);
    formData.append('price',            parseFloat(price));
    formData.append('categoryID',       parseInt(categoryID));
    formData.append('productCondition', productCondition);
    formData.append('description',      description);
    formData.append('quantity',         parseInt(quantity) || 1);
    if (imgFile) formData.append('productImage', imgFile);

    try {
        const res  = await fetch(`${API_BASE}/products/${productID}`, {
            method:  'PUT',
            headers: { 'x-auth-token': token },
            body:    formData
        });
        const data = await res.json();
        if (res.ok) {
            closeEditListingModal();
            showProfileToast(`"${productName}" updated! ✅`);
            loadMyListings();
        } else {
            showProfileToast(data.message || 'Update failed.', 'error');
        }
    } catch(e) {
        showProfileToast('Server is offline.', 'error');
    }
};

// Open saved item modal inline on profile page
window.viewOnMarketplace = async function(productID) {
    const modal = document.getElementById('savedItemModal');
    if (!modal) return;

    // Show modal immediately with loading state
    document.getElementById('savedItemTitle').textContent = 'Loading...';
    document.getElementById('savedItemPrice').textContent = '';
    document.getElementById('savedItemDesc').textContent = '';
    document.getElementById('savedItemEmoji').innerHTML = '⏳';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch(`${API_BASE}/products/${productID}`);
        const p   = await res.json();

        // Image
        const emojiEl = document.getElementById('savedItemEmoji');
        if (p.ImageURL) {
            const imgSrc = p.ImageURL.startsWith('http') ? p.ImageURL : `http://localhost:5000${p.ImageURL}`;
            emojiEl.innerHTML = `<img src="${imgSrc}" alt="${p.ProductName}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;">`;
        } else {
            emojiEl.textContent = '📦';
        }

        // Category
        let categoryName = p.CategoryName || 'Others';
        if (!p.CategoryName && p.CategoryID) {
            try {
                const catRes = await fetch(`${API_BASE}/categories/${p.CategoryID}`);
                if (catRes.ok) { const cat = await catRes.json(); categoryName = cat.CategoryName; }
            } catch(e) {}
        }
        document.getElementById('savedItemCategory').textContent = categoryName;
        document.getElementById('savedItemTitle').textContent    = p.ProductName;
        document.getElementById('savedItemPrice').textContent    = `₱${parseFloat(p.Price).toLocaleString()}`;
        document.getElementById('savedItemDesc').textContent     = p.Description || 'No description provided.';

        // Stock
        const stockEl = document.getElementById('savedItemStock');
        if (p.Quantity > 1)       { stockEl.textContent = `${p.Quantity} units available`; stockEl.style.color = '#5ddf7a'; }
        else if (p.Quantity === 1) { stockEl.textContent = 'Last unit!'; stockEl.style.color = '#f5a623'; }
        else                      { stockEl.textContent = 'Out of stock'; stockEl.style.color = '#e0504a'; }

        // Tags
        const condClass = p.ProductCondition === 'Like new' || p.ProductCondition === 'Good' ? '' : p.ProductCondition === 'Fair' ? 'fair' : 'poor';
        document.getElementById('savedItemTags').innerHTML = `
            <div class="meta-tag"><span class="dot ${condClass}"></span> ${p.ProductCondition}</div>
            <div class="meta-tag">🏷️ ${categoryName}</div>
        `;

        // Seller
        const initials = p.sellerName ? p.sellerName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '??';
        document.getElementById('savedItemSellerAvatar').textContent = initials;
        document.getElementById('savedItemSellerName').textContent   = p.sellerName || 'Unknown Seller';
        document.getElementById('savedItemSellerSub').textContent    = `Condition: ${p.ProductCondition}`;

        // Seller rating
        try {
            const revRes  = await fetch(`${API_BASE}/reviews/user/${p.UserID}`);
            const revData = await revRes.json();
            document.getElementById('savedItemRating').textContent = revData.averageRating
                ? `⭐ ${revData.averageRating}`
                : '⭐ No ratings';
        } catch(e) { document.getElementById('savedItemRating').textContent = '⭐ No ratings'; }

        // Add to Cart button
        const addCartBtn = document.getElementById('savedItemAddCartBtn');
        const myID = parseInt(localStorage.getItem('userID'));
        if (p.UserID === myID) {
            // Own listing — hide action buttons
            addCartBtn.style.display = 'none';
            document.getElementById('savedItemContactBtn').style.display = 'none';
        } else if (p.Quantity <= 0 || p.Status === 'Sold') {
            addCartBtn.disabled = true;
            addCartBtn.textContent = 'Out of Stock';
            addCartBtn.style.opacity = '0.5';
        } else {
            addCartBtn.style.display = '';
            addCartBtn.disabled = false;
            addCartBtn.textContent = '🛒 Add to Cart';
            addCartBtn.style.opacity = '1';
            addCartBtn.onclick = async () => {
                addCartBtn.disabled = true;
                addCartBtn.textContent = 'Adding…';
                try {
                    const r = await fetch(`${API_BASE}/cart`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                        body: JSON.stringify({ productID })
                    });
                    const d = await r.json();
                    if (r.ok) {
                        closeSavedItemModal();
                        showProfileToast('Added to cart! ✅');
                        loadMyCart();
                    } else {
                        showProfileToast(d.message || 'Could not add to cart.', 'error');
                        addCartBtn.disabled = false;
                        addCartBtn.textContent = '🛒 Add to Cart';
                    }
                } catch(e) {
                    showProfileToast('Server is offline.', 'error');
                    addCartBtn.disabled = false;
                    addCartBtn.textContent = '🛒 Add to Cart';
                }
            };
        }

        // Contact button
        const contactBtn = document.getElementById('savedItemContactBtn');
        if (p.MessengerLink) {
            contactBtn.style.display = '';
            contactBtn.onclick = () => window.open(p.MessengerLink, '_blank');
        } else {
            contactBtn.textContent = '💬 No contact info available';
            contactBtn.disabled = true;
            contactBtn.style.opacity = '0.5';
        }

        // Heart button — reflect saved state from API
        const favBtn = document.getElementById('savedItemFavBtn');
        try {
            const checkRes = await fetch(`${API_BASE}/saved/check/${productID}`, { headers: { 'x-auth-token': token } });
            const { saved: isSaved } = await checkRes.json();
            favBtn.textContent = isSaved ? '♥' : '♡';
            favBtn.style.color = isSaved ? '#e0504a' : '';
        } catch(e) { favBtn.textContent = '♡'; }
        favBtn.dataset.id    = productID;
        favBtn.dataset.name  = p.ProductName;
        favBtn.dataset.price = p.Price;
        favBtn.dataset.condition = p.ProductCondition;
        favBtn.dataset.img   = p.ImageURL || '';

    } catch(e) {
        document.getElementById('savedItemTitle').textContent = 'Failed to load item.';
    }
};

window.closeSavedItemModal = function() {
    const modal = document.getElementById('savedItemModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
};

window.toggleSavedItemFav = async function() {
    const btn  = document.getElementById('savedItemFavBtn');
    const id   = parseInt(btn.dataset.id);
    const name = btn.dataset.name;
    const price = btn.dataset.price;
    const condition = btn.dataset.condition;
    const imageURL  = btn.dataset.img;

    try {
        const checkRes = await fetch(`${API_BASE}/saved/check/${id}`, { headers: { 'x-auth-token': token } });
        const { saved: isSaved } = await checkRes.json();
        if (isSaved) {
            await fetch(`${API_BASE}/saved/${id}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
            btn.textContent = '♡'; btn.style.color = '';
            showProfileToast('Removed from saved items.');
        } else {
            await fetch(`${API_BASE}/saved`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ productID: id })
            });
            btn.textContent = '♥'; btn.style.color = '#e0504a';
            showProfileToast('Saved!');
        }
        loadSavedItems();
    } catch(e) {
        showProfileToast('Server is offline.', 'error');
    }
};

window.unsaveItem = async function(productID) {
    try {
        await fetch(`${API_BASE}/saved/${productID}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token }
        });
        loadSavedItems();
    } catch(e) {
        showProfileToast('Server is offline.', 'error');
    }
};

// ===== LOAD MY LISTINGS =====
async function loadMyListings() {
    try {
        // For own profile use my/listings; for others filter by UserID from public products endpoint
        let listings;
        if (isOwnProfile) {
            const response = await fetch(`${API_BASE}/products/my/listings`, { headers: { 'x-auth-token': token } });
            listings = await response.json();
        } else {
            const response = await fetch(`${API_BASE}/products?sort=newest`);
            const all = await response.json();
            listings = all.filter(p => String(p.UserID) === String(viewingUserID));
        }
        const products = listings;

        const listingsTab = document.getElementById('tab-listings');
        if (!listingsTab) return;

        const available = isOwnProfile ? products.filter(p => p.Status === 'Available') : products;
        const sold      = isOwnProfile ? products.filter(p => p.Status === 'Sold') : [];

        // Update tab counts reliably by text content
        const listingsTabBtn = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.includes('Listings'));
        const soldTabBtn     = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.includes('Sold'));
        if (listingsTabBtn) listingsTabBtn.querySelector('.tab-count').textContent = available.length;
        if (soldTabBtn)     soldTabBtn.querySelector('.tab-count').textContent     = sold.length;

        // Update stats
        const statListings = document.getElementById('statListings');
        const statSold     = document.getElementById('statSold');
        if (statListings) statListings.textContent = available.length;
        if (statSold)     statSold.textContent     = sold.length;

        // Render available listings
        if (!available.length) {
            listingsTab.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No active listings</div><div class="empty-sub">Post something to get started!</div></div>`;
        } else {
            listingsTab.innerHTML = `<div class="listings-grid">` + available.map(p => `
                <div class="listing-card">
                    <div class="listing-img" onclick="openListingModal(${p.ProductID})" style="cursor:pointer;">
                        ${p.ImageURL
                            ? `<img src="${p.ImageURL}" alt="${p.ProductName}" style="width:100%;height:100%;object-fit:cover;">`
                            : '📦'
                        }
                        <span class="listing-status active">Active</span>
                    </div>
                    <div class="listing-info">
                        <h4>${p.ProductName}</h4>
                        <div class="price">₱${parseFloat(p.Price).toLocaleString()}</div>
                        <div class="meta">
                            <span class="condition-dot"></span>
                            ${p.ProductCondition}
                        </div>
                        <div style="font-size:0.75rem;color:${p.Quantity <= 1 ? '#f5a623' : 'var(--charcoal-3)'};margin-top:4px;">
                            ${p.Quantity} unit${p.Quantity !== 1 ? 's' : ''} left
                        </div>
                        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                            <button onclick="editMyListing(${p.ProductID}, '${p.ProductName.replace(/'/g, "\\'")}', ${p.Price}, ${p.CategoryID}, '${p.ProductCondition}', '${(p.Description||'').replace(/'/g, "\\'")}', '${p.ImageURL||''}', ${p.Quantity})" style="flex:1;padding:6px 8px;border:1.5px solid rgba(50,111,202,0.3);background:rgba(50,111,202,0.05);color:var(--blue);border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">✏️ Edit</button>
                            <button onclick="markAsSold(${p.ProductID})" style="flex:1;padding:6px 8px;border:1.5px solid rgba(93,223,122,0.3);background:rgba(93,223,122,0.05);color:#2d9e50;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">✅ Sold</button>
                            <button onclick="deleteMyListing(${p.ProductID})" style="width:100%;padding:6px 8px;border:1.5px solid rgba(224,80,74,0.3);background:rgba(224,80,74,0.05);color:#c0392b;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">🗑 Remove</button>
                        </div>
                    </div>
                </div>
            `).join('') + `</div>`;
        }

        // Render sold tab — now shows transactions, not just products
        loadMySales();


    } catch (err) {
        console.error('Failed to load listings:', err);
    }
}

// ===== LOAD MY REVIEWS =====
async function loadMyReviews() {
    if (!userID) return;

    try {
        const targetID = isOwnProfile ? userID : viewingUserID;
        const response = await fetch(`${API_BASE}/reviews/user/${targetID}`);
        const data = await response.json();

        const reviewsTab = document.getElementById('tab-reviews');
        if (!reviewsTab) return;

        // Update reviews tab count
        const reviewsTabBtn = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.includes('Reviews'));
        if (reviewsTabBtn) reviewsTabBtn.querySelector('.tab-count').textContent = data.totalReviews;

        // Update rating stat card
        const ratingNum   = document.querySelector('.rating-big-num');
        const ratingCount = document.querySelector('.rating-count');
        const statRating  = document.getElementById('statRating');
        if (ratingNum)   ratingNum.textContent   = data.averageRating || '0.0';
        if (ratingCount) ratingCount.textContent = `${data.totalReviews} review${data.totalReviews !== 1 ? 's' : ''}`;
        if (statRating)  statRating.textContent  = data.averageRating ? `${data.averageRating}⭐` : '—';

        // Update star display
        const starsEl = document.querySelector('.rating-stars');
        if (starsEl && data.averageRating) {
            const avg     = parseFloat(data.averageRating);
            const full    = Math.round(avg);
            starsEl.textContent = '★'.repeat(full) + '☆'.repeat(5 - full);
        } else if (starsEl) {
            starsEl.textContent = '☆☆☆☆☆';
        }

        // Calculate and render rating bars from real data
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        if (data.reviews) data.reviews.forEach(r => { if (counts[r.Rating] !== undefined) counts[r.Rating]++; });
        const maxCount = Math.max(...Object.values(counts), 1);
        const barsEl = document.querySelector('.rating-bars');
        if (barsEl) {
            barsEl.innerHTML = [5, 4, 3, 2, 1].map(star => `
                <div class="rating-bar-row">
                    <span>${star}</span>
                    <div class="rating-bar-bg">
                        <div class="rating-bar-fill" style="width:${Math.round((counts[star] / maxCount) * 100)}%"></div>
                    </div>
                    <span>${counts[star]}</span>
                </div>
            `).join('');
        }

        if (!data.totalReviews) {
            reviewsTab.innerHTML = `<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-title">No reviews yet</div><div class="empty-sub">Complete a transaction to receive reviews.</div></div>`;
            return;
        }

        reviewsTab.innerHTML = data.reviews.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-avatar">${r.ReviewerFirstName[0]}${r.ReviewerLastName[0]}</div>
                    <div>
                        <div class="review-name">${r.ReviewerFirstName} ${r.ReviewerLastName}</div>
                        <div class="review-stars">${'★'.repeat(r.Rating)}${'☆'.repeat(5 - r.Rating)}</div>
                    </div>
                    <div class="review-date">${new Date(r.DateCreated).toLocaleDateString()}</div>
                </div>
                <div class="review-text">${r.Comment || ''}</div>
                <div class="review-product">re: ${r.ProductName}</div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

// ===== SAVE PROFILE (Edit Modal) =====
window.saveProfile = async function() {
    // Save profile fields only (photo is saved immediately on selection)
    let firstName = "", lastName = "", contactNumber = "", messengerLink = "";
    document.querySelectorAll("#editModal .modal-field").forEach(field => {
        const label = field.querySelector("label")?.textContent.trim();
        const input = field.querySelector("input");
        if (!input) return;
        if (label === "First Name")     firstName     = input.value.trim();
        if (label === "Last Name")      lastName      = input.value.trim();
        if (label === "Contact Number") contactNumber = input.value.trim();
        if (label === "Messenger Link") messengerLink = input.value.trim();
    });

    if (!firstName || !lastName) {
        showProfileToast("First and last name are required.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ firstName, lastName, contactNumber, messengerLink })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userName',     firstName);
            localStorage.setItem('userLastName', lastName);
            document.getElementById('editModal').classList.remove('open');
            showProfileToast('Profile updated successfully! ✅');
            loadProfile();
        } else {
            showProfileToast(data.message || 'Update failed.', 'error');
        }
    } catch (err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// ===== LOGOUT =====
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// ===== CART ITEM MODAL =====
window.openCartItemModal = async function(productID) {
    try {
        const response = await fetch(`${API_BASE}/products/${productID}`);
        const p = await response.json();

        const modal = document.getElementById('cartItemModal');

        // Image
        const imgEl = document.getElementById('cartModalImg');
        if (p.ImageURL) {
            imgEl.innerHTML = `<img src="${p.ImageURL}" alt="${p.ProductName}" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;">`;
        } else {
            imgEl.textContent = '📦';
        }

        // Category
        let categoryName = p.CategoryName || 'Others';
        if (!p.CategoryName && p.CategoryID) {
            try {
                const catRes = await fetch(`${API_BASE}/categories/${p.CategoryID}`);
                if (catRes.ok) { const cat = await catRes.json(); categoryName = cat.CategoryName; }
            } catch(e) {}
        }
        document.getElementById('cartModalCategory').textContent = categoryName;
        document.getElementById('cartModalTitle').textContent    = p.ProductName;
        document.getElementById('cartModalPrice').textContent    = `₱${parseFloat(p.Price).toLocaleString()}`;
        document.getElementById('cartModalDesc').textContent     = p.Description || 'No description provided.';

        // Stock
        const stockEl = document.getElementById('cartModalStock');
        if (p.Quantity > 1)      { stockEl.textContent = `${p.Quantity} units available`; stockEl.style.color = '#5ddf7a'; }
        else if (p.Quantity === 1) { stockEl.textContent = 'Last unit!'; stockEl.style.color = '#f5a623'; }
        else                     { stockEl.textContent = 'Out of stock'; stockEl.style.color = '#e0504a'; }

        // Tags
        document.getElementById('cartModalTags').innerHTML = `
            <span style="background:#f4f5f7;border:1px solid rgba(50,111,202,0.12);padding:5px 12px;border-radius:100px;font-size:0.78rem;">${p.ProductCondition}</span>
            <span style="background:#f4f5f7;border:1px solid rgba(50,111,202,0.12);padding:5px 12px;border-radius:100px;font-size:0.78rem;">🏷️ ${categoryName}</span>
        `;

        // Seller
        const initials = p.sellerName ? p.sellerName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '??';
        document.getElementById('cartModalSellerAvatar').textContent = initials;
        document.getElementById('cartModalSellerName').textContent   = p.sellerName || 'Unknown Seller';
        document.getElementById('cartModalSellerSub').textContent    = `Condition: ${p.ProductCondition}`;

        // Buy button
        const buyBtn = document.getElementById('cartModalBuyBtn');
        if (p.Quantity <= 0 || p.Status === 'Sold') {
            buyBtn.disabled = true;
            buyBtn.textContent = 'Out of Stock';
            buyBtn.style.opacity = '0.5';
        } else {
            buyBtn.disabled = false;
            buyBtn.textContent = '🛒 Buy';
            buyBtn.style.opacity = '1';
            buyBtn.onclick = async () => {
                if (!confirm('Confirm purchase?')) return;
                buyBtn.disabled = true;
                buyBtn.textContent = 'Processing…';
                try {
                    const res = await fetch(`${API_BASE}/cart/${productID}/buy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-auth-token': token }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        closeCartItemModal();
                        showProfileToast(data.message || 'Purchase confirmed!');
                        loadMyCart();
                    } else {
                        showProfileToast(data.message || 'Purchase failed.', 'error');
                        buyBtn.disabled = false;
                        buyBtn.textContent = '🛒 Buy';
                    }
                } catch(e) {
                    showProfileToast('Server is offline.', 'error');
                    buyBtn.disabled = false;
                    buyBtn.textContent = '🛒 Buy';
                }
            };
        }

        // Remove from cart button
        const removeBtn = document.getElementById('cartModalRemoveBtn');
        if (removeBtn) {
            removeBtn.onclick = async () => {
                if (!confirm('Remove this item from your cart?')) return;
                try {
                    const res = await fetch(`${API_BASE}/cart/${productID}`, {
                        method: 'DELETE',
                        headers: { 'x-auth-token': token }
                    });
                    if (res.ok) {
                        closeCartItemModal();
                        showProfileToast('Removed from cart.');
                        loadMyCart();
                    }
                } catch(e) {
                    showProfileToast('Server is offline.', 'error');
                }
            };
        }

        // Messenger button
        const messengerBtn = document.getElementById('cartModalMessengerBtn');
        if (p.MessengerLink) {
            messengerBtn.style.display = '';
            messengerBtn.onclick = () => window.open(p.MessengerLink, '_blank');
        } else {
            messengerBtn.style.display = 'none';
        }

        modal.style.display = 'flex';
    } catch(err) {
        showProfileToast('Could not load product.', 'error');
    }
};

window.closeCartItemModal = function() {
    const modal = document.getElementById('cartItemModal');
    if (modal) modal.style.display = 'none';
};

// Backdrop close handled inline on the modal element

// ===== LOAD CART =====
async function loadMyCart() {
    try {
        const response = await fetch(`${API_BASE}/cart`, {
            headers: { 'x-auth-token': token }
        });
        const items = await response.json();

        const grid    = document.getElementById('cartGrid');
        const countEl = document.getElementById('cartTabCount');
        if (!grid) return;

        if (countEl) countEl.textContent = items.length;

        if (!items.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛒</div>
                    <h4>Your cart is empty</h4>
                    <p>Add items from the marketplace to see them here.</p>
                </div>`;
            return;
        }

        grid.innerHTML = items.filter(item => item.ProductName && item.ProductID).map(item => {
            const isSoldOut = item.ProductStatus === 'Sold' || item.StockLeft <= 0;
            return `
            <div class="listing-card" onclick="openCartItemModal(${item.ProductID})" style="cursor:pointer;">
                <div class="listing-img">
                    ${item.ImageURL
                        ? `<img src="${item.ImageURL.startsWith('http') ? item.ImageURL : 'http://localhost:5000' + item.ImageURL}" alt="${item.ProductName}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">`
                        : '📦'
                    }
                    ${isSoldOut ? `<span class="listing-status sold">Sold Out</span>` : `<span class="listing-status active">Available</span>`}
                </div>
                <div class="listing-info">
                    <h4>${item.ProductName}</h4>
                    <div class="price">₱${parseFloat(item.Price).toLocaleString()}</div>
                    <div class="meta" style="margin-bottom:4px;">
                        ${item.ProductCondition} · ${item.sellerName}
                    </div>
                    <div style="font-size:0.75rem;color:${item.StockLeft <= 1 ? '#f5a623' : 'var(--charcoal-3)'};margin-bottom:10px;">
                        ${isSoldOut ? 'No longer available' : `${item.StockLeft} unit${item.StockLeft !== 1 ? 's' : ''} left`}
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${!isSoldOut ? `
                        <button onclick="event.stopPropagation(); buyFromCart(${item.ProductID})" style="flex:1;padding:7px 8px;border:none;background:var(--blue);color:white;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">🛒 Buy</button>
                        ` : ''}
                        <button onclick="event.stopPropagation(); removeFromCart(${item.ProductID})" style="flex:1;padding:7px 8px;border:1.5px solid rgba(224,80,74,0.3);background:rgba(224,80,74,0.05);color:#c0392b;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">🗑 Remove</button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error('Failed to load cart:', err);
    }
}

// Buy from cart
window.buyFromCart = async function(productID) {
    if (!confirm('Confirm purchase? This will create a transaction with the seller.')) return;
    try {
        const response = await fetch(`${API_BASE}/cart/${productID}/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token }
        });
        const data = await response.json();
        if (response.ok) {
            showProfileToast(data.message || 'Purchase confirmed!');
            loadMyCart();
        } else {
            showProfileToast(data.message || 'Purchase failed.', 'error');
        }
    } catch (err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// Remove from cart
window.removeFromCart = async function(productID) {
    try {
        const response = await fetch(`${API_BASE}/cart/${productID}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token }
        });
        if (response.ok) {
            showProfileToast('Removed from cart.');
            loadMyCart();
        }
    } catch (err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// ===== SELLER: MY SALES (transactions where I'm the seller) =====
async function loadMySales() {
    const soldTab = document.getElementById('tab-sold');
    if (!soldTab) return;
    try {
        const res  = await fetch(`${API_BASE}/transactions/my/sales`, { headers: { 'x-auth-token': token } });
        const txns = await res.json();

        // Update sold tab count
        const soldCountEl = document.getElementById('soldTabCount');
        if (soldCountEl) soldCountEl.textContent = txns.length;

        if (!txns.length) {
            soldTab.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div><div class="empty-title">No sales yet</div><div class="empty-sub">When a buyer purchases your item, it appears here.</div></div>`;
            return;
        }

        const pending   = txns.filter(t => t.Status === 'Pending');
        const completed = txns.filter(t => t.Status === 'Completed');

        let html = '';

        if (pending.length) {
            html += `<div style="font-family:'Sora',sans-serif;font-size:0.85rem;font-weight:600;color:#f5a623;margin-bottom:12px;display:flex;align-items:center;gap:6px;">⏳ Pending (${pending.length})</div>`;
            html += `<div class="listings-grid" style="margin-bottom:24px;">` + pending.map(t => `
                <div class="listing-card">
                    <div class="listing-img">
                        ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">` : '📦'}
                        <span class="listing-status active">Pending</span>
                    </div>
                    <div class="listing-info">
                        <h4>${t.ProductName}</h4>
                        <div class="price">₱${parseFloat(t.Price).toLocaleString()}</div>
                        <div class="meta" style="margin-bottom:8px;">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                        <button onclick="completeTransaction(${t.TransactionID})" style="width:100%;padding:7px;border:none;background:#2d9e50;color:white;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">✅ Mark as Completed</button>
                    </div>
                </div>
            `).join('') + `</div>`;
        }

        if (completed.length) {
            html += `<div style="font-family:'Sora',sans-serif;font-size:0.85rem;font-weight:600;color:#888;margin-bottom:12px;">✅ Completed (${completed.length})</div>`;
            html += `<div class="listings-grid">` + completed.map(t => `
                <div class="listing-card" style="opacity:0.8;">
                    <div class="listing-img">
                        ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">` : '📦'}
                        <span class="listing-status sold">Completed</span>
                    </div>
                    <div class="listing-info">
                        <h4>${t.ProductName}</h4>
                        <div class="price" style="color:#888;">₱${parseFloat(t.Price).toLocaleString()}</div>
                        <div class="meta">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                    </div>
                </div>
            `).join('') + `</div>`;
        }

        soldTab.innerHTML = html;
    } catch(err) {
        console.error('Failed to load sales:', err);
    }
}

// Mark transaction as Completed (seller action)
window.completeTransaction = async function(transactionID) {
    if (!confirm('Mark this transaction as completed?')) return;
    try {
        const res  = await fetch(`${API_BASE}/transactions/${transactionID}/status`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body:    JSON.stringify({ status: 'Completed' })
        });
        const data = await res.json();
        if (res.ok) {
            showProfileToast('Transaction marked as completed!');
            loadMySales();
        } else {
            showProfileToast(data.message || 'Failed.', 'error');
        }
    } catch(err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// ===== BUYER: MY PURCHASES =====
async function loadMyPurchases() {
    const tab = document.getElementById('tab-purchases');
    if (!tab) return;
    try {
        const res  = await fetch(`${API_BASE}/transactions/my/purchases`, { headers: { 'x-auth-token': token } });
        const txns = await res.json();

        // Update purchases tab count badge
        const purchasesTabBtn = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.includes('Purchases'));
        if (purchasesTabBtn) {
            const countEl = purchasesTabBtn.querySelector('.tab-count');
            if (countEl) countEl.textContent = txns.length;
        }

        // Update stat
        const statBought = document.getElementById('statBought');
        if (statBought) statBought.textContent = txns.length;



        if (!txns.length) {
            tab.innerHTML = `<div class="empty-state"><div class="empty-icon">🛍️</div><div class="empty-title">No purchases yet</div><div class="empty-sub">Items you buy will appear here.</div></div>`;
            return;
        }

        // Fetch reviews the current user has already written
        let reviewedTransactionIDs = new Set();
        try {
            const myUserID = localStorage.getItem('userID');
            const revRes   = await fetch(`${API_BASE}/reviews/user/${myUserID}`, { headers: { 'x-auth-token': token } });
            // We need to check from buyer's perspective — fetch purchases reviews differently
            // Instead check each transaction's review via the backend unique constraint response
        } catch(e) {}

        tab.innerHTML = `<div class="listings-grid">` + txns.map(t => {
            const isCompleted  = t.Status === 'Completed';
            const txID         = t.TransactionID;
            return `
            <div class="listing-card" data-transaction-id="${txID}">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">` : '📦'}
                    <span class="listing-status ${isCompleted ? 'sold' : 'active'}">${t.Status}</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta" style="margin-bottom:8px;">Seller: ${t.SellerFirstName} ${t.SellerLastName}</div>
                    ${isCompleted ? `
                    <button id="reviewBtn-${txID}" onclick="handleReviewBtn(${txID}, '${t.ProductName.replace(/'/g, "\\'")}')"
                        style="width:100%;padding:7px;border:none;background:var(--blue);color:white;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">
                        ⭐ Leave Review
                    </button>` : `
                    <div style="font-size:0.76rem;color:#f5a623;font-weight:500;">⏳ Waiting for seller to confirm</div>
                    `}
                </div>
            </div>`;
        }).join('') + `</div>`;

        // Now check each completed transaction for existing review and update buttons
        txns.filter(t => t.Status === 'Completed').forEach(async t => {
            try {
                const rRes  = await fetch(`${API_BASE}/reviews/transaction/${t.TransactionID}`, { headers: { 'x-auth-token': token } });
                const btn   = document.getElementById(`reviewBtn-${t.TransactionID}`);
                if (!btn) return;
                if (rRes.ok) {
                    // Review exists — disable button
                    btn.textContent  = '✓ Reviewed';
                    btn.disabled     = true;
                    btn.style.background = '#888';
                    btn.style.cursor = 'default';
                }
            } catch(e) {}
        });
    } catch(err) {
        console.error('Failed to load purchases:', err);
    }
}

// ===== REVIEW MODAL =====
function openReviewModal(transactionID, productName) {
    const modal = document.getElementById('reviewModal');
    if (!modal) return;
    document.getElementById('reviewModalProduct').textContent = `Review for: ${productName}`;
    document.getElementById('reviewTransactionID').value = transactionID;
    document.getElementById('reviewComment').value = '';
    // Reset stars
    document.querySelectorAll('.star-btn').forEach(s => {
        s.style.opacity = '0.3';
        s.style.color = '';
    });
    document.getElementById('selectedRating').value = '';
    modal.style.display = 'flex';
}

window.handleReviewBtn = function(transactionID, productName) {
    openReviewModal(transactionID, productName);
};

window.closeReviewModal = function() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'none';
};

window.submitReview = async function() {
    const transactionID = document.getElementById('reviewTransactionID').value;
    const rating        = document.getElementById('selectedRating').value;
    const comment       = document.getElementById('reviewComment').value.trim();

    if (!rating) { showProfileToast('Please select a star rating.', 'error'); return; }

    try {
        const res  = await fetch(`${API_BASE}/reviews`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body:    JSON.stringify({ transactionID: parseInt(transactionID), rating: parseInt(rating), comment })
        });
        const data = await res.json();
        if (res.ok) {
            closeReviewModal();
            showProfileToast('Review submitted! ⭐');
            // Disable the button for this transaction
            const btn = document.getElementById(`reviewBtn-${transactionID}`);
            if (btn) {
                btn.textContent      = '✓ Reviewed';
                btn.disabled         = true;
                btn.style.background = '#888';
                btn.style.cursor     = 'default';
            }
            loadMyReviews();
        } else {
            showProfileToast(data.message || 'Failed to submit review.', 'error');
        }
    } catch(err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// Wire logout button if it exists
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.querySelector('[onclick="logout()"], .btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    loadProfile();
    loadMyListings();
    loadMySales();
    loadMyReviews();
    loadMyCart();
    loadMyPurchases();
    loadSavedItems();
    wireSettingsButtons();
    loadToggleStates();
});

// ===== SETTINGS TOGGLES (localStorage persistence) =====
const TOGGLE_KEYS = {
    "Message Notifications": "pref_msg_notifications",
    "Listing Saves":         "pref_listing_saves",
    "Purchase Requests":     "pref_purchase_requests",
    "Promotional Updates":   "pref_promo_updates",
    "Show Online Status":    "pref_online_status",
    "Show Activity Stats":   "pref_activity_stats",
};

function loadToggleStates() {
    document.querySelectorAll(".settings-toggle").forEach(toggle => {
        const title = toggle.closest(".settings-row")?.querySelector(".settings-row-title")?.textContent.trim();
        const key = TOGGLE_KEYS[title];
        if (!key) return;
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            saved === "true" ? toggle.classList.add("on") : toggle.classList.remove("on");
        }
        toggle.onclick = function() {
            this.classList.toggle("on");
            localStorage.setItem(key, this.classList.contains("on").toString());
        };
    });
}

// ===== MY LISTING ACTIONS =====
window.deleteMyListing = async function(productID) {
    if (!confirm('Are you sure you want to remove this listing?')) return;
    try {
        const response = await fetch(`${API_BASE}/products/${productID}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        if (response.ok) {
            showProfileToast('Listing removed successfully!');
            loadMyListings();
        } else {
            showProfileToast(data.message || 'Failed to remove listing.', 'error');
        }
    } catch (err) {
        showProfileToast('Server is offline.', 'error');
    }
};

window.markAsSold = async function(productID) {
    if (!confirm('Mark this item as sold?')) return;
    try {
        const response = await fetch(`${API_BASE}/products/${productID}/sold`, {
            method: 'PATCH',
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();
        if (response.ok) {
            showProfileToast('Item marked as sold!');
            loadMyListings();
        } else {
            showProfileToast(data.message || 'Failed to mark as sold.', 'error');
        }
    } catch (err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// ===== LOGOUT & DELETE ACCOUNT =====
function wireSettingsButtons() {
    // Find all settings rows and wire by title text
    document.querySelectorAll(".settings-row").forEach(row => {
        const title = row.querySelector(".settings-row-title")?.textContent.trim();

        if (title === "Change Password") {
            row.style.cursor = "pointer";
            row.addEventListener("click", async () => {
                const currentPassword = prompt("Enter your current password:");
                if (!currentPassword) return;
                const newPassword = prompt("Enter your new password (min 6 characters):");
                if (!newPassword || newPassword.length < 6) {
                    showProfileToast("New password must be at least 6 characters.", "error");
                    return;
                }
                const confirmPassword = prompt("Confirm your new password:");
                if (newPassword !== confirmPassword) {
                    showProfileToast("Passwords do not match.", "error");
                    return;
                }
                try {
                    const response = await fetch(`${API_BASE}/users/change-password`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json", "x-auth-token": token },
                        body: JSON.stringify({ currentPassword, newPassword })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        showProfileToast("Password changed successfully! ✅");
                    } else {
                        showProfileToast(data.message || "Failed to change password.", "error");
                    }
                } catch (err) {
                    showProfileToast("Server is offline.", "error");
                }
            });
        }

        if (title === "Log Out") {
            row.style.cursor = "pointer";
            row.addEventListener("click", () => {
                if (confirm("Are you sure you want to log out?")) {
                    localStorage.clear();
                    window.location.href = "index.html";
                }
            });
        }

        if (title === "Delete Account") {
            row.style.cursor = "pointer";
            row.addEventListener("click", async () => {
                if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
                if (!confirm("Last warning — this will permanently delete your account and all your listings.")) return;

                // For now just log out since delete account endpoint is not implemented
                showProfileToast("Account deletion coming soon. Logging you out for now.", "error");
                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = "index.html";
                }, 2000);
            });
        }
    });
}

function showProfileToast(msg, type = 'success') {
    const toast    = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast) return;
    toastMsg.textContent = msg;
    const icon = toast.querySelector('svg');
    if (icon) icon.style.color = type === 'error' ? '#e0504a' : '#5ddf7a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
