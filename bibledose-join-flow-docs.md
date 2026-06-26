# BibleDose — Join Flow: Guía de uso e integración de API

---

## SECCIÓN 1 — Cómo mostrar y navegar el flujo

### Archivos del proyecto

```
BibleDoseApp/
├── modal-flow.html          ← Página de producción (referencia archivos externos)
├── modal-flow-preview.html  ← Archivo único para previsualizar sin servidor
├── modal-flow-style.css     ← Todos los estilos del sistema
├── modal-flow-script.js     ← Motor del flujo (modales, lógica, API)
└── modal-flow-dev.js        ← Panel de testing (solo desarrollo, retirar en producción)
```

---

### Cómo abrir el preview

1. Descarga los 5 archivos y colócalos en la misma carpeta.
2. Abre `modal-flow-preview.html` directamente en el navegador (doble clic o arrastrar a Chrome/Firefox/Edge). No necesita servidor.
3. Verás la pantalla de fondo de la app con el texto de instrucción.

---

### El panel DEV

En el borde izquierdo de la pantalla hay una pestaña naranja vertical con la etiqueta **DEV**. Siempre es visible.

- **Hover** sobre ella (o clic) para expandir el panel.
- El panel se organiza en cuatro bloques:

| Bloque | Qué contiene |
|---|---|
| **Estado de prueba** | Toggle Miembro / No miembro y campo de nombre para el usuario de cookie |
| **Escenarios — Cookie** | C1, C2, C3 — flujos con cookie de sesión detectada |
| **Escenarios — Sesión viva** | S1 a S4 — usuario llega cuando el grupo está en directo |
| **Escenarios — Sin sesión** | S5 a S10 — usuario llega cuando no hay sesión activa |
| **Modals individuales** | M00a, M00b, M01–M12 — abrir cualquier modal directamente |

Cada botón del panel muestra un badge de color que indica el tipo de contenedor del modal resultante: **naranja** (sesión en vivo), **teal** (confirmación), **neutral** (sin sesión).

Una notificación toast en la esquina superior derecha confirma cada acción y los redirects simulados.

---

### Cómo recorrer cada escenario

#### Escenarios Cookie (C1–C3)

**C1 — Cookie + sesión viva**
Clic en *C1* en el panel → aparece M00a con "Welcome back, [nombre]" y el badge Live. Clic en **Join session** → avanza a M06 (teal, auto-cierra hacia la sesión).

**C2 — Cookie + sin sesión**
Clic en *C2* → aparece M00b neutral con "Nothing live right now". Clic en **Go to dashboard** → toast confirma redirect a `/dashboard`.

**C3 — Cookie + "Not you?"**
Clic en *C3* → aparece M00a (o M00b). Clic en el enlace pequeño **Not you?** → la cookie se borra y el flujo retrocede a M01 (si hay sesión viva) o M07 (si no la hay).

---

#### Escenarios Sesión Viva (S1–S4)

Todos comienzan desde M01 (contenedor naranja, badge Live).

**S1 — Usuario y miembro**
Panel: toggle en *Miembro* → clic *S1* → M01. Clic **Sign in →** → el sistema verifica membresía → M04 (teal "Welcome back", avanza automáticamente a la sesión en ~2.8 s).

**S2 — Usuario pero no miembro → se registra**
Panel: toggle en *No miembro* → clic *S2* → M01. Clic **Sign in →** → el sistema detecta que no es miembro → M02 "You're not in this group". Clic **Register for this group** → M05 (teal "You're all set", avanza a sesión).

**S3 — Usuario, no miembro → entra como invitado**
Panel: toggle en *No miembro* → clic *S3* → M01. Clic **Sign in →** → M02. Clic **Join as guest** → M03 (formulario de invitado). Completar los 4 campos (validación en tiempo real). Clic **Join session** → M06 (teal "Welcome", avanza a sesión).

**S4 — Sin cuenta → entra como invitado directo**
Clic *S4* → M01. Clic **Join as guest** (enlace pequeño inferior) → M03. Completar formulario → M06.

---

#### Escenarios Sin Sesión (S5–S10)

Todos comienzan desde M07 (contenedor neutral).

**S5 — Usuario y miembro**
Toggle en *Miembro* → clic *S5* → M07. Clic **Sign in →** → sistema verifica membresía → M08 "Nothing live right now". Clic **Go to dashboard** → redirect a `/dashboard`.

**S6 — Usuario, no miembro → se registra**
Toggle en *No miembro* → clic *S6* → M07. Clic **Sign in →** → sistema detecta no es miembro → M09 "Register for this group". Clic **Register for this group** → M12 (teal "You're now a member"). Clic **Go to dashboard** → redirect.

**S7 — Usuario, no miembro → Maybe later**
Toggle en *No miembro* → clic *S7* → M07. **Sign in →** → M09. Clic **Maybe later** → M10 "Nothing live right now". Clic **Go to dashboard** → redirect.

**S8 — Nuevo usuario → crea cuenta → se registra**
Clic *S8* → M07. Clic **Create an account →** → el sistema simula el flujo de creación de cuenta y regresa a M09 (en producción este paso es una página separada). M09 → **Register for this group** → M12 → dashboard.

**S9 — Nuevo usuario → crea cuenta → Maybe later**
Igual que S8 hasta M09, luego clic **Maybe later** → M10 → dashboard.

**S10 — Usuario anónimo, no quiere cuenta**
Clic *S10* → M07. Clic **Maybe later** (enlace inferior) → M11 "Nothing live right now / Sign in or create an account". Clic **Return to Bible Dose** → redirect a `/login`.

---

### Formulario de invitado M03 — reglas de validación

| Campo | Regla |
|---|---|
| First name | Obligatorio. Primera letra de cada palabra en mayúscula automáticamente al escribir. |
| Last name | Igual que First name. |
| Email address | Formato válido (debe contener `@` y dominio con punto). Validado en `input` y en `blur`. |
| Confirm email | Debe coincidir exactamente con Email address Y pasar validación de formato por sí solo. |

El botón **Join session** permanece desactivado (gris) hasta que los cuatro campos son válidos. Al activarse cambia a naranja.

Los campos de email no tienen auto-capitalización para no romper el formato.

---

### Pantallas teal — auto-advance

M04, M05 y M06 son pantallas de transición que se cierran solas. Muestran la animación de puntos pulsantes y avanzan a la sesión tras **2800 ms**. No requieren acción del usuario. Este delay está configurado en `modal-flow-script.js`:

```js
const AUTO_ADV_MS = 2800; // línea 20 — cambiar si se necesita más o menos tiempo
```

---

### Retirar el panel DEV en producción

El archivo `modal-flow-dev.js` activa el modo mock (`window.__BD_DEV_MODE__ = true`) y construye el panel visual. Para producción, simplemente **no incluyas ese archivo** en el HTML:

```html
<!-- PRODUCCIÓN: solo estos dos -->
<script src="./modal-flow-style.css"></script>  ← en el <head>
<script src="./modal-flow-script.js"></script>

<!-- QUITAR en producción: -->
<!-- <script src="./modal-flow-dev.js"></script> -->
```

Sin `modal-flow-dev.js`, `window.__BD_DEV_MODE__` es `undefined` (falsy) y el motor de flujo apunta directamente al backend real.

---

---

## SECCIÓN 2 — Integración con la API (Node/Express)

### Resumen de la arquitectura

El frontend (modal-flow-script.js) hace llamadas REST con `fetch()` y `credentials: 'include'` para que las cookies de sesión viajen en cada petición. El backend (Node/Express) valida, responde con JSON y establece las cookies de autenticación a nivel servidor cuando corresponde.

El frontend **nunca maneja autenticación directamente** — solo lee y escribe una cookie ligera `bd_session` para personalizar la pantalla de bienvenida (nombre del usuario). La autenticación real vive en el backend.

---

### Configuración del endpoint base

En `modal-flow-script.js`, línea 18:

```js
const API_BASE = '/api';
```

Cambiar a la URL completa si el frontend y el backend están en dominios distintos:

```js
const API_BASE = 'https://api.bibledose.com'; // producción cross-origin
```

Si hay CORS, el backend debe responder con los headers adecuados (ver más abajo).

---

### Endpoints requeridos

#### 1. POST `/api/auth/signin`

Llamado cuando el usuario hace clic en "Sign in →" desde M01 o M07. En producción este endpoint es el que recibe el resultado de tu flujo de login (redirect, modal, o popup de autenticación). El frontend envía el groupId para que el backend pueda verificar membresía en el mismo paso.

**Request:**
```json
{
  "groupId": "g001"
}
```

**Response exitosa:**
```json
{
  "success": true,
  "user": {
    "id": "u-abc123",
    "name": "Jordan Smith"
  },
  "isMember": true
}
```

**Response fallida:**
```json
{
  "success": false,
  "error": "invalid_credentials"
}
```

**Lógica del frontend según la respuesta:**

| Contexto | `isMember: true` | `isMember: false` |
|---|---|---|
| Sesión viva (M01) | → M04 (auto-avanza a sesión) | → M02 (not in group) |
| Sin sesión (M07) | → M08 (nothing live) | → M09 (register) |

**Implementación Express de referencia:**
```js
// routes/auth.js
router.post('/signin', async (req, res) => {
  const { groupId } = req.body;

  // Tu lógica de autenticación aquí
  // El usuario ya debería tener una sesión activa si llegó aquí
  // desde un flujo de login separado
  const userId = req.session?.userId;
  if (!userId) {
    return res.json({ success: false, error: 'not_authenticated' });
  }

  const user = await User.findById(userId);
  const isMember = await GroupMember.exists({ groupId, userId });

  res.json({
    success: true,
    user: { id: user.id, name: user.fullName },
    isMember: Boolean(isMember),
  });
});
```

---

#### 2. POST `/api/groups/:groupId/register`

Llamado desde dos puntos distintos del flujo:
- **M02** (sesión viva, no miembro hace clic en "Register for this group") → `context: 'live'`
- **M09** (sin sesión, no miembro hace clic en "Register for this group") → `context: 'nolive'`

**Request:**
```json
{
  "context": "live"
}
```

**Response exitosa:**
```json
{
  "success": true
}
```

**Response fallida:**
```json
{
  "success": false,
  "error": "already_member"
}
```

**Lógica del frontend según el contexto:**

| `context` | Respuesta exitosa |
|---|---|
| `"live"` | → M05 (teal "You're all set", auto-avanza a sesión) |
| `"nolive"` | → M12 (teal "You're now a member") |

**Implementación Express de referencia:**
```js
// routes/groups.js
router.post('/:groupId/register', async (req, res) => {
  const { groupId } = req.params;
  const { context } = req.body;
  const userId = req.session?.userId;

  if (!userId) {
    return res.json({ success: false, error: 'not_authenticated' });
  }

  const alreadyMember = await GroupMember.exists({ groupId, userId });
  if (alreadyMember) {
    return res.json({ success: false, error: 'already_member' });
  }

  await GroupMember.create({ groupId, userId, joinedAt: new Date(), context });

  res.json({ success: true });
});
```

---

#### 3. POST `/api/guest/join`

Llamado desde M03 cuando un invitado completa y envía el formulario.

**Request:**
```json
{
  "groupId": "g001",
  "firstName": "Jordan",
  "lastName": "Smith",
  "email": "jordan@email.com"
}
```

**Response exitosa:**
```json
{
  "success": true,
  "sessionToken": "eyJhbGci..."
}
```

**Response fallida:**
```json
{
  "success": false,
  "error": "invalid_email"
}
```

Tras respuesta exitosa el frontend muestra M06 (teal "Welcome", auto-avanza a sesión). El `sessionToken` puede usarse para autenticar al invitado en la sala de sesión sin que tenga cuenta.

**Implementación Express de referencia:**
```js
// routes/guest.js
router.post('/join', async (req, res) => {
  const { groupId, firstName, lastName, email } = req.body;

  // Validación backend (el frontend ya valida, pero el backend es autoritativo)
  if (!firstName || !lastName || !email || !email.includes('@')) {
    return res.json({ success: false, error: 'invalid_fields' });
  }

  const guest = await GuestSession.create({
    groupId,
    firstName,
    lastName,
    email,
    joinedAt: new Date(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 horas
  });

  // Generar token temporal para la sesión de invitado
  const sessionToken = jwt.sign(
    { guestId: guest.id, groupId, role: 'guest' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ success: true, sessionToken });
});
```

---

### Cookie `bd_session`

El frontend escribe y lee una cookie llamada `bd_session` en el navegador del usuario. Esta cookie es **solo de presentación** — guarda el nombre del usuario para mostrar "Welcome back, Jordan" en M00a/M00b sin hacer una llamada adicional al servidor.

```
Nombre:   bd_session
Valor:    JSON URL-encoded { "name": "Jordan Smith", "userId": "u-abc123" }
Max-Age:  2592000 (30 días)
Path:     /
SameSite: Lax
```

La cookie la escribe el frontend inmediatamente después de que el backend confirma un sign-in exitoso. El backend **no necesita leerla** — tiene sus propias cookies/tokens de sesión para autenticación real.

Cuando el usuario hace clic en **"Not you?"**, el frontend borra esta cookie con `Max-Age=0` y redirige al flujo de entrada estándar. El usuario **no se desloguea** de su cuenta — solo se limpia la personalización del dispositivo.

---

### CORS — configuración si frontend y backend son dominios distintos

```js
// app.js (Express)
const cors = require('cors');

app.use(cors({
  origin: 'https://bibledose.com', // origen exacto del frontend
  credentials: true,               // imprescindible para que las cookies viajen
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
```

Sin `credentials: true` en el backend y `credentials: 'include'` en el fetch del frontend, las cookies de sesión no se envían en las peticiones cross-origin y el backend no puede identificar al usuario.

---

### Manejo de errores — qué hacer cuando el backend falla

Actualmente el frontend hace `console.error` y no avanza el modal si una llamada falla. Para producción se recomienda mostrar un mensaje de error dentro del modal activo. Puedes hacerlo añadiendo esta función en `modal-flow-script.js` y llamándola desde cada bloque `catch`:

```js
function showError(message) {
  const shell = document.getElementById('bd-modal-shell');
  if (!shell) return;
  let errBanner = shell.querySelector('.bd-api-error');
  if (!errBanner) {
    errBanner = document.createElement('p');
    errBanner.className = 'bd-api-error';
    errBanner.style.cssText =
      'font-size:12px;color:var(--red);margin-top:10px;text-align:center;';
    shell.querySelector('.bd-actions')?.before(errBanner);
  }
  errBanner.textContent = message;
}

// Uso en catch:
} catch (err) {
  showError('Something went wrong. Please try again.');
}
```

---

### Resumen de flujo de datos — de clic a modal

```
Usuario hace clic en el grupo link
          │
          ▼
  BibleDoseFlow.trigger({ groupId, groupName, isLive })
          │
          ├─ Lee cookie bd_session
          │     ├─ cookie encontrada + sesión viva  → M00a
          │     ├─ cookie encontrada + sin sesión   → M00b
          │     ├─ sin cookie  + sesión viva        → M01
          │     └─ sin cookie  + sin sesión         → M07
          │
          ▼ (el usuario interactúa)
          │
          ├─ "Sign in →"      → POST /api/auth/signin
          │                         { groupId }
          │                         ↳ { success, user, isMember }
          │
          ├─ "Register"       → POST /api/groups/:groupId/register
          │                         { context: 'live' | 'nolive' }
          │                         ↳ { success }
          │
          └─ "Join session"   → POST /api/guest/join
             (M03 form)           { groupId, firstName, lastName, email }
                                   ↳ { success, sessionToken }
```

---

### Tabla de rutas de navegación final

| Acción | Destino |
|---|---|
| Join session (M04, M05, M06 auto-avance) | `/session/:groupId` |
| Go to dashboard (M00b, M08, M10, M12) | `/dashboard` |
| Return to Bible Dose (M11) | `/login` |
| Create an account (M01, M07) | `/create-account?returnGroup=:groupId` |

La página de creación de cuenta debe redirigir de vuelta al link del grupo tras completar el registro, para que el flujo retome desde M09. La URL de retorno ya va codificada en el parámetro `returnGroup`.

---

*Documento generado para el Proyecto 6 — Join Flow Modals — BibleDose.*
