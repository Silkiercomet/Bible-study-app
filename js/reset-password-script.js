document.addEventListener('DOMContentLoaded', () => {
    // 1. Emulación de Captura de Token de URL (?token=xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token') || "MOCK_DEVELOPMENT_TOKEN";
    console.log("Token detectado para validación de backend:", resetToken);

    const newPw = document.getElementById('newPw');
    const confirmPw = document.getElementById('confirmPw');
    const newBlock = document.getElementById('newBlock');
    const confirmBlock = document.getElementById('confirmBlock');
    const ruleLen = document.getElementById('ruleLen');
    const resetForm = document.getElementById('resetForm');

    // 2. Control de visibilidad "Show/Hide" (Refactorizado limpio)
    ['showNew', 'showConfirm'].forEach(function(btnId) {
      const btn = document.getElementById(btnId);
      const input = (btnId === 'showNew') ? newPw : confirmPw;
      if (btn && input) {
        btn.addEventListener('click', function() {
          const isText = input.type === 'text';
          input.type = isText ? 'password' : 'text';
          btn.textContent = isText ? 'Show' : 'Hide';
        });
      }
    });

    // 3. Regla en tiempo real para longitud mínima
    newPw.addEventListener('input', function() {
      if (newPw.value.length >= 8) {
        ruleLen.textContent = '✓ 8+ characters';
        ruleLen.classList.add('ok');
      } else {
        ruleLen.textContent = '○ 8+ characters';
        ruleLen.classList.remove('ok');
      }
      newPw.classList.remove('error');
      newBlock.classList.remove('invalid');
    });

    // 4. Limpieza interactiva cuando el usuario intenta corregir la coincidencia
    confirmPw.addEventListener('input', function() {
      confirmPw.classList.remove('error');
      confirmBlock.classList.remove('invalid');
    });

    // 5. Manejo del envío del formulario (Captura evento Submit)
    if (resetForm) {
      resetForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Detiene recarga
        
        let isValid = true;
        const passwordValue = newPw.value;
        const confirmValue = confirmPw.value;

        // Validación de Longitud (Mantenida de la plantilla base)
        if (passwordValue.length < 8) {
          newPw.classList.add('error');
          newBlock.classList.add('invalid');
          isValid = false;
        }

        // Validación Crítica del Scope: Coincidencia de Contraseñas (Mismatch)
        if (confirmValue !== passwordValue || !confirmValue) {
          confirmPw.classList.add('error');
          confirmBlock.classList.add('invalid');
          isValid = false;
        }

        if (isValid) {
          // --- SIMULACIÓN DE POST REQUEST ---
          console.log("POST /api/auth/reset", { token: resetToken, new_password: passwordValue });
          
          // Redirección exitosa con parámetro esperado por login.html
          window.location.href = 'login.html?reset=success';
        }
      });
    }
})