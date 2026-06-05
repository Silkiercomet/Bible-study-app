document.addEventListener('DOMContentLoaded', () =>{
// Referencias de Secciones
    const step1 = document.getElementById('sectionStep1');
    const step2 = document.getElementById('sectionStep2');
    const step3 = document.getElementById('sectionStep3');

    // Referencias de Formularios e Inputs
    const formStep1 = document.getElementById('formStep1');
    const formStep2 = document.getElementById('formStep2');
    const phoneInput = document.getElementById('phoneInput');
    const codeInput = document.getElementById('codeInput');
    const codeBlock = document.getElementById('codeBlock');

    // MOCK: Variable de control simulada para el backend
    let mockPhoneInDatabase = "+15550000000"; 

    // --- MANEJO DEL PASO 1 (Envío de Teléfono) ---
    if (formStep1) {
      formStep1.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (phoneInput.value.trim() !== "") {
          // STUB: Aquí en producción se haría un POST a Classic ASP para validar
          // mediante el backend y disparar la API de SMS si existe match.
          console.log("POST /api/auth/recover-request", { phone: phoneInput.value });
          
          // Avanza SIEMPRE de forma neutral para evitar enumeración.
          step1.classList.remove('active');
          step2.classList.add('active');
          codeInput.focus();
        }
      });
    }

    // --- MANEJO DEL PASO 2 (Validación de SMS) ---
    if (formStep2) {
      formStep2.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const codeValue = codeInput.value.trim();

        // Simulación: El código correcto "hardcoded" para pruebas es 123456
        if (codeValue === "123456") {
          console.log("POST /api/auth/verify-sms", { code: codeValue });
          
          // Éxito: Avanza al paso 3 donde se revela el correo enmascarado
          step2.classList.remove('active');
          step3.classList.add('active');
        } else {
          // Estado de Error: Alerta roja inline unificada (Incorrect or expired code)
          codeInput.classList.add('error');
          codeBlock.classList.add('invalid');
        }
      });
    }

    // Limpieza interactiva del estado de error mientras el usuario digita
    codeInput.addEventListener('input', function() {
      codeInput.classList.remove('error');
      codeBlock.classList.remove('invalid');
    });

});