# Bible Dose — Mapa de Integración Backend

Este documento detalla la estructura de datos y los endpoints que el backend debe proveer para el funcionamiento del Dashboard y las pantallas de configuración.

## 1. Autenticación y Recuperación

### A. Inicio de Sesión (`login.html`)
- **Endpoint:** `POST /api/auth/login`
- **Payload:** 
  ```json
  {
    "email": "String",
    "password": "String"
  }
  ```
- **Respuesta esperada:** Redirección a `dashboard.html` o éxito con credenciales de sesión (Cookie/Token).

### B. Recuperación de Cuenta (`recover-email.html`)
**Solicitar código de recuperación**
- **Endpoint:** `POST /api/auth/recover-request`
- **Payload:** `{ "phone": "String" }`

**Verificar código SMS**
- **Endpoint:** `POST /api/auth/verify-sms`
- **Payload:** `{ "code": "String" }`
- **Respuesta esperada:** El correo electrónico asociado (enmascarado o completo según lógica de negocio).

---

## 2. Carga Inicial (Dashboard Data)
El archivo `js/dashboard-script.js` espera que el servidor inyecte (o responda a una petición GET inicial) un objeto global llamado `data`.

### Objeto `data`
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `user` | `Object` | Contenedor de información del usuario. |
| `user.firstName` | `String` | Nombre del usuario. |
| `user.lastName` | `String` | Apellido del usuario. |
| `user.email` | `String` | Correo electrónico. |
| `user.avatarUrl` | `String \| null` | URL de la imagen de perfil. |
| `user.initials` | `String` | Iniciales a mostrar si no hay avatar (ej: "JD"). |
| `registered` | `Boolean` | `true` si el usuario está registrado en un estudio, `false` para mostrar estado "No registrado". |
| `zone` | `Array[Object]` | Lista de sesiones activas (Live Zone). |
| `zone[].id` | `String` | ID único de la sesión. |
| `zone[].lifecycle`| `Enum` | Estados: `'live'`, `'soon'`, `'finished'`. |
| `zone[].title` | `String` | Título del estudio. |
| `zone[].leader` | `String` | Nombre del líder. |
| `zone[].church` | `String` | Nombre de la iglesia. |
| `zone[].start` | `Timestamp (ms)` | Hora de inicio programada o real. |
| `zone[].inRoom` | `Number` | Personas en sala (solo `'live'`). |
| `zone[].participants` | `Array[Object]` | Lista de participantes visibles (solo `'live'`). |
| `past` | `Array[Object]` | Lista de sesiones pasadas (Historial). |
| `past[].id` | `String` | ID único de la sesión. |
| `past[].title` | `String` | Título del estudio. |
| `past[].church` | `String` | Nombre de la iglesia. |
| `past[].start` | `Timestamp (ms)` | Hora de inicio. |
| `past[].notesUrl` | `String` | Link a las notas del estudio. |

---

## 3. Peticiones de Acción (Requests)

### A. Configuración de Cuenta (`screen-settings`)

**Cambiar Contraseña**
- **Endpoint:** `POST /api/settings/password` (ejemplo)
- **Payload:** 
  ```json
  {
    "currentPassword": "String",
    "newPassword": "String"
  }
  ```
- **Respuesta esperada:** `200 OK` o error con mensaje.

---

### B. Perfil de Usuario (`screen-profile`)

**Actualizar Datos Básicos**
- **Endpoint:** `POST /api/user/profile`
- **Payload:** 
  ```json
  {
    "firstName": "String",
    "lastName": "String",
    "email": "String"
  }
  ```

**Subir Foto de Perfil**
- **Endpoint:** `POST /api/user/avatar`
- **Tipo:** `multipart/form-data`
- **Campo:** `avatarFile` (File)
- **Respuesta esperada:** `{ "avatarUrl": "String" }`

---

### C. Interacciones del Dashboard

**Invitar a un Amigo**
- **Endpoint:** `POST /api/studies/invite`
- **Payload:** 
  ```json
  {
    "email": "String"
  }
  ```