/* login-script.js
   Handles: disabled button logic, email blur validation, show/hide password,
   loading state on submit, inline error display, success banner from ?reset=success.
*/

document.addEventListener('DOMContentLoaded', () => {
  // ─── Mock credentials (frontend simulation only) ────────────────────────
  const MOCK_USER = { email: 'test@bibledose.com', password: 'Password123' };
  let failedAttempts = 0;

  // ─── Elements ───────────────────────────────────────────────────────────
  const emailInput    = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const signInBtn     = document.getElementById('signInBtn');
  const emailBlock    = document.getElementById('emailBlock');
  const loginForm     = document.getElementById('loginForm');
  const attemptsNote  = document.getElementById('attemptsNote');
  const eyeBtn        = document.getElementById('eyePassword');
  const eyeIcon       = document.getElementById('eyePasswordIcon');

  // ─── Success banner from ?reset=success ─────────────────────────────────
  const qs = new URLSearchParams(location.search);
  if (qs.get('reset') === 'success') {
    const banner = document.getElementById('successBanner');
    if (banner) banner.classList.add('show');
  }

  // ─── Show / hide password toggle ────────────────────────────────────────
  if (eyeBtn) {
    eyeBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      // Toggle eye icon: show line-through when revealed
      eyeIcon.innerHTML = isPassword
        ? '<path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22"/>';
      eyeBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // ─── Email format validation (@ + .domain) ──────────────────────────────
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  // Blur: show format error if invalid
  emailInput.addEventListener('blur', () => {
    const val = emailInput.value.trim();
    if (val && !isValidEmail(val)) {
      emailBlock.classList.add('invalid');
      const errEl = emailBlock.querySelector('.err-msg');
      if (errEl) errEl.textContent = 'Please enter a valid email address.';
    }
  });

  // ─── Enable / disable submit button ─────────────────────────────────────
  function updateButtonState() {
    const emailReady    = isValidEmail(emailInput.value);
    const passwordReady = passwordInput.value.length > 0;
    signInBtn.disabled  = !(emailReady && passwordReady);
  }

  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('error');
    emailBlock.classList.remove('invalid');
    updateButtonState();
  });
  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('error');
    document.getElementById('passwordBlock').classList.remove('invalid');
    updateButtonState();
  });

  // ─── Form submit ─────────────────────────────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailVal    = emailInput.value.trim();
      const passwordVal = passwordInput.value;

      // Loading state
      setLoading(true);

      // Simulate POST /api/auth/login (replace with real fetch in production)
      await fakeDelay(900);

      if (emailVal === MOCK_USER.email && passwordVal === MOCK_USER.password) {
        // Success → navigate to dashboard
        window.location.href = 'dashboard.html';
      } else {
        setLoading(false);
        failedAttempts++;
        triggerLoginError();
      }
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function setLoading(on) {
    if (on) {
      signInBtn.disabled = true;
      signInBtn.classList.add('loading');
      signInBtn.innerHTML = '<span class="btn-spinner"></span> Signing in…';
    } else {
      signInBtn.classList.remove('loading');
      signInBtn.innerHTML = 'Sign in';
      updateButtonState();
    }
  }

  function triggerLoginError() {
    emailBlock.classList.add('invalid');
    document.getElementById('passwordBlock').classList.add('invalid');
    emailInput.classList.add('error');
    passwordInput.classList.add('error');

    const errEl = emailBlock.querySelector('.err-msg');
    if (errEl) errEl.textContent = 'Incorrect email or password.';

    if (failedAttempts >= 3 && attemptsNote) {
      attemptsNote.classList.add('show');
    }
  }

  function fakeDelay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // Initial state
  updateButtonState();
});
