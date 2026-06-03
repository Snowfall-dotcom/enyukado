// ======================================================
// ENYUKADO - profile-api.js
// ======================================================

const API_BASE = 'http://localhost:5000/api';
const token    = localStorage.getItem('userToken');
const myUserID = localStorage.getItem('userID');

const urlParams     = new URLSearchParams(window.location.search);
const viewingUserID = urlParams.get('id');
const isOwnProfile  = !viewingUserID || viewingUserID === String(myUserID);

const PICKUP_LOCATION = 'Student Affairs Office, Ground Floor, Building A';

// Auth guard
if (!token) window.location.href = 'index.html';

// ======================================================
// LOAD PROFILE
// ======================================================
async function loadProfile() {
    try {
        let user;
        if (isOwnProfile) {
            const res = await fetch(`${API_BASE}/users/profile`, { headers: { 'x-auth-token': token } });
            if (res.status === 401) { localStorage.clear(); window.location.href = 'index.html'; return; }
            user = await res.json();
        } else {
            const res = await fetch(`${API_BASE}/users/${viewingUserID}`);
            if (!res.ok) { window.location.href = 'dashboard.html'; return; }
            user = await res.json();
        }

        // Name + handle
        document.getElementById('profileName').textContent = `${user.FirstName} ${user.LastName}`;
        const joined = user.DateCreated
            ? new Date(user.DateCreated).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : 'Unknown';
        // Fix: remove space from handle
        document.getElementById('profileHandle').textContent =
            `@${(user.FirstName + user.LastName).toLowerCase().replace(/\s+/g, '')} · Member since ${joined}`;

        // Avatar
        document.getElementById('profileAvatarDisplay').textContent =
            `${user.FirstName[0]}${user.LastName[0]}`.toUpperCase();

        // Tags — show course, year, campus area if available
        const tags = ['<span class="profile-tag">🏫 NU Manila</span>'];
        if (user.Course)     tags.push(`<span class="profile-tag">📚 ${user.Course}</span>`);
        if (user.Year)       tags.push(`<span class="profile-tag">📅 ${user.Year}</span>`);
        if (user.CampusArea) tags.push(`<span class="profile-tag">📍 ${user.CampusArea}</span>`);
        document.getElementById('profileTags').innerHTML = tags.join('');

        // Bio
        const bioEl = document.getElementById('profileBio');
        if (bioEl && user.Bio) {
            bioEl.textContent = user.Bio;
            bioEl.style.display = 'block';
        }

        // If viewing someone else — hide own-profile tabs and edit button
        if (!isOwnProfile) {
            document.getElementById('editProfileBtn').style.display = 'none';
            ['sales','purchases','saved','settings'].forEach(tab => {
                const btn = document.querySelector(`[data-tab="${tab}"]`);
                if (btn) btn.style.display = 'none';
            });
            return;
        }

        // Own profile — pre-fill edit modal
        document.getElementById('editFirstName').value  = user.FirstName  || '';
        document.getElementById('editLastName').value   = user.LastName   || '';
        document.getElementById('editBio').value        = user.Bio        || '';
        document.getElementById('editCourse').value     = user.Course     || '';
        document.getElementById('editYear').value       = user.Year       || '';
        document.getElementById('editCampusArea').value = user.CampusArea || '';

        // Show QR code if it exists
        if (user.QRCodeImage) {
            const qrImg = document.getElementById('currentQRImg');
            qrImg.src = user.QRCodeImage;
            qrImg.style.display = 'block';
        }

        // Password last changed
        const pwSub = document.getElementById('passwordLastChanged');
        if (pwSub) {
            pwSub.textContent = user.PasswordChangedAt
                ? 'Last changed ' + new Date(user.PasswordChangedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'You have not changed your password yet';
        }

    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

// ======================================================
// QR CODE UPLOAD
// ======================================================
let qrFileToUpload = null;

window.handleQRUpload = function(input) {
    const file = input.files[0];
    if (!file) return;
    qrFileToUpload = file;

    const reader = new FileReader();
    reader.onload = e => {
        const qrImg = document.getElementById('currentQRImg');
        qrImg.src = e.target.result;
        qrImg.style.display = 'block';
    };
    reader.readAsDataURL(file);
    document.getElementById('qrFileLabel').textContent = file.name;
};

// ======================================================
// SAVE PROFILE (name + QR code)
// ======================================================
window.saveProfile = async function() {
    const firstName  = document.getElementById('editFirstName').value.trim();
    const lastName   = document.getElementById('editLastName').value.trim();
    const bio        = document.getElementById('editBio').value.trim();
    const course     = document.getElementById('editCourse').value.trim();
    const year       = document.getElementById('editYear').value.trim();
    const campusArea = document.getElementById('editCampusArea').value.trim();

    if (!firstName || !lastName) {
        showProfileToast('First and last name are required.', 'error');
        return;
    }

    try {
        // 1. Update profile
        const nameRes = await fetch(`${API_BASE}/users/profile`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body:    JSON.stringify({ firstName, lastName, bio, course, year, campusArea })
        });
        const nameData = await nameRes.json();
        if (!nameRes.ok) { showProfileToast(nameData.message || 'Update failed.', 'error'); return; }

        // 2. Upload QR code if a new one was selected
        if (qrFileToUpload) {
            const formData = new FormData();
            formData.append('qrCode', qrFileToUpload);
            const qrRes = await fetch(`${API_BASE}/users/qr`, {
                method:  'POST',
                headers: { 'x-auth-token': token },
                body:    formData
            });
            if (!qrRes.ok) {
                const qrData = await qrRes.json();
                showProfileToast(qrData.message || 'QR upload failed.', 'error');
                return;
            }
            qrFileToUpload = null;
            document.getElementById('qrFileLabel').textContent = 'Upload new QR code image';
            document.getElementById('qrFileInput').value = '';
        }

        localStorage.setItem('userName',     firstName);
        localStorage.setItem('userLastName', lastName);
        closeEditModal();
        showProfileToast('Profile updated successfully! ✅');
        loadProfile();
    } catch (err) {
        showProfileToast('Server is offline.', 'error');
    }
};

// ======================================================
// LOAD MY LISTINGS
// ======================================================
async function loadMyListings() {
    try {
        let listings;
        if (isOwnProfile) {
            const res = await fetch(`${API_BASE}/products/my/listings`, { headers: { 'x-auth-token': token } });
            listings = await res.json();
        } else {
            const res = await fetch(`${API_BASE}/products?sort=newest`);
            const all = await res.json();
            listings = all.filter(p => String(p.UserID) === String(viewingUserID));
        }

        const listingsTab = document.getElementById('tab-listings');
        if (!listingsTab) return;

        // For own profile show all statuses; for others only Available
        const toShow = isOwnProfile ? listings : listings.filter(p => p.Status === 'Available');

        const available = listings.filter(p => p.Status === 'Available');
        const sold      = listings.filter(p => p.Status === 'Sold');
        const pending   = listings.filter(p => p.Status === 'Pending Approval');

        document.getElementById('listingsTabCount').textContent = toShow.length;
        document.getElementById('statListings').textContent     = available.length;
        document.getElementById('statSold').textContent         = sold.length;

        if (!toShow.length) {
            listingsTab.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><h4>No listings yet</h4><p>Post something to get started!</p></div>`;
            return;
        }

        listingsTab.innerHTML = `<div class="listings-grid">` + toShow.map(p => {
            const imgURL = (p.images && p.images.length > 0) ? p.images[0].ImageURL : (p.ImageURL || null);
            const statusClass = p.Status === 'Available' ? 'available' : p.Status === 'Sold' ? 'sold' : 'pending';
            const statusLabel = p.Status === 'Pending Approval' ? '⏳ Pending' : p.Status;

            return `
            <div class="listing-card">
                <div class="listing-img">
                    ${imgURL ? `<img src="${imgURL}" alt="${p.ProductName}" />` : '📦'}
                    <span class="listing-status ${statusClass}">${statusLabel}</span>
                </div>
                <div class="listing-info">
                    <h4>${p.ProductName}</h4>
                    <div class="price">₱${parseFloat(p.Price).toLocaleString()}</div>
                    <div class="meta" style="margin-bottom:4px;">${p.ProductCondition} · ${p.Quantity} unit${p.Quantity !== 1 ? 's' : ''}</div>
                    ${isOwnProfile && p.Status !== 'Sold' ? `
                    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                        <button class="action-btn primary" onclick="redirectToEditListing(${p.ProductID})">✏️ Edit</button>
                        <button class="action-btn danger" onclick="deleteMyListing(${p.ProductID})">🗑 Remove</button>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('') + `</div>`;
    } catch (err) {
        console.error('Failed to load listings:', err);
    }
}

// ── Edit listing inline modal ──
let editListingFiles = [];

window.redirectToEditListing = async function(productID) {
    try {
        const res = await fetch(`${API_BASE}/products/${productID}`);
        const p   = await res.json();

        // Fill fields
        document.getElementById('editListingProductID').value  = productID;
        document.getElementById('editListingName').value       = p.ProductName        || '';
        document.getElementById('editListingPrice').value      = p.Price              || '';
        document.getElementById('editListingQuantity').value   = p.Quantity           || 1;
        document.getElementById('editListingDesc').value       = p.Description        || '';
        document.getElementById('editListingCondition').value  = p.ProductCondition   || '';

        // Load categories into select if not already loaded
        const catSelect = document.getElementById('editListingCategory');
        if (catSelect.options.length <= 1) {
            const catRes  = await fetch(`${API_BASE}/categories`);
            const cats    = await catRes.json();
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.CategoryID;
                opt.textContent = c.CategoryName;
                catSelect.appendChild(opt);
            });
        }
        catSelect.value = p.CategoryID || '';

        // Show current images
        const currentImgsEl = document.getElementById('editListingCurrentImgs');
        currentImgsEl.innerHTML = '';
        if (p.images && p.images.length > 0) {
            p.images.forEach(img => {
                const el = document.createElement('img');
                el.src = img.ImageURL;
                el.style.cssText = 'width:56px;height:56px;border-radius:6px;object-fit:cover;border:1.5px solid #dde2ec;';
                currentImgsEl.appendChild(el);
            });
        }

        // Reset new image selection
        editListingFiles = [];
        document.getElementById('editListingNewImgPreview').innerHTML = '';
        document.getElementById('editListingImages').value = '';

        document.getElementById('editListingModal').classList.add('open');
    } catch(e) {
        showProfileToast('Could not load listing data.', 'error');
    }
};

window.closeEditListingModal = function() {
    document.getElementById('editListingModal').classList.remove('open');
    editListingFiles = [];
};

window.handleEditListingImages = function(input) {
    const files = Array.from(input.files).slice(0, 5);
    editListingFiles = files;
    const preview = document.getElementById('editListingNewImgPreview');
    preview.innerHTML = '';
    files.forEach(f => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = 'width:56px;height:56px;border-radius:6px;object-fit:cover;border:1.5px solid var(--blue);';
            preview.appendChild(img);
        };
        reader.readAsDataURL(f);
    });
};

window.saveEditedListing = async function() {
    const productID      = document.getElementById('editListingProductID').value;
    const productName    = document.getElementById('editListingName').value.trim();
    const price          = document.getElementById('editListingPrice').value;
    const quantity       = document.getElementById('editListingQuantity').value;
    const categoryID     = document.getElementById('editListingCategory').value;
    const condition      = document.getElementById('editListingCondition').value;
    const description    = document.getElementById('editListingDesc').value.trim();

    if (!productName) return showProfileToast('Item name is required.', 'error');
    if (!price)       return showProfileToast('Price is required.', 'error');
    if (!categoryID)  return showProfileToast('Please select a category.', 'error');
    if (!condition)   return showProfileToast('Please select a condition.', 'error');

    const btn = document.getElementById('saveEditListingBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const formData = new FormData();
        formData.append('productName',      productName);
        formData.append('price',            parseFloat(price));
        formData.append('description',      description);
        formData.append('productCondition', condition);
        formData.append('categoryID',       parseInt(categoryID));
        formData.append('quantity',         parseInt(quantity) || 1);

        // Only append images if new ones were selected
        if (editListingFiles.length > 0) {
            editListingFiles.forEach(f => formData.append('productImages', f));
        } else {
            // Send a placeholder so backend knows to keep existing images
            formData.append('keepExistingImages', 'true');
        }

        const res  = await fetch(`${API_BASE}/products/${productID}`, {
            method:  'PUT',
            headers: { 'x-auth-token': token },
            body:    formData
        });
        const data = await res.json();

        if (res.ok) {
            closeEditListingModal();
            showProfileToast('Listing updated! Re-submitted for approval. ✅');
            loadMyListings();
        } else {
            showProfileToast(data.message || 'Failed to update.', 'error');
        }
    } catch(err) {
        showProfileToast('Server is offline.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
};

window.deleteMyListing = async function(productID) {
    if (!confirm('Are you sure you want to remove this listing?')) return;
    try {
        const res  = await fetch(`${API_BASE}/products/${productID}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
        const data = await res.json();
        if (res.ok) { showProfileToast('Listing removed!'); loadMyListings(); }
        else showProfileToast(data.message || 'Failed.', 'error');
    } catch (err) { showProfileToast('Server is offline.', 'error'); }
};

// ======================================================
// LOAD MY SALES (seller view of transactions)
// ======================================================
async function loadMySales() {
    const tab = document.getElementById('tab-sales');
    if (!tab || !isOwnProfile) return;

    try {
        const res  = await fetch(`${API_BASE}/transactions/my/sales`, { headers: { 'x-auth-token': token } });
        const txns = await res.json();

        document.getElementById('salesTabCount').textContent = txns.length;

        if (!txns.length) {
            tab.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏷️</div><h4>No sales yet</h4><p>When a buyer purchases your item, it appears here.</p></div>`;
            return;
        }

        // Group by status
        const groups = {
            'Payment Approved': txns.filter(t => t.Status === 'Payment Approved'),
            'Pending':          txns.filter(t => t.Status === 'Pending'),
            'Dropped Off':      txns.filter(t => t.Status === 'Dropped Off'),
            'Completed':        txns.filter(t => t.Status === 'Completed'),
            'Cancelled':        txns.filter(t => t.Status === 'Cancelled'),
        };

        let html = '';

        const renderGroup = (label, items, cardFn) => {
            if (!items.length) return '';
            return `
                <div style="font-family:'Sora',sans-serif;font-size:0.85rem;font-weight:600;color:var(--charcoal-3);margin-bottom:12px;margin-top:16px;">${label} (${items.length})</div>
                <div class="listings-grid" style="margin-bottom:8px;">${items.map(cardFn).join('')}</div>
            `;
        };

        // Payment Approved — needs drop-off
        html += renderGroup('✅ Payment Approved — Drop off required', groups['Payment Approved'], t => `
            <div class="listing-card">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" />` : '📦'}
                    <span class="listing-status available">Pay Approved</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta" style="margin-bottom:6px;">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                    <div class="pickup-box">📍 Drop off at: <strong>${PICKUP_LOCATION}</strong></div>
                    <button class="action-btn blue-solid" style="width:100%;padding:8px;" onclick="markDroppedOff(${t.TransactionID})">📦 Mark as Dropped Off</button>
                </div>
            </div>
        `);

        // Pending — waiting for admin
        html += renderGroup('⏳ Pending Admin Approval', groups['Pending'], t => `
            <div class="listing-card">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" />` : '📦'}
                    <span class="listing-status pending">Pending</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                    <div style="font-size:0.74rem;color:var(--orange);margin-top:6px;">⏳ Waiting for admin to confirm payment</div>
                </div>
            </div>
        `);

        // Dropped Off — waiting for pickup
        html += renderGroup('📦 Dropped Off — Waiting for pickup', groups['Dropped Off'], t => `
            <div class="listing-card">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" />` : '📦'}
                    <span class="listing-status dropped">Dropped Off</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                    <div style="font-size:0.74rem;color:var(--blue);margin-top:6px;">📍 Item at pickup location</div>
                </div>
            </div>
        `);

        // Completed
        html += renderGroup('✅ Completed', groups['Completed'], t => `
            <div class="listing-card">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" />` : '📦'}
                    <span class="listing-status sold">Completed</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price" style="color:var(--charcoal-3);">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                </div>
            </div>
        `);

        // Cancelled
        html += renderGroup('❌ Cancelled', groups['Cancelled'], t => `
            <div class="listing-card">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" />` : '📦'}
                    <span class="listing-status sold">Cancelled</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price" style="color:var(--charcoal-3);">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta">Buyer: ${t.BuyerFirstName} ${t.BuyerLastName}</div>
                </div>
            </div>
        `);

        tab.innerHTML = html || `<div class="empty-state"><div class="empty-state-icon">🏷️</div><h4>No sales yet</h4></div>`;
    } catch (err) {
        console.error('Failed to load sales:', err);
    }
}

// Mark as Dropped Off (seller)
window.markDroppedOff = async function(transactionID) {
    if (!confirm('Confirm that you have dropped the item off at the pickup location?')) return;
    try {
        const res  = await fetch(`${API_BASE}/transactions/${transactionID}/dropoff`, {
            method: 'PATCH', headers: { 'x-auth-token': token }
        });
        const data = await res.json();
        if (res.ok) { showProfileToast('Item marked as dropped off! Buyer has been notified. 📦'); loadMySales(); }
        else showProfileToast(data.message || 'Failed.', 'error');
    } catch(err) { showProfileToast('Server is offline.', 'error'); }
};

// ======================================================
// LOAD MY PURCHASES (buyer view)
// ======================================================
async function loadMyPurchases() {
    const tab = document.getElementById('tab-purchases');
    if (!tab || !isOwnProfile) return;

    try {
        const res  = await fetch(`${API_BASE}/transactions/my/purchases`, { headers: { 'x-auth-token': token } });
        const txns = await res.json();

        document.getElementById('purchasesTabCount').textContent = txns.length;
        document.getElementById('statBought').textContent        = txns.length;

        if (!txns.length) {
            tab.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛍️</div><h4>No purchases yet</h4><p>Items you buy will appear here.</p></div>`;
            return;
        }

        tab.innerHTML = `<div class="listings-grid">` + txns.map(t => {
            const statusClass =
                t.Status === 'Completed'        ? 'available' :
                t.Status === 'Dropped Off'      ? 'dropped'   :
                t.Status === 'Payment Approved' ? 'available' :
                t.Status === 'Cancelled'        ? 'sold'      : 'pending';

            return `
            <div class="listing-card" data-tx-id="${t.TransactionID}">
                <div class="listing-img">
                    ${t.ImageURL ? `<img src="${t.ImageURL}" alt="${t.ProductName}" />` : '📦'}
                    <span class="listing-status ${statusClass}">${t.Status}</span>
                </div>
                <div class="listing-info">
                    <h4>${t.ProductName}</h4>
                    <div class="price">₱${parseFloat(t.Price).toLocaleString()}</div>
                    <div class="meta" style="margin-bottom:6px;">Seller: ${t.SellerFirstName} ${t.SellerLastName}</div>
                    ${t.Status === 'Dropped Off' ? `
                        <div class="pickup-box">📍 Ready for pickup at: <strong>${PICKUP_LOCATION}</strong><br>Please bring your student ID.</div>
                        <button class="action-btn blue-solid" style="width:100%;padding:8px;" onclick="confirmPickup(${t.TransactionID})">✅ Confirm Pickup</button>
                    ` : t.Status === 'Completed' ? `
                        <button id="reviewBtn-${t.TransactionID}" class="action-btn success" style="width:100%;padding:8px;" onclick="handleReviewBtn(${t.TransactionID}, '${t.ProductName.replace(/'/g, "\\'")}')">⭐ Leave Review</button>
                    ` : t.Status === 'Pending' ? `
                        <div style="font-size:0.74rem;color:var(--orange);margin-top:4px;">⏳ Awaiting admin payment confirmation</div>
                    ` : t.Status === 'Payment Approved' ? `
                        <div style="font-size:0.74rem;color:var(--blue);margin-top:4px;">✅ Payment confirmed — seller is preparing drop-off</div>
                    ` : t.Status === 'Cancelled' ? `
                        <div style="font-size:0.74rem;color:var(--red);margin-top:4px;">❌ Transaction cancelled</div>
                    ` : ''}
                </div>
            </div>`;
        }).join('') + `</div>`;

        // Check which completed transactions already have reviews
        txns.filter(t => t.Status === 'Completed').forEach(async t => {
            try {
                const rRes = await fetch(`${API_BASE}/reviews/transaction/${t.TransactionID}`, { headers: { 'x-auth-token': token } });
                const btn  = document.getElementById(`reviewBtn-${t.TransactionID}`);
                if (!btn) return;
                if (rRes.ok) {
                    btn.textContent = '✓ Reviewed';
                    btn.disabled    = true;
                    btn.style.opacity = '0.6';
                    btn.style.cursor  = 'default';
                }
            } catch(e) {}
        });

    } catch(err) {
        console.error('Failed to load purchases:', err);
    }
}

// Confirm pickup (buyer)
window.confirmPickup = async function(transactionID) {
    if (!confirm('Confirm that you have picked up the item?')) return;
    try {
        const res  = await fetch(`${API_BASE}/transactions/${transactionID}/complete`, {
            method: 'PATCH', headers: { 'x-auth-token': token }
        });
        const data = await res.json();
        if (res.ok) { showProfileToast('Pickup confirmed! Transaction complete. 🎉'); loadMyPurchases(); }
        else showProfileToast(data.message || 'Failed.', 'error');
    } catch(err) { showProfileToast('Server is offline.', 'error'); }
};

// ======================================================
// REVIEWS
// ======================================================
window.handleReviewBtn = function(transactionID, productName) {
    openReviewModal(transactionID, productName);
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
            const btn = document.getElementById(`reviewBtn-${transactionID}`);
            if (btn) { btn.textContent = '✓ Reviewed'; btn.disabled = true; btn.style.opacity = '0.6'; }
            loadMyReviews();
        } else {
            showProfileToast(data.message || 'Failed to submit review.', 'error');
        }
    } catch(err) { showProfileToast('Server is offline.', 'error'); }
};

async function loadMyReviews() {
    const targetID = isOwnProfile ? myUserID : viewingUserID;
    try {
        const res  = await fetch(`${API_BASE}/reviews/user/${targetID}`);
        const data = await res.json();
        const tab  = document.getElementById('tab-reviews');

        document.getElementById('reviewsTabCount').textContent = data.totalReviews || 0;
        document.getElementById('ratingBigNum').textContent   = data.averageRating || '0.0';
        document.getElementById('ratingCount').textContent    = `${data.totalReviews || 0} review${data.totalReviews !== 1 ? 's' : ''}`;
        document.getElementById('statRating').textContent     = data.averageRating ? `${data.averageRating}⭐` : '—';

        // Stars display
        const avg  = parseFloat(data.averageRating || 0);
        const full = Math.round(avg);
        document.getElementById('ratingStars').textContent = '★'.repeat(full) + '☆'.repeat(5 - full);

        // Rating bars
        const counts = { 5:0, 4:0, 3:0, 2:0, 1:0 };
        if (data.reviews) data.reviews.forEach(r => { if (counts[r.Rating] !== undefined) counts[r.Rating]++; });
        const maxCount = Math.max(...Object.values(counts), 1);
        document.getElementById('ratingBars').innerHTML = [5,4,3,2,1].map(star => `
            <div class="rating-bar-row">
                <span>${star}</span>
                <div class="rating-bar-bg"><div class="rating-bar-fill" style="width:${Math.round((counts[star]/maxCount)*100)}%"></div></div>
                <span>${counts[star]}</span>
            </div>
        `).join('');

        if (!data.totalReviews) {
            tab.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⭐</div><h4>No reviews yet</h4><p>Complete a transaction to receive reviews.</p></div>`;
            return;
        }

        tab.innerHTML = `<div class="reviews-list">` + data.reviews.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <div class="reviewer-avatar">${r.ReviewerFirstName[0]}${r.ReviewerLastName[0]}</div>
                    <div>
                        <div class="reviewer-name">${r.ReviewerFirstName} ${r.ReviewerLastName}</div>
                        <div class="review-stars">${'★'.repeat(r.Rating)}${'☆'.repeat(5-r.Rating)}</div>
                    </div>
                    <div class="review-time">${new Date(r.DateCreated).toLocaleDateString()}</div>
                </div>
                ${r.Comment ? `<div class="review-text">${r.Comment}</div>` : ''}
                <div class="review-product-ref">📦 ${r.ProductName}</div>
            </div>
        `).join('') + `</div>`;
    } catch(err) {
        console.error('Failed to load reviews:', err);
    }
}

// ======================================================
// SAVED ITEMS
// ======================================================
async function loadSavedItems() {
    const tab = document.getElementById('tab-saved');
    if (!tab || !isOwnProfile) return;

    try {
        const res   = await fetch(`${API_BASE}/saved`, { headers: { 'x-auth-token': token } });
        const saved = await res.json();

        document.getElementById('savedTabCount').textContent = saved.length || 0;

        if (!saved.length) {
            tab.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🤍</div><h4>Nothing saved yet</h4><p>Heart items on the marketplace to save them here.</p></div>`;
            return;
        }

        tab.innerHTML = `<div class="listings-grid">` + saved.map(p => `
            <div class="listing-card">
                <div class="listing-img">
                    ${p.ImageURL ? `<img src="${p.ImageURL}" alt="${p.ProductName}" />` : '📦'}
                    <span class="listing-status ${p.Status === 'Available' ? 'available' : 'sold'}">${p.Status}</span>
                </div>
                <div class="listing-info">
                    <h4>${p.ProductName}</h4>
                    <div class="price">₱${parseFloat(p.Price).toLocaleString()}</div>
                    <div class="meta" style="margin-bottom:8px;">${p.ProductCondition} · ${p.sellerName}</div>
                    <div style="display:flex;gap:6px;">
                        <button class="action-btn primary" onclick="viewOnMarketplace(${p.ProductID})" style="flex:1;">👁 View</button>
                        <button class="action-btn danger" onclick="unsaveItem(${p.ProductID})" style="flex:1;">🗑 Remove</button>
                    </div>
                </div>
            </div>
        `).join('') + `</div>`;
    } catch(err) {
        console.error('Failed to load saved items:', err);
    }
}

window.viewOnMarketplace = function(productID) {
    localStorage.setItem('openProductID', productID);
    window.location.href = 'dashboard.html';
};

window.unsaveItem = async function(productID) {
    try {
        await fetch(`${API_BASE}/saved/${productID}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
        showProfileToast('Removed from saved items.');
        loadSavedItems();
    } catch(e) { showProfileToast('Server is offline.', 'error'); }
};

// ======================================================
// SETTINGS WIRING
// ======================================================
function wireSettingsButtons() {
    // Change Password
    const changePasswordRow = document.getElementById('changePasswordRow');
    if (changePasswordRow) {
        changePasswordRow.addEventListener('click', async () => {
            const currentPassword = prompt('Enter your current password:');
            if (!currentPassword) return;
            const newPassword = prompt('Enter your new password (min 6 characters):');
            if (!newPassword || newPassword.length < 6) { showProfileToast('New password must be at least 6 characters.', 'error'); return; }
            const confirmPw = prompt('Confirm your new password:');
            if (newPassword !== confirmPw) { showProfileToast('Passwords do not match.', 'error'); return; }
            try {
                const res  = await fetch(`${API_BASE}/users/change-password`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                    body:    JSON.stringify({ currentPassword, newPassword })
                });
                const data = await res.json();
                if (res.ok) showProfileToast('Password changed successfully! ✅');
                else showProfileToast(data.message || 'Failed to change password.', 'error');
            } catch(err) { showProfileToast('Server is offline.', 'error'); }
        });
    }

    // Logout
    const logoutRow = document.getElementById('logoutRow');
    if (logoutRow) {
        logoutRow.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out?')) {
                localStorage.clear();
                window.location.href = 'index.html';
            }
        });
    }
}

// ======================================================
// UTILITIES
// ======================================================
function showProfileToast(msg, type = 'success') {
    const toast    = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast) return;
    toastMsg.textContent = msg;
    const icon = toast.querySelector('svg');
    if (icon) icon.style.color = type === 'error' ? '#e0504a' : '#5ddf7a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ======================================================
// INIT
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadMyListings();
    loadMySales();
    loadMyPurchases();
    loadSavedItems();
    loadMyReviews();
    wireSettingsButtons();
});
