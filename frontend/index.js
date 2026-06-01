// ======================================================
// AUTH GUARD — redirect to dashboard if already logged in
// Runs before anything renders to avoid flash of login page
// ======================================================
(function () {
  const token = localStorage.getItem('userToken');
  if (token) {
    window.location.replace('dashboard.html');
  }
})();

// ======================================================
// ENYUKADO - index.js
// Login and Signup wired to backend API
// ======================================================

const API_URL       = 'http://localhost:5000/api/users';
const ALLOWED_DOMAIN = '@students.national-u.edu.ph';

// ======================================================
// INTRO SEQUENCE
// ======================================================
window.addEventListener('load', () => {
  const overlay     = document.querySelector('.intro-overlay');
  const brand       = document.querySelector('.intro-brand');
  const tagline     = document.querySelector('.intro-tagline');
  const pageWrapper = document.querySelector('.page-wrapper');

  if (!overlay || !brand) return;

  overlay.style.display = 'flex';
  overlay.classList.remove('fade-out');
  pageWrapper?.classList.remove('slide-in');
  brand.classList.remove('brand-in', 'brand-out');
  tagline?.classList.remove('tagline-in', 'tagline-out');

  setTimeout(() => brand.classList.add('brand-in'), 500);
  setTimeout(() => { if (tagline) tagline.classList.add('tagline-in'); }, 1600);
  setTimeout(() => {
    brand.classList.add('brand-out');
    if (tagline) tagline.classList.add('tagline-out');
  }, 3000);
  setTimeout(() => {
    overlay.classList.add('fade-out');
    pageWrapper?.classList.add('slide-in');
  }, 3500);
  setTimeout(() => { overlay.style.display = 'none'; }, 5200);
});

// ======================================================
// MAIN LOGIC
// ======================================================
document.addEventListener('DOMContentLoaded', () => {

  // ---------- CARD TOGGLE ----------
  const loginCard  = document.getElementById('loginCard');
  const signupCard = document.getElementById('signupCard');
  const showSignup = document.getElementById('showSignup');
  const showLogin  = document.getElementById('showLogin');

  if (showSignup) {
    showSignup.addEventListener('click', (e) => {
      e.preventDefault();
      loginCard.classList.add('hidden-card');
      signupCard.classList.remove('hidden-card');
      // Clear pending notice when switching to signup
      document.getElementById('pendingNotice')?.classList.remove('show');
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      signupCard.classList.add('hidden-card');
      loginCard.classList.remove('hidden-card');
    });
  }

  // ---------- PASSWORD TOGGLE ----------
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.innerHTML = input.type === 'text'
          ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
          : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
      }
    });
  });

  // ---------- FORGOT PASSWORD ----------
  const forgotLink = document.querySelector('.forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Please contact contact.enyukado@gmail.com to reset your password.');
    });
  }

  // ======================================================
  // LOGIN
  // ======================================================
  const loginBtn = document.getElementById('submitLoginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email    = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      // Hide pending notice on new attempt
      document.getElementById('pendingNotice')?.classList.remove('show');

      if (!email)    return showError('loginEmail', 'Please enter your email');
      if (!password) return showError('loginPassword', 'Please enter your password');

      // Frontend domain check
      if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
        return showError('loginEmail', `Only ${ALLOWED_DOMAIN} emails are allowed`);
      }

      loginBtn.disabled = true;
      loginBtn.querySelector('span').textContent = 'Logging in...';

      try {
        const response = await fetch(`${API_URL}/login`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('userToken',    data.token);
          localStorage.setItem('userName',     data.user.firstName);
          localStorage.setItem('userLastName', data.user.lastName);
          localStorage.setItem('userEmail',    data.user.email);
          localStorage.setItem('userID',       data.user.id);

          showToast(`Welcome back, ${data.user.firstName}!`);
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        } else {
          // Show pending notice specifically for approval-pending accounts
          if (data.message && data.message.toLowerCase().includes('pending')) {
            document.getElementById('pendingNotice')?.classList.add('show');
          } else {
            showError('loginEmail', data.message || 'Login failed');
          }
          loginBtn.disabled = false;
          loginBtn.querySelector('span').textContent = 'Log in';
        }
      } catch (err) {
        showToast('Server is offline. Check your terminal!', 'error');
        loginBtn.disabled = false;
        loginBtn.querySelector('span').textContent = 'Log in';
      }
    });
  }

  // ======================================================
  // SIGNUP — Step 1: validate form, then show privacy modal
  // ======================================================

  // Store pending signup data here until user agrees to privacy policy
  let pendingSignupData = null;

  const signupBtn = document.getElementById('submitSignupBtn');
  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      const firstName = document.getElementById('signupFirst').value.trim();
      const lastName  = document.getElementById('signupLast').value.trim();
      const email     = document.getElementById('signupEmail').value.trim();
      const password  = document.getElementById('signupPassword').value;
      const confirmPw = document.getElementById('signupConfirm').value;

      // Validate all fields first
      if (!firstName) return showError('signupFirst',    'First name is required');
      if (!lastName)  return showError('signupLast',     'Last name is required');
      if (!email)     return showError('signupEmail',    'Email is required');

      // Domain validation
      if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
        return showError('signupEmail', `Only ${ALLOWED_DOMAIN} emails are allowed`);
      }

      if (!password || password.length < 6) return showError('signupPassword', 'Min 6 characters');
      if (password !== confirmPw)           return showError('signupConfirm',  'Passwords do not match');

      // All valid — store data and show privacy modal
      pendingSignupData = { firstName, lastName, email, password };
      openPrivacyModal();
    });
  }

  // ======================================================
  // PRIVACY MODAL
  // ======================================================
  const privacyModal     = document.getElementById('privacyModal');
  const privacyAgreeBtn  = document.getElementById('privacyAgreeBtn');
  const privacyCancelBtn = document.getElementById('privacyCancelBtn');

  function openPrivacyModal() {
    privacyModal?.classList.add('open');
  }

  function closePrivacyModal() {
    privacyModal?.classList.remove('open');
  }

  // Cancel — close modal, do nothing
  privacyCancelBtn?.addEventListener('click', () => {
    closePrivacyModal();
    pendingSignupData = null;
  });

  // Click outside modal to cancel
  privacyModal?.addEventListener('click', (e) => {
    if (e.target === privacyModal) {
      closePrivacyModal();
      pendingSignupData = null;
    }
  });

  // Agree — submit registration
  privacyAgreeBtn?.addEventListener('click', async () => {
    if (!pendingSignupData) return;

    privacyAgreeBtn.disabled = true;
    privacyAgreeBtn.textContent = 'Creating account...';

    try {
      const response = await fetch(`${API_URL}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(pendingSignupData)
      });

      const data = await response.json();

      if (response.ok) {
        closePrivacyModal();
        pendingSignupData = null;

        // Clear signup form
        ['signupFirst', 'signupLast', 'signupEmail', 'signupPassword', 'signupConfirm']
          .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

        // Switch to login and show pending notice
        signupCard.classList.add('hidden-card');
        loginCard.classList.remove('hidden-card');
        document.getElementById('pendingNotice')?.classList.add('show');
        showToast('Account submitted! Awaiting admin approval.');
      } else {
        closePrivacyModal();
        showError('signupEmail', data.message || 'Registration failed');
      }
    } catch (err) {
      closePrivacyModal();
      showToast('Server connection error', 'error');
    } finally {
      pendingSignupData = null;
      privacyAgreeBtn.disabled = false;
      privacyAgreeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        I Agree — Create My Account
      `;
    }
  });

}); // end DOMContentLoaded

// ======================================================
// UTILITIES
// ======================================================
function showError(fieldId, message) {
  showToast(message, 'error');
  const input = document.getElementById(fieldId);
  if (input) {
    input.style.borderColor = '#e0504a';
    input.style.animation   = 'shake 0.4s ease';
    setTimeout(() => {
      input.style.borderColor = '';
      input.style.animation   = '';
    }, 500);
  }
}

let toastTimeout;
function showToast(message, type = 'success') {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast) return;
  toastMsg.textContent = message;
  const icon = toast.querySelector('svg');
  if (icon) icon.style.color = type === 'error' ? '#e0504a' : '#5ddf7a';
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}
