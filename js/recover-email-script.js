/* recover-email-script.js
   Handles: phone auto-format (000-000-0000), disabled btn until 10 digits,
   loading state, neutral step transition, SMS code verify, "Try a different
   number" reset, inline error on wrong code.
*/

document.addEventListener('DOMContentLoaded', () => {
  // ─── Elements ─────────────────────────────────────────────────────────
  const sectionStep1     = document.getElementById('sectionStep1');
  const sectionStep2     = document.getElementById('sectionStep2');
  const sectionStep3     = document.getElementById('sectionStep3');

  const formStep1        = document.getElementById('formStep1');
  const formStep2        = document.getElementById('formStep2');
  const phoneInput       = document.getElementById('phoneInput');
  const sendCodeBtn      = document.getElementById('sendCodeBtn');
  const codeInput        = document.getElementById('codeInput');
  const codeBlock        = document.getElementById('codeBlock');
  const verifyCodeBtn    = document.getElementById('verifyCodeBtn');
  const tryDifferentBtn  = document.getElementById('tryDifferentNumber');

  // ─── Phone auto-format: digits → 000-000-0000 ─────────────────────────
  phoneInput.addEventListener('input', () => {
    const digits = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    } else if (digits.length > 3) {
      formatted = digits.slice(0, 3) + '-' + digits.slice(3);
    }
    phoneInput.value = formatted;
    // Enable submit only when exactly 10 digits entered
    sendCodeBtn.disabled = digits.length !== 10;
  });

  // ─── Step 1 submit ────────────────────────────────────────────────────
  if (formStep1) {
    formStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sendCodeBtn.disabled) return;

      setLoading(sendCodeBtn, 'Sending code…');

      try {
        // STUB: POST /api/auth/recover-request { phone }
        // ALWAYS advance to step 2 (enumeration-safe — never confirm phone exists).
        await fetch('/api/auth/recover-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneInput.value })
        });
      } catch (_) { /* advance regardless */ }

      resetLoading(sendCodeBtn, 'Send verification code');

      // Advance to code entry step
      sectionStep1.classList.remove('active');
      sectionStep2.classList.add('active');
      codeInput.focus();
    });
  }

  // ─── SMS code input: enable verify when 6 digits ──────────────────────
  codeInput.addEventListener('input', () => {
    // Only allow digits
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    codeInput.classList.remove('error');
    codeBlock.classList.remove('invalid');
    verifyCodeBtn.disabled = codeInput.value.length !== 6;
  });

  // ─── Step 2 submit ────────────────────────────────────────────────────
  if (formStep2) {
    formStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (verifyCodeBtn.disabled) return;

      setLoading(verifyCodeBtn, 'Verifying…');

      try {
        // STUB: POST /api/auth/verify-sms { code }
        // Simulation: hardcoded correct code = 123456
        await fakeDelay(700);
        const codeVal = codeInput.value.trim();

        if (codeVal === '123456') {
          // Success → step 3
          resetLoading(verifyCodeBtn, 'Verify code');
          sectionStep2.classList.remove('active');
          sectionStep3.classList.add('active');
        } else {
          // Inline error
          resetLoading(verifyCodeBtn, 'Verify code');
          codeInput.classList.add('error');
          codeBlock.classList.add('invalid');
        }
      } catch (_) {
        resetLoading(verifyCodeBtn, 'Verify code');
        codeInput.classList.add('error');
        codeBlock.classList.add('invalid');
      }
    });
  }

  // ─── "Try a different number" ─────────────────────────────────────────
  if (tryDifferentBtn) {
    tryDifferentBtn.addEventListener('click', () => {
      // Reset both steps
      sectionStep2.classList.remove('active');
      phoneInput.value   = '';
      codeInput.value    = '';
      codeInput.classList.remove('error');
      codeBlock.classList.remove('invalid');
      sendCodeBtn.disabled  = true;
      verifyCodeBtn.disabled = true;
      sectionStep1.classList.add('active');
      phoneInput.focus();
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  function setLoading(btn, label) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<span class="btn-spinner"></span> ${label}`;
  }

  function resetLoading(btn, label) {
    btn.classList.remove('loading');
    btn.innerHTML = label;
    // Re-evaluate disabled state
    if (btn === sendCodeBtn) {
      const digits = phoneInput.value.replace(/\D/g, '');
      btn.disabled = digits.length !== 10;
    } else {
      btn.disabled = codeInput.value.length !== 6;
    }
  }

  function fakeDelay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
});
