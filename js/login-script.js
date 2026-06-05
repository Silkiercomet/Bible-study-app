document.addEventListener('DOMContentLoaded', () => {
  // 1. Configuración de credenciales de prueba para tu simulación frontend
  const MOCK_USER = {
    email: "test@bibledose.com",
    password: "Password123"
  };

  // Contador local para manejar la advertencia de intentos repetidos
  let failedAttempts = 0;

  // 2. Procesar parámetros de URL de éxito previos (Mantenido de tu plantilla)
  const qs = new URLSearchParams(location.search);
  if (qs.get('reset') === 'success') {
    const banner = document.getElementById('successBanner');
    if (banner) banner.classList.add('show');
    clearAllErrors();
  }

  // 3. Capturar el evento de envío del formulario
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault(); // Evitamos que la página se recargue automáticamente

      // Obtener los valores actuales de los inputs de texto
      const emailValue = document.getElementById('email').value.trim();
      const passwordValue = document.getElementById('password').value;

      // --- SIMULACIÓN DE POST REQUEST ---
      console.log("POST /api/auth/login", { email: emailValue });

      // Validación de credenciales
      if (emailValue === MOCK_USER.email && passwordValue === MOCK_USER.password) {
        // CASO DE ÉXITO: Redirigir al dashboard según el requerimiento
        console.log("Login exitoso. Redirigiendo...");
        window.location.href = "dashboard.html"; 
      } else {
        // CASO DE ERROR: Credenciales incorrectas
        failedAttempts++;
        triggerLoginError();
      }
    });
  }

  // 4. Función para activar los estados visuales de error requeridos
  function triggerLoginError() {
    // Aplicar clase .invalid a los contenedores de los bloques
    document.getElementById('emailBlock').classList.add('invalid');
    document.getElementById('passwordBlock').classList.add('invalid');

    // Aplicar clase .error directamente a los inputs de texto (Bordes rojos inline)
    document.getElementById('email').classList.add('error');
    document.getElementById('password').classList.add('error');

    // Mostrar advertencia sutil de intentos si supera o iguala el umbral de 3 fallos
    if (failedAttempts >= 3) {
      document.getElementById('attemptsNote').classList.add('show');
    }
  }

  // 5. Limpieza automática de errores en tiempo real cuando el usuario escribe
  ['email', 'password'].forEach(function (id) {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function () {
        // Remover el borde rojo del campo actual
        input.classList.remove('error');
        
        // Remover el mensaje de error del bloque contenedor correspondiente
        const block = input.closest('.field-block');
        if (block) block.classList.remove('invalid');
      });
    }
  });

  // Función auxiliar global para limpiar la UI por completo
  function clearAllErrors() {
    document.querySelectorAll('.field-block').forEach(b => b.classList.remove('invalid'));
    document.querySelectorAll('.email-input').forEach(i => i.classList.remove('error'));
    const notes = document.getElementById('attemptsNote');
    if (notes) notes.classList.remove('show');
  }
});