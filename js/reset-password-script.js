/* reset-password-script.js
   Handles: token detection, show/hide password on both fields,
   strength bar (4 segments, informational only), disabled button
   until 8+ chars AND passwords match, inline error on mismatch,
   loading state, success/expired state transitions.
*/

document.addEventListener('DOMContentLoaded', () => {
  // ─── Variable de Control Global Interna (Debounce) ────────────────────
  let confirmTimeout = null;

  // ─── Token from URL (?token=...) ──────────────────────────────────────
  const urlParams  = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token') || 'MOCK_DEVELOPMENT_TOKEN';

  // Simulate expired-link state for ?expired=true (dev/test use)
  if (urlParams.get('expired') === 'true') {
    showState('expired');
    return;
  }

  // ─── Elements ─────────────────────────────────────────────────────────
  const newPw        = document.getElementById('newPw');
  const confirmPw    = document.getElementById('confirmPw');
  const newBlock     = document.getElementById('newBlock');
  const confirmBlock = document.getElementById('confirmBlock');
  const submitBtn    = document.getElementById('submitBtn');
  const resetForm    = document.getElementById('resetForm');
  const passwordMatchErr = document.getElementById('passwordMatchErr');

  // Strength bar
  const segs          = [1,2,3,4].map(n => document.getElementById('seg' + n));
  const strengthLbl  = document.getElementById('strengthLabel');

  const LABELS  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const CLASSES = ['', 's1', 's2', 's3', 's4'];

  // ─── Show / hide password toggles ─────────────────────────────────────
  setupToggle('showNew',     'eyeNew',     newPw);
  setupToggle('showConfirm', 'eyeConfirm', confirmPw);

  function setupToggle(btnId, eyeId, input) {
    const btn = document.getElementById(btnId);
    const eye = document.getElementById(eyeId);
    if (!btn) return;
    [btn, eye].forEach(el => {
      el.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? 'Hide' : 'Show';
      if (eye) {
        eye.innerHTML = isHidden
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
        eye.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      }
    });
    })
  }

  // ─── Password strength calculation (4 conditions) ─────────────────────
  function getStrength(pw) {
    let score = 0;
    if (pw.length >= 8)       score++;
    if (/[A-Z]/.test(pw))    score++;
    if (/[0-9]/.test(pw))    score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0–4
  }

  function updateStrengthBar(pw) {
    const score = pw.length === 0 ? 0 : Math.max(1, getStrength(pw));
    segs.forEach((seg, i) => {
      seg.className = 'strength-seg';
      if (pw.length > 0 && i < score) seg.classList.add('active-' + score);
    });
    strengthLbl.textContent = pw.length > 0 ? LABELS[score] : '';
    strengthLbl.className   = 'strength-label' + (pw.length > 0 ? ' ' + CLASSES[score] : '');
  }

  // ─── Enable / disable submit button ───────────────────────────────────
  function updateSubmitState() {
    const pw      = newPw.value;
    const confirm = confirmPw.value;
    // Strength bar does NOT gate — only 8+ chars AND match required
    submitBtn.disabled = !(pw.length >= 8 && pw === confirm && confirm.length > 0);
  }

  // ─── New password input ───────────────────────────────────────────────
  newPw.addEventListener('input', () => {
    newPw.classList.remove('error');
    newBlock.classList.remove('invalid');
    updateStrengthBar(newPw.value);
    updateSubmitState();
  });

  // ─── Confirm password input (Refactorizado con Debounce de 3s) ───────
  confirmPw.addEventListener('input', () => {
    // Saneamiento inmediato del temporizador previo
    clearTimeout(confirmTimeout);

    // Restablecer estado visual por defecto
    confirmPw.classList.remove('error');
    confirmBlock.classList.remove('invalid');
    if (passwordMatchErr) {
      passwordMatchErr.style.display = 'none'; 
    }

    // Evaluación inmediata del estado del botón de submit
    updateSubmitState();

    // Lógica diferida por Debounce (2000ms)
    confirmTimeout = setTimeout(() => {
      const pw = newPw.value;
      const confirm = confirmPw.value;

      // Evalúa si no coinciden y si el campo no está vacío
      if (confirm && pw !== confirm) {
        confirmBlock.classList.add('invalid');
        confirmPw.classList.add('error');
        if (passwordMatchErr) {
          passwordMatchErr.style.display = 'block'; // O la clase de visibilidad requerida
        }
      }
    }, 2000);
  });

  // ─── Form submit ──────────────────────────────────────────────────────
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pw      = newPw.value;
      const confirm = confirmPw.value;
      let valid     = true;

      if (pw.length < 8) {
        newBlock.classList.add('invalid');
        newPw.classList.add('error');
        valid = false;
      }
      if (pw !== confirm || !confirm) {
        confirmBlock.classList.add('invalid');
        confirmPw.classList.add('error');
        valid = false;
      }
      if (!valid) return;

      // Loading state
      setLoading(true);

      try {
        // STUB: POST /api/auth/reset { token, new_password }
        await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, new_password: pw })
        });
      } catch (_) {
        // Expected in dev — no real API available yet.
      }

      // Always transition to success in frontend simulation.
      setLoading(false);
      showState('success');
    });
  }

  // ─── State switcher ───────────────────────────────────────────────────
  function showState(which) {
    document.getElementById('stateForm').style.display    = which === 'form'    ? 'block' : 'none';
    document.getElementById('stateSuccess').style.display = which === 'success' ? 'block' : 'none';
    document.getElementById('stateExpired').style.display = which === 'expired' ? 'block' : 'none';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  function setLoading(on) {
    if (on) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Saving…';
    } else {
      submitBtn.classList.remove('loading');
      submitBtn.innerHTML = 'Reset password';
      updateSubmitState();
    }
  }
});