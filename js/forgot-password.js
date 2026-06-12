document.getElementById('forgotForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('email');
  const emailValue = emailInput.value.trim();
  
  if (!emailValue) return;
  try {
    // Llamada al backend, no a SMTP2Go directamente por cuestiones de seguridad
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: emailValue })
    });

    // Manejo de respuesta neutral para evitar enumeración de cuentas
    // Siempre redirigimos a la pantalla de "Check your email" pase lo que pase
   

  } catch (error) {
    // Opcional: Podrías mostrar un mensaje de "Offline" aquí, 
    // aunque redirigir sigue siendo la opción más segura contra enumeración.
    console.error("Network error:", error);
  }
   window.location.href = 'forgot-password-sent.html';
});