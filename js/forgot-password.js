/* forgot-password.js
   Handles: email blur validation, disabled button until valid, loading state,
   inline confirmation state on submit, "Try a different email" reset.
*/

document.addEventListener('DOMContentLoaded', () => {
  const emailInput       = document.getElementById('email');
  const emailBlock       = document.getElementById('emailBlock');
  const sendBtn          = document.getElementById('sendBtn');
  const forgotForm       = document.getElementById('forgotForm');
  const formState        = document.getElementById('formState');
  const confirmState     = document.getElementById('confirmState');
  const tryDifferentBtn  = document.getElementById('tryDifferentEmail');

  // ─── Email validation helper ─────────────────────────────────────────────
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  // ─── Blur: show format error if invalid ──────────────────────────────────
  emailInput.addEventListener('blur', () => {
    const val = emailInput.value.trim();
    if (val && !isValidEmail(val)) {
      emailBlock.classList.add('invalid');
    }
  });

  // ─── Enable / disable submit ──────────────────────────────────────────────
  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('error');
    emailBlock.classList.remove('invalid');
    sendBtn.disabled = !isValidEmail(emailInput.value);
  });

  // ─── Submit ───────────────────────────────────────────────────────────────
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailVal = emailInput.value.trim();
      if (!isValidEmail(emailVal)) {
        emailBlock.classList.add('invalid');
        return;
      }

      // Loading state
      setLoading(true);

      try {
        // POST /api/auth/forgot-password — fire and forget; response handled server-side.
        // ALWAYS show confirmation state regardless of outcome (enumeration-safe).
        await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVal })
        });
      } catch (_) {
        // Network error — still show confirmation (privacy). Log if needed.
      }

      // Show inline confirmation — never redirects to a separate page.
      setLoading(false);
      showConfirmation();
    });
  }

  // ─── "Try a different email" ──────────────────────────────────────────────
  if (tryDifferentBtn) {
    tryDifferentBtn.addEventListener('click', resetForm);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function setLoading(on) {
    if (on) {
      sendBtn.disabled = true;
      sendBtn.classList.add('loading');
      sendBtn.innerHTML = '<span class="btn-spinner"></span> Sending…';
    } else {
      sendBtn.classList.remove('loading');
      sendBtn.innerHTML = 'Send reset link';
    }
  }

  function showConfirmation() {
    formState.style.display = 'none';
    confirmState.classList.add('show');
  }

  function resetForm() {
    confirmState.classList.remove('show');
    formState.style.display = '';
    emailInput.value = '';
    emailBlock.classList.remove('invalid');
    emailInput.classList.remove('error');
    sendBtn.disabled = true;
    emailInput.focus();
  }
});
