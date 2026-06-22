'use strict';

/* ─────────────────────────────────────────────────
   CONSTANTES DE TIEMPO
   Usadas para cálculos de lifecycle y formateo.
   ───────────────────────────────────────────────── */
const MIN = 60_000;
const HR  = 60 * MIN;
const DAY = 24 * HR;
const now = Date.now();

/* Máximo de avatares individuales antes de mostrar "+N" */
const MAX_AVATARS = 3;

/* ─────────────────────────────────────────────────
   AVATAR COLOR — determinista por ID de participante
   Deriva un color del sistema de diseño a partir del
   ID del usuario. Mismo ID → mismo color siempre,
   sin importar el orden en que lleguen los datos.
   Se usan solo los colores de la paleta oficial.
   ───────────────────────────────────────────────── */
const AVATAR_COLORS = [
  'var(--teal)',
  'var(--orange)',
  'var(--navy-light)',
  'var(--bg-base)',
  'var(--teal-dark)',
  'var(--orange-press)'
];
function avatarColor(id) {
  // Sumar char codes del ID y usar módulo sobre la paleta
  const hash = [...String(id)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/* ─────────────────────────────────────────────────
   MESES — para formateo de fechas sin dependencias
   ───────────────────────────────────────────────── */
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN',
                'JUL','AUG','SEP','OCT','NOV','DEC'];

/* ─────────────────────────────────────────────────
   HELPERS DE TIEMPO
   fmtTime — "3:45 PM"
   delta   — "6 min" / "2 hr" / "3 days"
   ───────────────────────────────────────────────── */
function fmtTime(d) {
  let h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function delta(ms) {
  const a = Math.abs(ms);
  if (a < HR)  return `${Math.round(a / MIN)} min`;
  if (a < DAY) return `${Math.round(a / HR)} hr`;
  return `${Math.round(a / DAY)} days`;
}

/* ─────────────────────────────────────────────────
   DATA — BACKEND API
   ═════════════════════════════════════════════════
   PUNTO DE INTEGRACIÓN CON ASP CLASSIC:
   Reemplazar este objeto con la respuesta de tu
   endpoint. Estructura esperada:

   registered : bool   — ¿está el user inscrito en un grupo?
   user       : object — { firstName: string, initials: string }
   zone       : array  — sesiones en ventana lifecycle
                         cada una: {
                           id        : string,
                           title     : string,
                           leader    : string,
                           church    : string,
                           lifecycle : 'soon'|'live'|'finished',
                           start     : timestamp ms (para 'soon'),
                           startedAgo: ms transcurridos (para 'live'),
                           endedAgo  : ms transcurridos (para 'finished'),
                           inRoom    : int (solo 'live')
                         }
/* ═══════════════════════════════════════════════════════════════
   API CONTRACT — SCHEMA COMPLETO
   ═══════════════════════════════════════════════════════════════

   Este bloque define la forma exacta que debe tener la respuesta
   del backend ASP Classic. El objeto `data` es el único lugar
   donde vive la lógica de integración; el render engine lo
   consume sin conocer su origen.

   ENDPOINT SUGERIDO:  GET /api/dashboard?userId={id}
   CONTENT-TYPE:       application/json

   ──────────────────────────────────────────────────────────────
   SCHEMA RAÍZ
   ──────────────────────────────────────────────────────────────
   {
     "registered" : boolean,
       // true  → usuario pertenece a al menos un grupo de estudio
       // false → usuario autenticado pero sin grupo asignado aún
       //         El banner y el topbar se muestran igual; solo
       //         cambia el contenido del historial y la zone.

     "user" : {
       "id"        : string,   // ID interno del usuario
       "firstName" : string,   // Nombre de pila para el saludo
       "lastName"  : string,   // Apellido (reservado, no usado en v1)
       "initials"  : string    // 1-2 caracteres para el avatar pill
       "avatar"    : string    // URL de avatar personalizado (opcional)
                               // Si se omite, se deriva de firstName[0]
     },

     "zone" : ZoneSession[],
       // Sesiones dentro de la ventana de lifecycle activa.
       // Array vacío cuando no hay sesión en curso.
       // Puede contener más de un elemento (ej: soon + finished).
       // El render engine ordena por prioridad: live > soon > finished.

     "past" : PastSession[]
       // Historial de sesiones completadas, cualquier orden.
       // El render engine ordena por start desc (más reciente primero).
   }

   ──────────────────────────────────────────────────────────────
   ZoneSession  (un elemento de zone[])
   ──────────────────────────────────────────────────────────────
   {
     "id"          : string,
       // ID único de la sesión. Se usa como key de estado (accordions,
       // invite panel). Debe ser estable entre renders.

     "title"       : string,   // Nombre del estudio / serie
     "leader"      : string,   // Nombre completo del líder
     "church"      : string,   // Nombre de la congregación

     "lifecycle"   : "soon" | "live" | "finished",
       // Estado actual de la sesión.
       // El backend determina el estado; el frontend no lo calcula.

     // ── Campos por lifecycle ────────────────────────────────
     // lifecycle === "soon"
     "start"       : number,   // Unix timestamp ms del inicio programado

     // lifecycle === "live"
     "start"       : number,   // Unix timestamp ms de cuando arrancó
     "startedAgo"  : number,   // ms transcurridos desde el inicio
                               // (ahora - start). El backend puede
                               // omitirlo y el frontend lo deriva.
     "inRoom"      : number,   // Total de personas en sala (incluye líder)
     "participants": Participant[],
       // Lista de participantes visibles para los avatares.
       // El frontend muestra hasta MAX_AVATARS (3) y agrupa el resto
       // en "+N". Si el array tiene más de MAX_AVATARS elementos, solo
       // se renderizan los primeros MAX_AVATARS.

     // lifecycle === "finished"
     "endedAgo"    : number    // ms transcurridos desde el cierre
   }

   ──────────────────────────────────────────────────────────────
   Participant  (un elemento de ZoneSession.participants[])
   ──────────────────────────────────────────────────────────────
   {
     "id"       : string,   // ID del usuario participante
     "initials" : string,   // 1-2 caracteres para el avatar
     "name"     : string    // Nombre completo (accesibilidad / tooltip)
   }

   ──────────────────────────────────────────────────────────────
   PastSession  (un elemento de past[])
   ──────────────────────────────────────────────────────────────
   {
     "id"       : string,
     "title"    : string,
     "leader"   : string,
     "church"   : string,
     "start"    : number,    // Unix timestamp ms
     "attended" : boolean,   // true si el usuario asistió a la sesión.
                             // Controla el dot indicator, el pill del
                             // header colapsado y el pill del body
                             // expandido en Study History.
     "notesUrl" : string     // URL pública del recap/notas
                             // Abre en pestaña nueva (target="_blank")
   }

   ──────────────────────────────────────────────────────────────
   INTEGRACIÓN ASP CLASSIC — ejemplo de hidratación
   ──────────────────────────────────────────────────────────────
   Reemplazar el objeto `data` literal con una llamada fetch al
   endpoint, o bien inyectarlo directamente desde el servidor:

   Opción A — fetch al cargar la página:
     async function loadDashboard() {
       const res  = await fetch('/api/dashboard?userId=<%=userId%>');
       const json = await res.json();
       Object.assign(data, json);
       render();
     }
     loadDashboard();

   Opción B — inyección server-side (ASP Classic):
     const data = <%=Response.Write(dashboardJson)%>;

   ═══════════════════════════════════════════════════════════════
   DATOS DE EJEMPLO — reemplazar con la llamada real al endpoint
   ═══════════════════════════════════════════════════════════════ */
const data = {
  registered: true,
  user: {
    id:        'u-001',
    firstName: 'Jordan',
    lastName:  'Mills',
    initials:  'JM',
    email:     'jordan.mills@email.com'
  },
  zone: [
    {
      id:          'gs1',
      title:       'The Good Soil',
      leader:      'Elias Ocasio',
      church:      'Life Church',
      lifecycle:   'live',
      start:       now - 6 * MIN,
      startedAgo:  6 * MIN,
      inRoom:      8,
      participants: [
        { id: 'u-011', initials: 'EO', name: 'Elias Ocasio'  },
        { id: 'u-022', initials: 'LC', name: 'Laura Chen'    },
        { id: 'u-033', initials: 'GS', name: 'Grace Solano'  },
        { id: 'u-044', initials: 'MR', name: 'Marcus Reid'   },
        { id: 'u-055', initials: 'TK', name: 'Tina Kwan'     }
      ]
    }
  ],
  past: [
    {
      id:       'gs0',
      title:    'The Good Soil',
      leader:   'Elias Ocasio',
      church:   'Life Church',
      start:    now - 7  * DAY,
      attended: true,
      notesUrl: 'https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c'
    },
    {
      id:       'gs00',
      title:    'The Good Soil',
      leader:   'Elias Ocasio',
      church:   'Life Church',
      start:    now - 14 * DAY,
      attended: false,
      notesUrl: 'https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c'
    },
    {
      id:       'gs000',
      title:    'Faith and Works',
      leader:   'Maria Torres',
      church:   'Grace Chapel',
      start:    now - 21 * DAY,
      attended: true,
      notesUrl: 'https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c'
    },
    {
      id:       'gs0000',
      title:    'The Power of Prayer',
      leader:   'James Okafor',
      church:   'New Hope Bible',
      start:    now - 28 * DAY,
      attended: false,
      notesUrl: 'https://www.bibledose.com/study/notes/caa0f611a74e28147eae9999eefcdad083e6b95c'
    }
  ]
};

/* ─────────────────────────────────────────────────
   STATE
   Mínimo estado de UI necesario:
   · open     — Set de IDs de acordeones expandidos
   · popover  — ID del invite panel abierto (o null)
   · join     — estado del modal "Join a different study"
   · register — estado del modal "Register for a Group"
   ───────────────────────────────────────────────── */
const state = {
  open:       new Set(),
  popover:    null,   // { id, copied, sent } | null — invite modal
  join:       null,   // estado del modal Join a Different Study | null
  register:   null,   // estado del modal Register for a Group | null
  search:     '',     // texto del filtro de historial
  share:      null,   // { sessionId, copied, sent } | null — share modal
  dateFilter: 'all',  // 'all' | 'custom'
  dateStart:  '',     // ISO date string (YYYY-MM-DD) o vacío
  dateEnd:    '',     // ISO date string (YYYY-MM-DD) o vacío
  page:       1       // página actual del historial (1-indexed)
};

/* ─────────────────────────────────────────────────
   SVG ICONS — shortcuts para plantillas HTML
   Definidos una sola vez y reusados en todo el
   render engine.
   ───────────────────────────────────────────────── */
const ICONS = {
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 10l4.5-2.5v9L15 14M4 7h9a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"/></svg>`,
  note:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3v5h5"/><path d="M19 21H5a1 1 0 01-1-1V4a1 1 0 011-1h9l5 5v11a1 1 0 01-1 1z"/><path d="M8 13h8M8 17h6"/></svg>`,
  link:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/></svg>`,
  guest: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  chev:  `<svg class="acc-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  home:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19V8l8-4 8 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1z"/><path d="M9 20v-6h6v6"/></svg>`,
  info:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>`,
  door:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="3" width="11" height="18" rx="1.5"/><path d="M21 12H10M16 8l4 4-4 4"/></svg>`,
  qr:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v3h-3M14 21h3v-3"/></svg>`,
  group: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>`
};

/* ─────────────────────────────────────────────────
   ZONE CARD SORT
   Orden de prioridad: live > soon > finished.
   Dentro de cada tipo: live → más reciente primero,
   soon → más próximo primero, finished → más reciente.
   ───────────────────────────────────────────────── */
function zoneCards() {
  const order = { live: 0, soon: 1, finished: 2 };
  return [...data.zone].sort((a, b) => {
    if (a.lifecycle !== b.lifecycle) return order[a.lifecycle] - order[b.lifecycle];
    if (a.lifecycle === 'live')     return b.start - a.start;
    if (a.lifecycle === 'soon')     return a.start - b.start;
    return a.endedAgo - b.endedAgo;
  });
}

/* ─────────────────────────────────────────────────
   BROWSE LIST — historial de sesiones pasadas,
   más reciente primero.
   ───────────────────────────────────────────────── */
const ITEMS_PER_PAGE = 10;

function browseList() {
  const t = Date.now();
  const q = state.search.trim().toLowerCase();

  // Parse optional date range boundaries (start of day / end of day UTC)
  const ds = state.dateStart ? new Date(state.dateStart + 'T00:00:00').getTime() : null;
  const de = state.dateEnd   ? new Date(state.dateEnd   + 'T23:59:59').getTime() : null;

  return data.past
    .filter(x => x.start < t)
    .filter(x => {
      if (!q) return true;
      return x.church.toLowerCase().includes(q)
          || x.title.toLowerCase().includes(q)
          || x.leader.toLowerCase().includes(q);
    })
    .filter(x => {
      if (state.dateFilter !== 'custom') return true;
      if (ds && x.start < ds) return false;
      if (de && x.start > de) return false;
      return true;
    })
    .sort((a, b) => b.start - a.start);
}

/* Devuelve la página actual de browseList() */
function browseListPage() {
  const all = browseList();
  const start = (state.page - 1) * ITEMS_PER_PAGE;
  return {
    items:      all.slice(start, start + ITEMS_PER_PAGE),
    totalItems: all.length,
    totalPages: Math.ceil(all.length / ITEMS_PER_PAGE)
  };
}

/* ═════════════════════════════════════════════════
   MODAL HELPERS COMPARTIDOS
   Usados por los 4 modales (Join, Register, Invite,
   Share) para mantener un comportamiento consistente:
   validación de email/teléfono, detección de cámara,
   y el shell visual común (split-panel).
   ═════════════════════════════════════════════════ */

/* Email válido: requiere "@" y un ".dominio" */
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
}

/* Formatea progresivamente un input de teléfono US: 000-000-0000.
   Se llama en cada keystroke (oninput) y devuelve el valor formateado. */
function formatPhoneValue(raw) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
}

/* Teléfono válido solo cuando alcanza los 10 dígitos */
function isValidPhone(v) {
  return (v || '').replace(/\D/g, '').length === 10;
}

/* Aplica auto-formato de teléfono a un <input> en vivo,
   preservando la posición del cursor al final del valor. */
function attachPhoneFormatter(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    input.value = formatPhoneValue(input.value);
  });
}

/* Detección de cámara — usada por los modales Join y Register
   para decidir si se muestra la sección de escaneo QR.
   Devuelve una Promise<boolean>. No lanza si el usuario niega
   el permiso; simplemente resuelve false. */
async function checkCameraAvailable() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch {
    return false;
  }
}

/* ── SHELL VISUAL COMÚN ──────────────────────────────────────
   Construye el backdrop + modal + header con título centrado
   y franja de color superior + footer (Cancel / Submit).

   opts:
     id          — id del backdrop, ej. "joinBackdrop"
     accent      — 'orange-band' | 'orange-border' | 'teal-border'
     title       — texto del título centrado
     bodyHtml    — HTML del cuerpo (las dos columnas split-panel)
     submitLabel — texto del botón de envío
     submitId    — id del botón submit (para sincronizar disabled)
     submitDisabled — bool, estado inicial del botón submit
     formId      — id del <form> que envuelve el modal completo
                   (el submit del footer dispara este form)
     closeFn     — nombre de la función global a invocar al cerrar
   ─────────────────────────────────────────────────────────── */
function buildModalShell(opts) {
  const accentClass = {
    'orange-band':   'modal-accent-band-orange',
    'orange-border': 'modal-accent-border-orange',
    'teal-border':   'modal-accent-border-teal'
  }[opts.accent] || '';

  return `
    <div class="inv-backdrop" id="${opts.id}" role="dialog" aria-modal="true" aria-label="${opts.title}">
      <div class="inv-modal split-modal ${accentClass}">
        <div class="split-modal-header">
          <span class="split-modal-title">${opts.title}</span>
          <button class="inv-close" type="button" data-close-modal="${opts.closeFn}" aria-label="Close ${opts.title}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form id="${opts.formId}" novalidate class="split-modal-form">
          <div class="inv-body">${opts.bodyHtml}</div>
          <div class="split-modal-footer">
            <button type="button" class="btn btn-secondary" data-close-modal="${opts.closeFn}">Cancel</button>
            <button type="submit" class="btn btn-primary" id="${opts.submitId}" ${opts.submitDisabled ? 'disabled' : ''}>${opts.submitLabel}</button>
          </div>
        </form>
      </div>
    </div>`;
}

/* ── PANEL DE CÓDIGO COMPARTIDO (Join / Register) ────────────
   Genera el panel izquierdo de código + QR, usado tanto por
   "Join a different study" (Join code) como por
   "Register for a Group" (Group code). Comportamiento:
   · El QR es la opción principal ("Scan QR"): se muestra un
     qr-box inactivo con "Tap to scan QR code". La cámara NO
     se solicita hasta que el usuario hace tap ahí — recién
     en ese momento se pide permiso (checkCameraAvailable) y,
     si se concede, arranca la animación de escaneo.
   · El input de código (monoespaciado, mayúsculas, debounce
     900ms) sigue disponible debajo, como alternativa siempre
     visible al QR.
   · Confirmado (por código o por QR) → reemplaza todo el
     panel con un bloque rígido de confirmación.
   ─────────────────────────────────────────────────────────── */
function codePanel(kind, st) {
  // kind: 'join' | 'register' — determina copys y campos de confirmación
  const labels = {
    join:     { heading: 'Scan QR', inputLabel: 'Enter join code',  fieldId: 'joinCodeInput',     boxId: 'joinQrBox',     starter: 'startJoinQrScan' },
    register: { heading: 'Scan QR', inputLabel: 'Enter group code', fieldId: 'registerCodeInput', boxId: 'registerQrBox', starter: 'startRegisterQrScan' }
  }[kind];

  // Bloque de confirmación rígido — ya validado (por código o QR)
  if (st.confirmed) {
    const c = st.confirmed;
    const rows = kind === 'join'
      ? `<p><strong>Study:</strong> ${c.title}</p>
         <p><strong>Church:</strong> ${c.church}</p>
         <p><strong>Session time:</strong> ${c.time}</p>`
      : `<p><strong>Group:</strong> ${c.title}</p>
         <p><strong>Leader:</strong> ${c.leader}</p>
         <p><strong>Church:</strong> ${c.church}</p>`;
    return `<div class="inv-col">
      <h3>${labels.heading}</h3>
      <div class="code-confirm-block" role="status">
        <div class="code-confirm-check">✓ Code confirmed</div>
        ${rows}
      </div>
    </div>`;
  }

  // Sección QR — tres estados posibles:
  //   camera === null     → idle, esperando tap del usuario
  //   camera === true     → escaneando (línea animada)
  //   camera === 'denied' → permiso denegado
  //   qrInvalid           → QR leído pero no reconocido
  let qrSection;
  if (st.qrInvalid) {
    qrSection = `
      <div class="qr-box qr-box--invalid" role="button" tabindex="0"
           aria-label="QR code not recognized, tap to try again"
           onclick="${labels.starter}()">
        <span class="qr-box-msg">QR code not recognized</span>
      </div>`;
  } else if (st.camera === true) {
    qrSection = `
      <div class="qr-box" aria-live="polite">
        <div class="qr-scan-line"></div>
        <span class="qr-box-msg">Point your camera at the QR code</span>
      </div>`;
  } else if (st.camera === 'denied') {
    qrSection = `<p class="code-camera-msg">Camera access denied please allow camera access and try again.</p>`;
  } else {
    // idle — el usuario aún no pidió escanear
    qrSection = `
      <div class="qr-box qr-box--idle" id="${labels.boxId}" role="button" tabindex="0"
           aria-label="Tap to scan QR code" onclick="${labels.starter}()">
        <div class="qr-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"></rect>
            <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"></rect>
            <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"></rect>
            <path d="M14 14h2v2h-2zM18 14h3M18 18h3M14 18v3M16 20h2"></path>
          </svg>
        </div>
        <div class="qr-lbl">Tap to scan QR code</div>
        <div class="qr-sub">Point your camera at a QR code</div>
      </div>`;
  }

  const errorMsg = st.codeInvalid
    ? `<p class="code-error" role="alert">Code not recognized. Check and try again.</p>`
    : '';

  return `<div class="inv-col">
    <h3>${labels.heading}</h3>
    ${qrSection}
    <div class="or-divider"><span class="line"></span><span>or</span><span class="line"></span></div>
    <label class="u-sr-only" for="${labels.fieldId}">${labels.inputLabel}</label>
    <input class="inv-field code-field ${st.codeInvalid ? 'error' : ''}" id="${labels.fieldId}"
           type="text" placeholder="${labels.inputLabel}" autocomplete="off"
           autocapitalize="characters" spellcheck="false"
           value="${st.codeValue || ''}"
           data-code-kind="${kind}">
    ${errorMsg}
  </div>`;
}

/* Dispara la solicitud de cámara SOLO cuando el usuario hace
   tap en el qr-box — ya no ocurre automáticamente al abrir
   el modal. Mientras se resuelve el permiso, deja el box en
   su estado idle (evita doble-tap); al resolver, transiciona
   a 'scanning' o 'denied' según corresponda. */
async function startJoinQrScan() {
  const st = state.join;
  if (!st || st.camera === true) return; // ya escaneando, ignorar doble tap
  st.qrInvalid = false;
  const available = await checkCameraAvailable();
  if (!state.join) return; // el modal pudo cerrarse mientras esperábamos
  state.join.camera = available ? true : 'denied';
  renderJoinModal();
}
async function startRegisterQrScan() {
  const st = state.register;
  if (!st || st.camera === true) return;
  st.qrInvalid = false;
  const available = await checkCameraAvailable();
  if (!state.register) return;
  state.register.camera = available ? true : 'denied';
  renderRegisterModal();
}

/* ─────────────────────────────────────────────────
   INVITE GUEST MODAL
   Se renderiza como backdrop fixed centrado en
   pantalla. Siempre visible en mobile y desktop.
   El backdrop se inserta en #inv-modal-root fuera
   del flujo de las cards.
   ───────────────────────────────────────────────── */
function invitePanel(id) {
  // Solo renderiza el botón disparador.
  // El modal vive en #inv-modal-root (ver openInviteModal).
  const isOpen = state.popover && state.popover.id === id;
  return `<button class="btn btn-secondary--teal inv-trigger" data-id="${id}"
            aria-haspopup="dialog" aria-expanded="${isOpen ? 'true' : 'false'}">
    ${ICONS.guest} Invite guest
  </button>`;
}

/* Construye y monta el modal en el DOM.
   Borde superior teal (regla global de Invite Guest). */
function openInviteModal(id) {
  const p = state.popover; // { id, copied, sent }

  // Col izquierda — Share link
  const leftCol = p.copied
    ? `<div class="inv-col"><h3>Share link</h3><div class="inv-copied">✓ Link copied!</div></div>`
    : `<div class="inv-col">
         <h3>Share link</h3>
         <p>Send this link to anyone you'd like to invite to the study.</p>
         <button class="btn btn-secondary btn--inv-copy" type="button" data-inv="sharelink" data-id="${id}">
           ${ICONS.link} Copy link
         </button>
       </div>`;

  // Col derecha — Register a guest (sin form propio: el form envuelve todo el modal)
  const rightCol = p.sent
    ? `<div class="inv-col">
         <h3>Register a guest</h3>
         <div class="inv-success" role="status">✓ Guest registered!</div>
       </div>`
    : `<div class="inv-col">
         <h3 id="inv-reg-heading">Register a guest</h3>
         <label class="u-sr-only" for="invFirstName">First name (required)</label>
         <input class="inv-field" id="invFirstName" name="firstName"
                placeholder="First name *" autocomplete="given-name"
                required oninput="checkInviteForm('${id}')">

         <label class="u-sr-only" for="invLastName">Last name</label>
         <input class="inv-field" id="invLastName" name="lastName"
                placeholder="Last name" autocomplete="family-name"
                oninput="checkInviteForm('${id}')">

         <label class="u-sr-only" for="invEmail">Email address</label>
         <input class="inv-field" id="invEmail" name="email"
                placeholder="Email address" autocomplete="email" type="email"
                oninput="checkInviteForm('${id}')">

         <label class="u-sr-only" for="invPhone">Phone number</label>
         <input class="inv-field" id="invPhone" name="phone"
                placeholder="Phone number" autocomplete="tel" type="tel"
                oninput="checkInviteForm('${id}')">

         <p class="inv-note">* First name and email or phone required</p>
       </div>`;

  const html = buildModalShell({
    id:             'invBackdrop',
    accent:         'teal-border',
    title:          'Invite guest',
    bodyHtml:       leftCol + rightCol,
    submitLabel:    'Send invitation',
    submitId:       'invSubmitBtn',
    submitDisabled: true,
    formId:         'formInviteGuest',
    closeFn:        'closeInviteModal'
  });

  document.getElementById('inv-modal-root').innerHTML = html;

  // Auto-formato de teléfono en vivo
  attachPhoneFormatter(document.getElementById('invPhone'));

  // Sincronizar estado real del botón submit tras montar
  checkInviteForm(id);
}

/* Cierra y desmonta el modal */
function closeInviteModal() {
  document.getElementById('inv-modal-root').innerHTML = '';
  state.popover = null;
  // Re-render para sincronizar aria-expanded en el botón disparador
  render();
}

/* ─────────────────────────────────────────────────
   SHARE STUDY MODAL
   Mismo estilo split-panel que el invite modal.
   Se monta en #share-modal-root. Borde superior teal
   (regla global de Share Study).

   Col izquierda: Copy link — campo read-only con la
                  URL completa de las notas + botón Copy.
   Col derecha:   Share via message — nombre + email/
                  teléfono, envía al backend.
   ───────────────────────────────────────────────── */
function openShareModal(sessionId) {
  // Encontrar la sesión en data.past para obtener notesUrl
  const session = data.past.find(x => x.id === sessionId);
  if (!session) return;

  const url = session.notesUrl || '';

  // Estado del modal guardado en state.share
  const s = state.share || { copied: false, sent: false };
  state.share = { ...s, sessionId };

  const leftCol = state.share.copied
    ? `<div class="inv-col"><h3>Share link</h3><div class="inv-copied" role="status">✓ Link copied!</div></div>`
    : `<div class="inv-col">
         <h3>Share link</h3>
         <p>This link points to the read-only study notes for this session.</p>
         <label class="u-sr-only" for="shareUrlField">Study notes URL</label>
         <input class="inv-field share-url-field" id="shareUrlField" type="text" value="${url}" readonly>
         <button class="btn btn-secondary btn--inv-copy"
                 id="shareCopyBtn" type="button">
           ${ICONS.link} Copy link
         </button>
       </div>`;

  const rightCol = state.share.sent
    ? `<div class="inv-col"><h3>Share via message</h3><div class="inv-success" role="status">✓ Shared!</div></div>`
    : `<div class="inv-col">
         <h3 id="share-form-heading">Share via message</h3>
         <input type="hidden" name="sessionId" value="${sessionId}">
         <input type="hidden" name="notesUrl"  value="${url}">

         <label class="u-sr-only" for="shareFirstName">First name (required)</label>
         <input class="inv-field" id="shareFirstName" name="firstName"
                placeholder="First name *" autocomplete="given-name"
                required oninput="checkShareForm()">

         <label class="u-sr-only" for="shareLastName">Last name</label>
         <input class="inv-field" id="shareLastName" name="lastName"
                placeholder="Last name" autocomplete="family-name">

         <label class="u-sr-only" for="shareEmail">Email address</label>
         <input class="inv-field" id="shareEmail" name="email"
                placeholder="Email address" type="email" autocomplete="email"
                oninput="checkShareForm()">

         <label class="u-sr-only" for="sharePhone">Phone number</label>
         <input class="inv-field" id="sharePhone" name="phone"
                placeholder="Phone number" type="tel" autocomplete="tel"
                oninput="checkShareForm()">

         <p class="inv-note">* First name and email or phone required</p>
       </div>`;

  const html = buildModalShell({
    id:             'shareBackdrop',
    accent:         'teal-border',
    title:          'Share study',
    bodyHtml:       leftCol + rightCol,
    submitLabel:    'Send study link',
    submitId:       'shareSubmitBtn',
    submitDisabled: true,
    formId:         'formShare',
    closeFn:        'closeShareModal'
  });

  document.getElementById('share-modal-root').innerHTML = html;

  attachPhoneFormatter(document.getElementById('sharePhone'));
  checkShareForm();
}

function closeShareModal() {
  document.getElementById('share-modal-root').innerHTML = '';
  state.share = null;
}

/* Validación del share form — first name + (email válido o teléfono válido) */
function checkShareForm() {
  const form  = document.getElementById('formShare');
  if (!form) return;
  const fname = form.querySelector('#shareFirstName')?.value.trim();
  const email = form.querySelector('#shareEmail')?.value.trim();
  const phone = form.querySelector('#sharePhone')?.value.trim();
  const btn   = document.getElementById('shareSubmitBtn');
  if (btn) btn.disabled = !(fname && (isValidEmail(email) || isValidPhone(phone)));
}

/* Listeners del share modal — delegados en el root */
document.getElementById('share-modal-root').addEventListener('click', e => {
  // Copy link — copia la URL del campo read-only al clipboard
  if (e.target.closest('#shareCopyBtn')) {
    const url = data.past.find(x => x.id === state.share?.sessionId)?.notesUrl || '';
    navigator.clipboard.writeText(url).catch(() => {});
    state.share = { ...state.share, copied: true };
    openShareModal(state.share.sessionId);
    setTimeout(() => {
      if (state.share) {
        state.share = { ...state.share, copied: false };
        closeShareModal();
      }
    }, 2000);
  }
});

document.getElementById('share-modal-root').addEventListener('submit', async e => {
  if (e.target.id !== 'formShare') return;
  e.preventDefault();

  const fd = new FormData(e.target);
  const payload = {
    sessionId: fd.get('sessionId'),
    notesUrl:  fd.get('notesUrl'),
    firstName: fd.get('firstName')?.trim(),
    lastName:  fd.get('lastName')?.trim()  || null,
    email:     fd.get('email')?.trim()     || null,
    phone:     fd.get('phone')?.trim()     || null
  };

  // TODO: reemplazar con endpoint real cuando esté disponible.
  // await API.shareStudy(payload);
  console.info('[API] POST /api/sessions/share', payload);

  const id = state.share?.sessionId;
  state.share = { ...state.share, sent: true };
  openShareModal(id);
  setTimeout(() => closeShareModal(), 2000);
});

/* ─────────────────────────────────────────────────
   INVITE FORM VALIDATION
   Submit habilitado solo cuando first name +
   (email válido OR teléfono válido) tienen valor.
   ───────────────────────────────────────────────── */
function checkInviteForm(_id) {
  const form = document.getElementById('formInviteGuest');
  if (!form) return;
  const fname = form.querySelector('#invFirstName')?.value.trim();
  const email = form.querySelector('#invEmail')?.value.trim();
  const phone = form.querySelector('#invPhone')?.value.trim();
  const btn   = document.getElementById('invSubmitBtn');
  if (btn) btn.disabled = !(fname && (isValidEmail(email) || isValidPhone(phone)));
}

/* ═════════════════════════════════════════════════
   JOIN A DIFFERENT STUDY MODAL
   ═════════════════════════════════════════════════
   Header con banda naranja sólida (regla global).
   PANEL IZQUIERDO — Join code: input monoespaciado +
     debounce 900ms + QR (si hay cámara) → bloque de
     confirmación rígido (Study / Church / Session time).
   PANEL DERECHO — Room Details: Room ID + Room Passcode,
     usados solo si NO se confirmó código/QR.
   SUBMIT ("Join study") — habilitado si código/QR
     confirmado, O si Room ID + Passcode están llenos.
   ───────────────────────────────────────────────── */
let _joinDebounceTimer = null;

async function openJoinModal() {
  state.join = state.join || {
    codeValue: '', codeInvalid: false, confirmed: null,
    camera: null, qrInvalid: false,
    roomId: '', roomPasscode: ''
  };

  renderJoinModal();
  // La cámara ya NO se solicita automáticamente al abrir el
  // modal — solo se pide cuando el usuario hace tap en el
  // qr-box (ver startJoinQrScan()).
}

function renderJoinModal() {
  const st = state.join;
  if (!st) return;

  const leftCol = codePanel('join', st);

  const roomDisabled = !!st.confirmed;
  const rightCol = `<div class="inv-col">
    <h3>Room details</h3>
    <p>Use these only if you don't have a join code or QR.</p>
    <label class="u-sr-only" for="joinRoomId">Room ID</label>
    <input class="inv-field" id="joinRoomId" placeholder="Room ID *"
           value="${st.roomId || ''}" ${roomDisabled ? 'disabled' : ''}
           oninput="onJoinFieldInput()">
    <label class="u-sr-only" for="joinRoomPasscode">Room passcode</label>
    <input class="inv-field" id="joinRoomPasscode" placeholder="Room passcode *"
           type="password" value="${st.roomPasscode || ''}" ${roomDisabled ? 'disabled' : ''}
           oninput="onJoinFieldInput()">
  </div>`;

  const codeConfirmed = !!st.confirmed;
  const roomFilled     = !!(st.roomId?.trim() && st.roomPasscode?.trim());
  const canSubmit       = codeConfirmed || roomFilled;

  const html = buildModalShell({
    id:             'joinBackdrop',
    accent:         'orange-band',
    title:          'Join a different study',
    bodyHtml:       leftCol + rightCol,
    submitLabel:    'Join study',
    submitId:       'joinSubmitBtn',
    submitDisabled: !canSubmit,
    formId:         'formJoinStudy',
    closeFn:        'closeJoinModal'
  });

  document.getElementById('join-modal-root').innerHTML = html;

  const codeInput = document.getElementById('joinCodeInput');
  if (codeInput) {
    codeInput.addEventListener('input', onJoinCodeInput);
    // Posicionar el cursor al final tras re-render
    codeInput.focus();
    codeInput.setSelectionRange(codeInput.value.length, codeInput.value.length);
  }
}

/* Input de código — fuerza mayúsculas + debounce 900ms */
function onJoinCodeInput(e) {
  const st = state.join;
  if (!st) return;
  st.codeValue   = e.target.value.toUpperCase();
  st.codeInvalid = false;

  clearTimeout(_joinDebounceTimer);
  _joinDebounceTimer = setTimeout(() => validateJoinCode(), 900);
}

/* "Validación contra backend" — stub determinista para demo.
   TODO: reemplazar con POST /api/sessions/validate-code real. */
function validateJoinCode() {
  const st = state.join;
  if (!st) return;
  const code = (st.codeValue || '').trim();
  if (!code) return;

  // Stub: cualquier código de 6+ caracteres se considera válido
  console.info('[API] POST /api/sessions/validate-code', { code });
  if (code.length >= 6) {
    st.confirmed = {
      title:  'The Good Soil',
      church: 'Life Church',
      time:   '7:00 PM'
    };
    st.codeInvalid = false;
  } else {
    st.confirmed   = null;
    st.codeInvalid = true;
  }
  renderJoinModal();
}

/* Room ID / Passcode — habilita el submit cuando ambos están llenos */
function onJoinFieldInput() {
  const st = state.join;
  if (!st) return;
  st.roomId       = document.getElementById('joinRoomId')?.value || '';
  st.roomPasscode = document.getElementById('joinRoomPasscode')?.value || '';
  const btn = document.getElementById('joinSubmitBtn');
  if (btn) btn.disabled = !(st.confirmed || (st.roomId.trim() && st.roomPasscode.trim()));
}

function closeJoinModal() {
  clearTimeout(_joinDebounceTimer);
  document.getElementById('join-modal-root').innerHTML = '';
  state.join = null;
}

document.getElementById('join-modal-root').addEventListener('submit', async e => {
  if (e.target.id !== 'formJoinStudy') return;
  e.preventDefault();

  const st = state.join;
  const payload = st.confirmed
    ? { mode: 'code', code: st.codeValue }
    : { mode: 'room', roomId: st.roomId, roomPasscode: st.roomPasscode };

  // TODO: reemplazar con endpoint real cuando esté disponible.
  // await API.joinStudy(payload);
  console.info('[API] POST /api/sessions/join', payload);

  const root = document.getElementById('join-modal-root');
  const body = root.querySelector('.inv-body');
  if (body) {
    body.innerHTML = `<div class="inv-col" style="flex:1"><div class="inv-success" role="status">✓ You're in! Joining the study…</div></div>`;
  }
  setTimeout(() => closeJoinModal(), 2000);
});

/* ═════════════════════════════════════════════════
   REGISTER FOR A GROUP MODAL
   ═════════════════════════════════════════════════
   Header con borde superior naranja (regla global).
   PANEL IZQUIERDO — Group code: mismo comportamiento
     exacto que Join (monoespaciado, debounce 900ms, QR).
     Al confirmarse muestra Group name / Leader / Church.
   PANEL DERECHO — Group Details: "Group Name", usado
     solo si NO se confirmó código/QR.
   SUBMIT ("Register") — habilitado si código/QR
     confirmado, O si Group Name está lleno.
   ───────────────────────────────────────────────── */
let _registerDebounceTimer = null;

async function openRegisterModal() {
  state.register = state.register || {
    codeValue: '', codeInvalid: false, confirmed: null,
    camera: null, qrInvalid: false,
    groupName: ''
  };

  renderRegisterModal();
  // La cámara ya NO se solicita automáticamente al abrir el
  // modal — solo se pide cuando el usuario hace tap en el
  // qr-box (ver startRegisterQrScan()).
}

function renderRegisterModal() {
  const st = state.register;
  if (!st) return;

  const leftCol = codePanel('register', st);

  const groupDisabled = !!st.confirmed;
  const rightCol = `<div class="inv-col">
    <h3>Group details</h3>
    <p>Use this only if you don't have a group code or QR.</p>
    <label class="u-sr-only" for="registerGroupName">Group name</label>
    <input class="inv-field" id="registerGroupName" placeholder="Group name *"
           value="${st.groupName || ''}" ${groupDisabled ? 'disabled' : ''}
           oninput="onRegisterFieldInput()">
  </div>`;

  const codeConfirmed = !!st.confirmed;
  const groupFilled    = !!st.groupName?.trim();
  const canSubmit       = codeConfirmed || groupFilled;

  const html = buildModalShell({
    id:             'registerBackdrop',
    accent:         'orange-border',
    title:          'Register for a Group',
    bodyHtml:       leftCol + rightCol,
    submitLabel:    'Register',
    submitId:       'registerSubmitBtn',
    submitDisabled: !canSubmit,
    formId:         'formRegisterGroup',
    closeFn:        'closeRegisterModal'
  });

  document.getElementById('register-modal-root').innerHTML = html;

  const codeInput = document.getElementById('registerCodeInput');
  if (codeInput) {
    codeInput.addEventListener('input', onRegisterCodeInput);
    codeInput.focus();
    codeInput.setSelectionRange(codeInput.value.length, codeInput.value.length);
  }
}

function onRegisterCodeInput(e) {
  const st = state.register;
  if (!st) return;
  st.codeValue   = e.target.value.toUpperCase();
  st.codeInvalid = false;

  clearTimeout(_registerDebounceTimer);
  _registerDebounceTimer = setTimeout(() => validateRegisterCode(), 900);
}

/* "Validación contra backend" — stub determinista para demo.
   TODO: reemplazar con POST /api/groups/validate-code real. */
function validateRegisterCode() {
  const st = state.register;
  if (!st) return;
  const code = (st.codeValue || '').trim();
  if (!code) return;

  console.info('[API] POST /api/groups/validate-code', { code });
  if (code.length >= 6) {
    st.confirmed = {
      title:  'Faith and Works',
      leader: 'Maria Torres',
      church: 'Grace Chapel'
    };
    st.codeInvalid = false;
  } else {
    st.confirmed   = null;
    st.codeInvalid = true;
  }
  renderRegisterModal();
}

function onRegisterFieldInput() {
  const st = state.register;
  if (!st) return;
  st.groupName = document.getElementById('registerGroupName')?.value || '';
  const btn = document.getElementById('registerSubmitBtn');
  if (btn) btn.disabled = !(st.confirmed || st.groupName.trim());
}

function closeRegisterModal() {
  clearTimeout(_registerDebounceTimer);
  document.getElementById('register-modal-root').innerHTML = '';
  state.register = null;
}

document.getElementById('register-modal-root').addEventListener('submit', async e => {
  if (e.target.id !== 'formRegisterGroup') return;
  e.preventDefault();

  const st = state.register;
  const payload = st.confirmed
    ? { mode: 'code', code: st.codeValue }
    : { mode: 'groupName', groupName: st.groupName };

  // TODO: reemplazar con endpoint real cuando esté disponible.
  // await API.registerForGroup(payload);
  console.info('[API] POST /api/groups/register', payload);

  const root = document.getElementById('register-modal-root');
  const body = root.querySelector('.inv-body');
  if (body) {
    body.innerHTML = `<div class="inv-col" style="flex:1"><div class="inv-success" role="status">✓ You're registered for the group!</div></div>`;
  }
  setTimeout(() => closeRegisterModal(), 2000);
});

// Triggers de la topbar — abren cada modal
document.getElementById('topJoinBtn').addEventListener('click', openJoinModal);
document.getElementById('topRegisterBtn').addEventListener('click', openRegisterModal);

/* ─────────────────────────────────────────────────
   ZONE CARD RENDERER
   Genera el HTML completo de una zcard según
   su lifecycle state.
   ───────────────────────────────────────────────── */
function renderZoneCard(x) {
  // Pill de estado
  const pills = {
    live:     `<span class="pill live"><span class="dot"></span> Live now</span>`,
    soon:     `<span class="pill soon"><span class="dot"></span> Starting soon</span>`,
    finished: `<span class="pill finished">✓ Finished</span>`
  };
  const pill = pills[x.lifecycle];

  // Texto de tiempo relativo
  let when = '';
  if (x.lifecycle === 'live') {
    when = `<span class="when live-when">${ICONS.clock} Started ${delta(x.startedAgo)} ago</span>`;
  } else if (x.lifecycle === 'soon') {
    const ms  = Math.max(0, x.start - Date.now());
    const totalSec = Math.floor(ms / 1000);
    const mm  = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss  = String(totalSec % 60).padStart(2, '0');
    const countdown = `${mm}:${ss}`;
    when = `<span class="when soon-when">${ICONS.clock} Starts in ${countdown} · ${fmtTime(new Date(x.start))}</span>`;
  } else {
    when = `<span class="when past-when">${ICONS.clock} Ended ${delta(x.endedAgo)} ago</span>`;
  }

  // ── Presence — solo en live ───────────────────────────────────
  // Los avatares se construyen desde x.participants (viene del backend).
  // Se muestran hasta MAX_AVATARS iniciales; el resto se agrupa en "+N".
  // El count total usa x.inRoom (puede ser mayor que participants.length
  // si el backend limita cuántos participantes envía al cliente).
  let presence = '';
  if (x.lifecycle === 'live') {
    const list    = Array.isArray(x.participants) ? x.participants : [];
    const visible = list.slice(0, MAX_AVATARS);
    const overflow = Math.max(0, (x.inRoom || list.length) - visible.length);

    const avatarSpans = visible.map(p =>
      `<span style="background:${avatarColor(p.id)}" title="${p.name}" aria-label="${p.name}">${p.initials}</span>`
    ).join('');

    const overflowSpan = overflow > 0
      ? `<span style="background:var(--bg-dark)" aria-label="${overflow} more participants">+${overflow}</span>`
      : '';

    const total = x.inRoom || list.length;
    const label = total === 1 ? '1 person in the room' : `${total} people in the room`;

    presence = `<div class="presence">
      <div class="avatars" aria-hidden="true">${avatarSpans}${overflowSpan}</div>
      <span class="who">${label}</span>
    </div>`;
  }

  // Acciones según lifecycle
  let actions = '';
  if (x.lifecycle === 'live') {
    actions = `<div class="actions">
      <button class="btn btn-primary">${ICONS.video} Join this study</button>
      ${invitePanel(x.id)}
    </div>`;
  } else if (x.lifecycle === 'soon') {
    actions = `<div class="actions">
      ${invitePanel(x.id)}
    </div>
    <div class="hint">${ICONS.info} You'll be able to join when the leader starts the study.</div>`;
  } else {
    // Buscar la sesión en data.past para obtener notesUrl
    const pastSession = data.past.find(p => p.title === x.title && p.leader === x.leader);
    const notesHref = pastSession?.notesUrl || x.notesUrl || '#';
    actions = `<div class="actions">
      <a class="btn btn-secondary btn-secondary--white"
         href="${notesHref}"
         target="_blank"
         rel="noopener noreferrer">${ICONS.note} View notes</a>
    </div>`;
  }
  // the presence element goes between the when and the actions, so it appears near the bottom of the card but above the divider line. currently is not used
  return `<div class="zcard ${x.lifecycle}" role="article">
    ${pill}
    <div class="session">
      <div class="session-meta">
        <h2>${x.title}</h2>
        <p>Led by ${x.leader} · ${x.church}</p>
        ${when}
      </div>
    </div>
    <hr class="div">
    ${actions}
  </div>`;
}

/* ─────────────────────────────────────────────────
   ACCORDION ROW RENDERER
   Genera una fila de historial de estudios.
   La fila es compacta (past-row) y colapsable.

   Jerarquía visual: el Study Title es la línea
   primaria (bold), Church name es la línea
   secundaria/subtexto.

   Fecha: día de la semana abreviado en mayúsculas +
   mes + día (ej. "Mon JUN 9"). Sin hora, ni en el
   header colapsado ni en el body expandido.

   Attendance marker (campo x.attended):
   · Dot indicator junto al título — teal si asistió,
     gris si no.
   · Pill en el header colapsado — solo si asistió
     ("Attended", teal claro). No se muestra nada si
     no asistió.
   · Pill en el body expandido — siempre visible:
     "Attended" (teal) o "Missed" (gris).
   Estos elementos son de solo lectura, no cliqueables.
   ───────────────────────────────────────────────── */
function renderRow(x) {
  const d    = new Date(x.start);
  const open = state.open.has(x.id) ? ' open' : '';

  // attended puede no venir del backend todavía — default false
  const attended = x.attended === true;

  // Día de la semana abreviado en mayúsculas + mes + día
  // Formato requerido: "Mon JUN 9" (sin hora, en colapsado y expandido)
  const dayShort   = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr    = `${MONTHS[d.getMonth()]} · ${dayShort} ${d.getDate()}`;

  // Dot indicator — teal si asistió, gris si no
  const dotClass = attended ? 'attended' : 'missed';

  // Pill del header colapsado — solo se muestra si asistió
  const headerPill = attended
    ? `<span class="att-pill att-pill--header">Attended</span>`
    : '';

  // Pill del body expandido — Attended (teal) o Missed (gris), siempre visible
  const bodyPill = attended
    ? `<span class="att-pill att-pill--body att-pill--attended">Attended</span>`
    : `<span class="att-pill att-pill--body att-pill--missed">Missed</span>`;

  const body = `
    <p class="bodylead">Led by ${x.leader} · ${x.church} · ${dateStr}</p>
    ${bodyPill}
    <hr class="div">
    <div class="actions">
      <a class="btn btn-secondary"
         href="${x.notesUrl}"
         target="_blank"
         rel="noopener noreferrer">
        ${ICONS.note} View notes
      </a>
      <button class="btn btn-secondary--teal"
              data-share="${x.id}"
              aria-label="Share this study">
        ${ICONS.link} Share study
      </button>
    </div>`;

  return `<div class="acc${open} past-row" data-id="${x.id}" role="listitem">
    <div class="acc-head" role="button" tabindex="0"
         aria-expanded="${open ? 'true' : 'false'}"
         aria-controls="acc-body-${x.id}">
      <span class="acc-dot ${dotClass}" aria-hidden="true"></span>
      <div class="acc-titles">
        <span class="acc-title">${x.title}</span>
        <span class="acc-subtitle">${x.church}</span>
      </div>
      ${headerPill}
      <span class="acc-when">${dateStr}</span>
      ${ICONS.chev}
    </div>
    <div class="acc-body" id="acc-body-${x.id}">${body}</div>
  </div>`;
}

/* ─────────────────────────────────────────────────
   EMPTY STATE — sin historial (usuario registrado)
   ───────────────────────────────────────────────── */
function renderEmptyHistory() {
  return `<div class="empty calm" role="status">
    <div class="ic">${ICONS.clock}</div>
    <h2>No past studies yet</h2>
    <p>Your completed sessions and recap notes will appear here.</p>
  </div>`;
}

/* ─────────────────────────────────────────────────
   UNREGISTERED STATE
   Mostrado en lugar del historial cuando el usuario
   no está inscrito en ningún grupo.
   Dos CTAs: Join as guest (primario) + Register (ghost).
   ───────────────────────────────────────────────── */
function renderUnregistered() {
  document.getElementById("historyPagination").classList.add("u-hidden");
  return `<div class="empty none" role="status">
    <div class="ic">${ICONS.home}</div>
    <h2>You're not in any studies yet</h2>
    <p>Find a group that fits your schedule or jump in as a guest.</p>
    <div class="actions">
      <button class="btn btn-primary btn--cta-wide" id="emptyJoinGuestBtn" type="button">
        Join a study as a guest
      </button>
    </div>
    <div class="or-divider">
      <div class="line"></div>
      <span>or</span>
      <div class="line"></div>
    </div>
    <p class="empty-sub">Looking for a long-term group to join?</p>
    <div class="actions actions--mt">
      <button class="btn btn-orange-ghost btn--cta-wide" id="emptyRegisterBtn" type="button">
        Register for a Group
      </button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────
   RENDER ENGINE — tres funciones con responsabilidades
   claramente separadas:

   renderZone()  — actualiza solo #liveZone.
                   Llamada por tickLifecycle() en cada
                   tick para el countdown MM:SS y las
                   transiciones de lifecycle.
                   NO toca el historial ni el banner.

   renderList()  — actualiza solo #historySearch + #list.
                   Llamada cuando cambia state.search,
                   state.open, o los datos de data.past.

   render()      — orquesta todo: banner, zone, list.
                   Llamada en el arranque, al cambiar de
                   escenario en el dev panel, y cuando
                   data.registered cambia.
   ───────────────────────────────────────────────── */

/* ── renderZone(): solo la zone card ────────────────────────
   No toca el historial — evita colapsar accordions abiertos
   o perder el foco del usuario durante el countdown tick.  */
function renderZone() {
  const lz = document.getElementById('liveZone');
  if (!data.registered) { lz.innerHTML = ''; return; }

  const cards = zoneCards();
  lz.innerHTML = cards.length
    ? `<div class="zone" aria-label="Now and next">
         <div class="zone-head" aria-hidden="true">Now &amp; next</div>
         ${cards.map(renderZoneCard).join('')}
       </div>`
    : '';
}

/* ── renderList(): solo el historial ────────────────────────
   Preserva el foco al input de búsqueda cuando lo llama
   el listener del search input.                            */
function renderList() {
  const listEl   = document.getElementById('list');
  const header   = document.getElementById('listHeader');
  const searchEl = document.getElementById('historySearch');

  if (!data.registered) {
    header.classList.add('u-hidden');
    searchEl.innerHTML = '';
    listEl.innerHTML   = renderUnregistered();
    return;
  }

  header.classList.remove('u-hidden');

  // ── Search + Date filter bar ──────────────────────────────────
  // Se monta una sola vez; si el nodo ya existe se actualiza
  // solo el estado del date range sin destruir el input de texto.
  if (data.past.length > 0) {
    if (!document.getElementById('historySearchInput')) {
      searchEl.innerHTML = `
        <div class="history-search-wrap">
          <div class="history-search-row">
            <div class="history-search-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                class="history-search-input"
                id="historySearchInput"
                type="text"
                placeholder="Search studies…"
                aria-label="Search study history"
                autocomplete="off"
              >
              <button class="history-search-clear"
                      id="historySearchClear"
                      type="button"
                      aria-label="Clear search">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="history-date-filter-wrap">
              <select class="history-date-select"
                      id="historyDateFilter"
                      aria-label="Filter by date">
                <option value="all">All dates</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div class="history-date-range" id="historyDateRange" aria-hidden="true">
            <div class="date-range-bar">
              <div class="date-range-field">
                <label for="historyDateStart" class="u-sr-only">Start date</label>
                <input type="date" id="historyDateStart" class="date-range-input"
                       aria-label="Start date" placeholder="Start date">
              </div>
              <span class="date-range-sep" aria-hidden="true">→</span>
              <div class="date-range-field">
                <label for="historyDateEnd" class="u-sr-only">End date</label>
                <input type="date" id="historyDateEnd" class="date-range-input"
                       aria-label="End date" placeholder="End date">
              </div>
            </div>
          </div>
        </div>`;
    }

    // Sincronizar valores del select y del date range con el state
    const sel = document.getElementById('historyDateFilter');
    if (sel && sel.value !== state.dateFilter) sel.value = state.dateFilter;

    const range = document.getElementById('historyDateRange');
    if (range) {
      const isCustom = state.dateFilter === 'custom';
      range.classList.toggle('visible', isCustom);
      range.setAttribute('aria-hidden', String(!isCustom));
      if (isCustom) {
        const ds = document.getElementById('historyDateStart');
        const de = document.getElementById('historyDateEnd');
        if (ds && ds.value !== state.dateStart) ds.value = state.dateStart;
        if (de && de.value !== state.dateEnd)   de.value = state.dateEnd;
      }
    }

    // Sincronizar botón X con state.search
    const clearBtn = document.getElementById('historySearchClear');
    if (clearBtn) clearBtn.classList.toggle('visible', !!state.search);

  } else {
    searchEl.innerHTML = '';
  }

  // ── Lista paginada ────────────────────────────────────────────
  const { items, totalItems, totalPages } = browseListPage();

  if (!items.length && (state.search || state.dateFilter === 'custom')) {
    listEl.innerHTML = `
      <div class="empty calm" role="status">
        <div class="ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <h2>No results</h2>
        <p>No studies match your current filters.</p>
      </div>`;
  } else {
    listEl.innerHTML = items.length
      ? items.map(renderRow).join('')
      : renderEmptyHistory();
  }

  // ── Pagination bar ────────────────────────────────────────────
  renderPagination(totalItems, totalPages);
}

function scrollToHistory() {
  document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Cierra todos los accordions abiertos del Study History.
   Se invoca en cada cambio de filtro (búsqueda, date range)
   para evitar que una fila quede abierta y "parpadee" al
   re-renderizar la lista con cada keystroke. */
function closeAllAccordions() {
  state.open.clear();
}

function renderPagination(totalItems, totalPages) {
  // Remove any existing pagination bar
  const existing = document.getElementById('historyPagination');
  if (existing) existing.remove();

  if (totalPages <= 1) return;

  const card    = document.querySelector('.card');
  const listEl  = document.getElementById('list');
  const bar     = document.createElement('div');
  bar.id        = 'historyPagination';
  bar.className = 'history-pagination';
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Study history pagination');
  bar.innerHTML = `
    <span class="pagination-info">
      Page ${state.page} of ${totalPages} · ${totalItems} session${totalItems !== 1 ? 's' : ''}
    </span>
    <div class="pagination-controls">
      <button class="btn btn-pagination"
              id="paginationPrev"
              type="button"
              ${state.page <= 1 ? 'disabled aria-disabled="true"' : ''}
              aria-label="Previous page">
        Previous
      </button>
      <button class="btn btn-pagination"
              id="paginationNext"
              type="button"
              ${state.page >= totalPages ? 'disabled aria-disabled="true"' : ''}
              aria-label="Next page">
        Next
      </button>
    </div>`;

  card.insertBefore(bar, listEl.nextSibling);
}

/* ── render(): orquestador completo ─────────────────────────
   Actualiza banner + zone + list. Usar solo cuando cambia
   el estado global (registered, escenario dev, arranque). */
function render() {
  const reg = data.registered;

  // Avatar + nombre — siempre presentes
  document.getElementById('profileAvatar').innerHTML = renderAvatarNode(data.user);
  document.getElementById('profileName').textContent = data.user?.firstName || '';

  // Welcome banner
  const wb = document.getElementById('welcomeBanner');
  wb.classList.remove('u-hidden');
  wb.innerHTML = welcomeContent();

  // Profile pill, join button y register button
  document.getElementById('profileBtn').classList.remove('u-hidden');
  document.getElementById('topJoinBtn').classList.remove('u-hidden');
  document.getElementById('topRegisterBtn').classList.remove('u-hidden');

  renderZone();
  renderList();
}
function welcomeContent() {
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name  = data.user?.firstName || 'there';

  let sub   = 'Nothing on the schedule today.';
  let badge = '';

  if (!data.registered) {
    // Usuario autenticado pero sin grupo — invitarlo a unirse
    sub = 'Find a group and join the conversation.';
  } else if (data.zone.some(z => z.lifecycle === 'live')) {
    const s = data.zone.find(z => z.lifecycle === 'live');
    sub   = `${s.title} is live right now.`;
    badge = `<div class="welcome-badge live"><span class="dot"></span> Live now</div>`;
  } else if (data.zone.some(z => z.lifecycle === 'soon')) {
    sub   = 'You have a study starting soon — get ready.';
    badge = `<div class="welcome-badge soon"><span class="dot"></span> Starting soon</div>`;
  } else if (data.zone.some(z => z.lifecycle === 'finished')) {
    const s = data.zone.find(z => z.lifecycle === 'finished');
    sub = `${s.title} just wrapped up. Notes are saved.`;
  }

  return `
    <div class="welcome-text">
      <h1>${greet}, ${name}! 👋</h1>
      <p>${sub}</p>
    </div>
    ${badge}`;
}

/* ─────────────────────────────────────────────────
   EVENT HANDLERS — delegación de eventos
   Un solo listener en document para todo el dashboard.
   Se identifica el target usando .closest().
   ───────────────────────────────────────────────── */

// ── History search ─────────────────────────────────
document.querySelector('.card').addEventListener('input', e => {
  if (e.target.id === 'historySearchInput') {
    state.search = e.target.value;
    state.page   = 1;
    closeAllAccordions();
    renderList();
  }
  if (e.target.id === 'historyDateStart') {
    state.dateStart = e.target.value;
    state.page      = 1;
    closeAllAccordions();
    renderList();
  }
  if (e.target.id === 'historyDateEnd') {
    state.dateEnd = e.target.value;
    state.page    = 1;
    closeAllAccordions();
    renderList();
  }
});
document.querySelector('.card').addEventListener('change', e => {
  if (e.target.id === 'historyDateFilter') {
    state.dateFilter = e.target.value;
    if (state.dateFilter === 'all') {
      state.dateStart = '';
      state.dateEnd   = '';
    }
    state.page = 1;
    closeAllAccordions();
    renderList();
  }
});
document.querySelector('.card').addEventListener('click', e => {
  if (e.target.closest('#historySearchClear')) {
    state.search = '';
    const input = document.getElementById('historySearchInput');
    if (input) input.value = '';
    state.page = 1;
    closeAllAccordions();
    renderList();
    document.getElementById('historySearchInput')?.focus();
  }
  // Pagination
  if (e.target.closest('#paginationPrev')) {
    if (state.page > 1) { state.page--; renderList(); scrollToHistory(); }
    return;
  }
  if (e.target.closest('#paginationNext')) {
    const { totalPages } = browseListPage();
    if (state.page < totalPages) { state.page++; renderList(); scrollToHistory(); }
    return;
  }
  // Share study button
  const shareBtn = e.target.closest('[data-share]');
  if (shareBtn) {
    const id = shareBtn.dataset.share;
    openShareModal(id);
    return;
  }
  // Empty state — Join as guest / Register for a Group
  if (e.target.closest('#emptyJoinGuestBtn')) {
    openJoinModal();
    return;
  }
  if (e.target.closest('#emptyRegisterBtn')) {
    openRegisterModal();
    return;
  }
});

// ── Profile dropdown ──────────────────────────────
const profileBtn  = document.getElementById('profileBtn');
const profileDrop = document.getElementById('profileDrop');
const profileWrap = profileBtn.closest('.profile-wrap');

profileBtn.addEventListener('click', e => {
  e.stopPropagation();
  const isOpen = !profileDrop.classList.contains('u-hidden');
  profileDrop.classList.toggle('u-hidden', isOpen);
  profileBtn.setAttribute('aria-expanded', String(!isOpen));
});

// Profile — navega a screen-profile e hidrata los campos
document.getElementById('profileItemBtn').addEventListener('click', () => {
  profileDrop.classList.add('u-hidden');
  profileBtn.setAttribute('aria-expanded', 'false');
  syncProfileScreen();
  showScreen('profile');
});

// Ir a Settings (Password)
document.getElementById('settingsBtn').addEventListener('click', () => {
  profileDrop.classList.add('u-hidden');
  profileBtn.setAttribute('aria-expanded', 'false');
  showScreen('settings');
});

// Logout — placeholder (conectar con backend)
document.getElementById('logoutBtn').addEventListener('click', () => {
  profileDrop.classList.add('u-hidden');
  profileBtn.setAttribute('aria-expanded', 'false');
  showToast('Logging out…');
});

// ── Delegación global ────────────────────────────
document.addEventListener('click', e => {
  // Cerrar profile dropdown al hacer click fuera del wrapper
  if (!profileWrap.contains(e.target)) {
    profileDrop.classList.add('u-hidden');
    profileBtn.setAttribute('aria-expanded', 'false');
  }

  // Cierre genérico de cualquiera de los 4 modales — data-close-modal
  // contiene el nombre de la función global a invocar.
  const closeTrigger = e.target.closest('[data-close-modal]');
  if (closeTrigger) {
    e.stopPropagation();
    const fnName = closeTrigger.dataset.closeModal;
    if (typeof window[fnName] === 'function') window[fnName]();
    return;
  }

  // Invite trigger — abre el modal
  const invTrigger = e.target.closest('.inv-trigger');
  if (invTrigger) {
    e.stopPropagation();
    const id = invTrigger.dataset.id;
    state.popover = { id, copied: false, sent: false };
    openInviteModal(id);
    return;
  }

  // Acciones dentro del modal de invite
  const invAction = e.target.closest('[data-inv]');
  if (invAction) {
    e.stopPropagation();
    const id     = invAction.dataset.id;
    const action = invAction.dataset.inv;

    if (action === 'sharelink') {
      state.popover = { id, copied: true, sent: state.popover?.sent || false };
      openInviteModal(id);
      setTimeout(() => {
        if (state.popover?.id === id) {
          state.popover = { id, copied: false, sent: state.popover.sent };
          closeInviteModal();
        }
      }, 2000);
    }
    return;
  }

  // Cerrar modales al hacer click en el backdrop (fuera de .inv-modal)
  const anyBackdrop = e.target.closest('.inv-backdrop');
  if (anyBackdrop && !e.target.closest('.inv-modal')) {
    if (anyBackdrop.id === 'invBackdrop')     { closeInviteModal();   return; }
    if (anyBackdrop.id === 'shareBackdrop')   { closeShareModal();    return; }
    if (anyBackdrop.id === 'joinBackdrop')    { closeJoinModal();     return; }
    if (anyBackdrop.id === 'registerBackdrop'){ closeRegisterModal(); return; }
  }

  // Accordion toggle
  const head = e.target.closest('.acc-head');
  if (head) {
    const acc = head.closest('.acc');
    const id  = acc.dataset.id;
    if (state.open.has(id)) {
      state.open.delete(id);
    } else {
      state.open.add(id);
    }
    // Actualizar aria-expanded
    head.setAttribute('aria-expanded', String(state.open.has(id)));
    // Re-render solo el accordion en cuestión para performance
    acc.classList.toggle('open', state.open.has(id));
  }
});

// Soporte teclado para accordion (Enter / Space)
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const head = e.target.closest('.acc-head');
    if (head) {
      e.preventDefault();
      head.click();
    }
  }
});

/* ─────────────────────────────────────────────────
   INVITE GUEST — FORM SUBMIT
   El <form id="formInviteGuest"> se monta dinámicamente
   dentro de #inv-modal-root. Usamos delegación de
   submit sobre el nodo raíz para capturarlo.

   FLUJO:
   1. Prevenir submit nativo
   2. Recolectar datos via FormData
   3. Construir payload con sessionId del state
   4. Llamar a API.inviteGuest(payload)
   5. Mostrar confirmación y cerrar modal
   ───────────────────────────────────────────────── */
document.getElementById('inv-modal-root').addEventListener('submit', async e => {
  if (e.target.id !== 'formInviteGuest') return;
  e.preventDefault();

  const form = e.target;
  const fd   = new FormData(form);

  // ── Payload listo para el backend ──────────────────────────────
  const payload = {
    sessionId: state.popover?.id,
    firstName: fd.get('firstName')?.trim(),
    lastName:  fd.get('lastName')?.trim()  || null,
    email:     fd.get('email')?.trim()     || null,
    phone:     fd.get('phone')?.trim()     || null
  };

  // ── Llamada a la API ───────────────────────────────────────────
  // TODO: reemplazar con endpoint real cuando esté disponible.
  // await API.inviteGuest(payload);
  console.info('[API] POST /api/sessions/invite-guest', payload);

  // Mostrar confirmación y cerrar tras 2s
  const id = state.popover?.id;
  state.popover = { id, copied: state.popover?.copied || false, sent: true };
  openInviteModal(id);
  setTimeout(() => closeInviteModal(), 2000);
});

/* ─────────────────────────────────────────────────
   SCREEN SWITCHER
   Controla la navegación entre Dashboard y Settings.
   ───────────────────────────────────────────────── */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  window.scrollTo(0, 0);
}

document.getElementById('backToDashboard').addEventListener('click', () => {
  showScreen('dashboard');
});
document.getElementById('backToDashboardFromProfile').addEventListener('click', () => {
  showScreen('dashboard');
});

// Logos — vuelven al dashboard desde cualquier pantalla
['logoHome', 'settingsLogoHome', 'profileLogoHome'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => {
    e.preventDefault();
    showScreen('dashboard');
  });
});

/* ─────────────────────────────────────────────────
   SETTINGS — PASSWORD FORM
   Validación de frontend antes de enviar al backend.
   ───────────────────────────────────────────────── */

function syncSettingsHeader() {
  const sa = document.getElementById('settingsAvatar');
  const sn = document.getElementById('settingsName');
  if (sa) sa.innerHTML  = renderAvatarNode(data.user);
  if (sn) sn.textContent = data.user?.firstName || '';
}

/* ─────────────────────────────────────────────────
   SETTINGS — PASSWORD FORM SUBMIT
   El <form id="formPassword"> usa type="submit" en
   su botón, así que este handler cubre tanto click
   como Enter desde cualquier campo.

   FLUJO:
   1. Prevenir submit nativo (novalidate en el form)
   2. Recolectar datos via FormData
   3. Validar en frontend
   4. Si válido → llamar a API.changePassword()
   ───────────────────────────────────────────────── */
document.getElementById('formPassword').addEventListener('submit', async e => {
  e.preventDefault();

  const form    = e.currentTarget;
  const fd      = new FormData(form);
  const current = fd.get('currentPassword');
  const newPw   = fd.get('newPassword');
  const confirm = fd.get('confirmPassword');

  const fieldCurrent = document.getElementById('currentPassword');
  const fieldNew     = document.getElementById('newPassword');
  const fieldConfirm = document.getElementById('confirmPassword');
  const errCur       = document.getElementById('currentPasswordError');
  const errNew       = document.getElementById('newPasswordError');
  const errConf      = document.getElementById('confirmPasswordError');

  // Limpiar estado de error previo
  [fieldCurrent, fieldNew, fieldConfirm].forEach(f => {
    f.classList.remove('error');
    f.setAttribute('aria-invalid', 'false');
  });
  [errCur, errNew, errConf].forEach(el => el.classList.remove('visible'));

  let valid = true;

  if (!current.trim()) {
    fieldCurrent.classList.add('error');
    fieldCurrent.setAttribute('aria-invalid', 'true');
    errCur.classList.add('visible');
    valid = false;
  }
  if (newPw.length < 8) {
    fieldNew.classList.add('error');
    fieldNew.setAttribute('aria-invalid', 'true');
    errNew.classList.add('visible');
    valid = false;
  }
  if (newPw !== confirm) {
    fieldConfirm.classList.add('error');
    fieldConfirm.setAttribute('aria-invalid', 'true');
    errConf.classList.add('visible');
    valid = false;
  }

  if (!valid) {
    // Mover foco al primer campo inválido
    form.querySelector('.error')?.focus();
    return;
  }

  // ── Payload listo para el backend ──────────────────────────────
  const payload = {
    userId:          data.user.id,
    currentPassword: current,
    newPassword:     newPw
  };

  // ── Llamada a la API ───────────────────────────────────────────
  // TODO: reemplazar con endpoint real cuando esté disponible.
  // await API.changePassword(payload);
  console.info('[API] POST /api/account/change-password', payload);

  form.reset();
  // Resetear visibilidad — volver todos los campos a type="password"
  // para que no queden en texto plano si el usuario regresa a Settings.
  form.querySelectorAll('.pw-toggle').forEach(btn => {
    const input = document.getElementById(btn.getAttribute('aria-controls'));
    if (input) input.type = 'password';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Show password');
  });
  showToast('Password updated successfully');
});

/* ─────────────────────────────────────────────────
   TOAST
   Notificación no-bloqueante de confirmación.
   ───────────────────────────────────────────────── */
function showToast(msg) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}


/* ─────────────────────────────────────────────────
   LIFECYCLE TICKER — tickLifecycle()
   ═════════════════════════════════════════════════

   UBICACIÓN: justo antes del bloque INIT, después
   de todos los event handlers.

   QUÉ HACE:
   Corre cada segundo via setInterval. En cada tick:

   1. Recalcula el tiempo relativo de cada zone card
      (startedAgo para live, ms restantes para soon,
      endedAgo para finished) usando Date.now() en
      lugar de la constante `now` que es fija al load.

   2. Detecta transiciones de estado:
      · soon  → live     cuando Date.now() >= z.start
      · live  → (nada)   el backend cierra la sesión
      · finished se elimina después de 4 h (240 min)

   3. Llama render() SOLO si algo cambió, evitando
      re-renders innecesarios cada segundo.

   POR QUÉ setInterval Y NO requestAnimationFrame:
   El dashboard no es una animación de 60fps. Una
   actualización por segundo es más que suficiente
   y consume mucho menos CPU.

   INTEGRACIÓN CON BACKEND:
   En producción, el backend es la fuente de verdad
   del lifecycle. El ticker es un fallback de cliente
   para que la UI no espere al próximo poll para
   reflejar el cambio de soon → live. Cuando llegue
   la respuesta del servidor, Object.assign(data, ...)
   + render() sobreescribirá el estado local.
   ───────────────────────────────────────────────── */
function tickLifecycle() {
  const t = Date.now();
  let changed = false;

  data.zone.forEach(z => {
    if (z.lifecycle === 'soon') {
      const remaining = z.start - t;

      if (remaining <= 0) {
        // ── Transición: soon → live ──────────────────────────────
        z.lifecycle  = 'live';
        z.startedAgo = Math.abs(remaining);
        if (!z.inRoom)       z.inRoom       = 1;
        if (!z.participants) z.participants = [];
        changed = true;

        // TODO: Future API integration
        // Esta transición soon → live actualmente se dispara
        // únicamente por tiempo local del cliente (Date.now() >= z.start).
        //
        // En producción, el cambio de estado también puede ser
        // iniciado de forma remota por dos eventos del servidor:
        //   1. El administrador/líder abre la sala manualmente
        //      antes de la hora programada.
        //   2. El administrador/líder cierra la sala (live → finished),
        //      lo que el cliente no puede detectar localmente.
        //
        // Implementación futura sugerida:
        //   · Polling:  GET /api/sessions/{id}/status cada N segundos.
        //   · WebSocket / SSE: el servidor emite "session:opened" o
        //               "session:closed" con el sessionId.
        //
        // En ambos casos el servidor es la fuente de verdad.
      } else {
        // Sesión aún en soon — forzar re-render cada segundo
        // para actualizar el countdown MM:SS en pantalla.
        changed = true;
      }

    } else if (z.lifecycle === 'live') {
      // Mantener startedAgo actualizado para el texto
      // "Started X min ago" — cambio cada 60 s aprox.
      const newAgo = t - z.start;
      const prevMin = Math.floor((z.startedAgo || 0) / MIN);
      const currMin = Math.floor(newAgo / MIN);
      if (currMin !== prevMin) {
        z.startedAgo = newAgo;
        changed = true;
      }

    } else if (z.lifecycle === 'finished') {
      // Eliminar la card después de 4 horas
      const FOUR_HOURS = 4 * HR;
      if ((z.endedAgo || 0) + (t - (z._tickStart || t)) > FOUR_HOURS) {
        z._remove = true;
        changed = true;
      }
    }
  });

  // Purgar cards marcadas para eliminar
  if (data.zone.some(z => z._remove)) {
    data.zone = data.zone.filter(z => !z._remove);
    changed = true;
  }

  if (changed) {
    // Si hubo una transición de estado (soon→live, o tarjeta expirada),
    // hacer render() completo para actualizar también el welcome banner.
    // Si solo es un tick del countdown, renderZone() es suficiente.
    const hasTransition = data.zone.some(z =>
      z.lifecycle === 'live' && z.startedAgo <= 1500  // transicionó en este tick
    ) || !data.zone.some(z => z.lifecycle === 'soon'); // no queda ningún soon
    if (hasTransition) {
      render();
    } else {
      renderZone();
    }
  }
}

/* Arrancar el ticker — 1 tick por segundo */
const _lifecycleTicker = setInterval(tickLifecycle, 1000);

/* ─────────────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLES — initPasswordToggles()
   ═════════════════════════════════════════════════

   QUÉ HACE:
   Permite al usuario ver/ocultar el texto de cada
   campo de contraseña en el form de Settings.

   IMPLEMENTACIÓN:
   Listener directo en cada botón .pw-toggle (3 en total).
   e.stopPropagation() en cada uno garantiza que el click
   del ojo no burbujee al form ni interfiera con el submit.
     1. Identifica el <input> por aria-controls.
     2. Alterna el atributo type entre "password" / "text".
     3. Actualiza aria-pressed (false = oculto, true = visible).
     4. Actualiza aria-label para lectores de pantalla.

   POR QUÉ delegación y no tres listeners directos:
   El form existe en el DOM desde el inicio, así que
   la delegación no es estrictamente necesaria aquí,
   pero mantiene el patrón consistente con el resto
   del codebase (invite form, accordions, etc.) y
   facilita añadir campos en el futuro sin tocar el JS.

   SEGURIDAD:
   El tipo se resetea a "password" al hacer submit del
   form para no dejar texto plano visible si el usuario
   navega de regreso a Settings. Ver formPassword submit.
   ───────────────────────────────────────────────── */
function initPasswordToggles() {
  // Listener directo en cada botón — NO delegado en el form.
  // Razón: un listener de click en el <form> comparte el mismo
  // flujo de eventos que el submit. Usando listeners directos
  // en cada .pw-toggle y cortando el bubbling con stopPropagation,
  // garantizamos que el click del ojo nunca interfiere con el
  // submit event, en cualquier browser.
  document.querySelectorAll('#formPassword .pw-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      // Detener el bubbling — este click no debe llegar al form
      // ni disparar ningún otro handler de la página.
      e.stopPropagation();

      const inputId = btn.getAttribute('aria-controls');
      const input   = document.getElementById(inputId);
      if (!input) return;

      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';

      btn.setAttribute('aria-pressed', String(!isVisible));
      btn.setAttribute('aria-label',   isVisible ? 'Show password' : 'Hide password');
    });
  });
}

/* ─────────────────────────────────────────────────
   PROFILE SCREEN
   ═════════════════════════════════════════════════

   renderAvatarNode(user, size)
   ────────────────────────────
   Helper centralizado que devuelve el innerHTML
   correcto para cualquier lugar donde se muestre
   un avatar. Usa una <img> si user.avatarUrl existe,
   o un <span> con las iniciales si no.
   Se llama desde syncProfileScreen() y desde render()
   para mantener todos los avatares sincronizados.

   size: 'sm' (32px, topbar) | 'lg' (72px, profile screen)

   syncProfileScreen()
   ────────────────────
   Hidrata el formProfile con data.user actual,
   renderiza el preview del avatar y resetea
   el estado del botón "Save changes".

   checkProfileDirty()
   ────────────────────
   Compara los valores actuales de cada campo
   con los valores originales de data.user.
   Si hay diferencias → habilita el botón.
   Si no              → deshabilita el botón.

   apiUpdateProfile(payload)
   ──────────────────────────
   Muta data.user con los nuevos valores y propaga
   el cambio a todos los elementos del DOM que
   muestran datos del usuario.

   ENDPOINT SUGERIDO: PATCH /api/users/{id}/profile
   BODY: { firstName, lastName, email, initials, avatarUrl }
   ───────────────────────────────────────────────── */

/* ── Avatar helper — imagen o iniciales ──────────────────── */
function renderAvatarNode(user) {
  if (user.avatarUrl) {
    // Usuario tiene foto — mostrar <img>, ocultar texto
    return `<img src="${user.avatarUrl}"
                 alt="${user.firstName || 'User'} avatar"
                 loading="lazy">`;
  }
  // Sin foto — mostrar iniciales
  return `<span>${user.initials || user.firstName?.[0] || '?'}</span>`;
}

/* Actualiza todos los elementos de avatar del DOM */
function refreshAllAvatars() {
  const u = data.user;
  // Pill del topbar (dashboard)
  document.getElementById('profileAvatar').innerHTML = renderAvatarNode(u);
  // Pills estáticos de settings y profile
  const sa = document.getElementById('settingsAvatar');
  const pa = document.getElementById('profileScreenAvatar');
  if (sa) sa.innerHTML = renderAvatarNode(u);
  if (pa) pa.innerHTML = renderAvatarNode(u);
  // Preview grande en el profile screen
  const preview = document.getElementById('avatarPreview');
  if (preview) {
    preview.innerHTML = renderAvatarNode(u);
    // Aplicar clases de tamaño
    preview.classList.add('avatar', 'avatar--lg');
    preview.classList.toggle('avatar--img', !!u.avatarUrl);
  }
}

/* Valores originales — base de comparación para dirty check */
let _profileOriginal = {};

function syncProfileScreen() {
  const u = data.user;

  // Snapshot de valores originales para checkProfileDirty
  _profileOriginal = {
    firstName: u.firstName  || '',
    lastName:  u.lastName   || '',
    email:     u.email      || '',
    avatarFile: null   // archivo nuevo — siempre null al abrir
  };

  // Hidratar campos
  const fFirst = document.getElementById('profileFirstName');
  const fLast  = document.getElementById('profileLastName');
  const fEmail = document.getElementById('profileEmail');
  if (fFirst) fFirst.value = u.firstName || '';
  if (fLast)  fLast.value  = u.lastName  || '';
  if (fEmail) fEmail.value = u.email     || '';

  // Avatar preview
  refreshAllAvatars();

  // Pill estático del topbar de la pantalla profile
  const pName = document.getElementById('profileScreenName');
  if (pName) pName.textContent = u.firstName || '';

  // Botón deshabilitado al abrir — no hay cambios aún
  const btn = document.getElementById('saveProfileBtn');
  if (btn) btn.disabled = true;

  // Limpiar errores de sesiones anteriores
  document.querySelectorAll('#screen-profile .field-error')
    .forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('#screen-profile .field-input')
    .forEach(el => { el.classList.remove('error'); el.setAttribute('aria-invalid','false'); });
}

/* Habilita "Save changes" solo si algo cambió */
function checkProfileDirty() {
  const fFirst = document.getElementById('profileFirstName');
  const fLast  = document.getElementById('profileLastName');
  const fEmail = document.getElementById('profileEmail');
  const fFile  = document.getElementById('avatarFile');
  const btn    = document.getElementById('saveProfileBtn');
  if (!btn) return;

  const dirty =
    (fFirst?.value.trim() !== _profileOriginal.firstName) ||
    (fLast?.value.trim()  !== _profileOriginal.lastName)  ||
    (fEmail?.value.trim() !== _profileOriginal.email)     ||
    (fFile?.files.length  > 0);

  btn.disabled = !dirty;
}

/* ── API stub — muta data.user y propaga al DOM ──────────── */
async function apiUpdateProfile(payload) {
  const nameChanged = payload.firstName !== undefined || payload.lastName !== undefined;

  // Mutar data.user
  if (payload.firstName !== undefined) data.user.firstName = payload.firstName;
  if (payload.lastName  !== undefined) data.user.lastName  = payload.lastName;
  if (payload.email     !== undefined) data.user.email     = payload.email;
  if (payload.initials  !== undefined) data.user.initials  = payload.initials;
  if (payload.avatarUrl !== undefined) data.user.avatarUrl = payload.avatarUrl;

  // Recalcular iniciales si cambió el nombre y no se pasaron iniciales nuevas en el payload
  if (nameChanged && payload.initials === undefined) {
    const parts = [data.user.firstName, data.user.lastName].filter(Boolean);
    data.user.initials = parts.map(p => p[0].toUpperCase()).join('').slice(0, 2);
  }

  // TODO: Future API integration
  // const res = await fetch(`/api/users/${data.user.id}/profile`, {
  //   method:  'PATCH',
  //   headers: { 'Content-Type': 'application/json' },
  //   body:    JSON.stringify({ userId: data.user.id, ...payload })
  // });
  // if (!res.ok) throw new Error('Failed to update profile');
  console.info('[API] PATCH /api/users/' + data.user.id + '/profile', payload);

  // Propagar a todos los elementos del DOM que muestran datos del usuario
  document.getElementById('profileName').textContent = data.user.firstName || '';
  // Sincronizar toda la interfaz (incluye welcomeBanner y Topbar)
  render();
  syncSettingsHeader();
  refreshAllAvatars();
}

/* ── formProfile — submit único ──────────────────────────── */
document.getElementById('formProfile').addEventListener('submit', async e => {
  e.preventDefault();

  const fd        = new FormData(e.currentTarget);
  const firstName = fd.get('firstName')?.trim();
  const lastName  = fd.get('lastName')?.trim();
  const email     = fd.get('email')?.trim();
  const fileInput = document.getElementById('avatarFile');
  const file      = fileInput?.files?.[0] || null;

  // Limpiar errores previos
  document.querySelectorAll('#screen-profile .field-error')
    .forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('#screen-profile .field-input')
    .forEach(el => { el.classList.remove('error'); el.setAttribute('aria-invalid','false'); });

  let valid = true;

  if (!firstName) {
    const i = document.getElementById('profileFirstName');
    const p = document.getElementById('profileFirstNameError');
    i.classList.add('error'); i.setAttribute('aria-invalid','true');
    p.classList.add('visible');
    i.focus();
    valid = false;
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    const i = document.getElementById('profileEmail');
    const p = document.getElementById('profileEmailError');
    i.classList.add('error'); i.setAttribute('aria-invalid','true');
    p.classList.add('visible');
    if (valid) i.focus(); // solo el primer error toma foco
    valid = false;
  }

  if (!valid) return;

  // Construir payload con solo los campos que cambiaron
  const payload = {};
  if (firstName !== _profileOriginal.firstName) payload.firstName = firstName;
  if (lastName  !== _profileOriginal.lastName)  payload.lastName  = lastName;
  if (email     !== _profileOriginal.email)     payload.email     = email;

  // Archivo de avatar — leer como Data URL para preview inmediato
  if (file) {
    const reader = new FileReader();
    reader.onload = async ev => {
      payload.avatarUrl = ev.target.result; // base64 para preview local
      await apiUpdateProfile(payload);
      syncProfileScreen();
      showToast('Profile updated');
    };
    reader.readAsDataURL(file);
    return; // el resto se ejecuta en el onload
  }

  await apiUpdateProfile(payload);
  syncProfileScreen(); // actualiza snapshot + resetea botón
  showToast('Profile updated');
});

/* Listener del file input — preview inmediato + activa dirty */
document.getElementById('avatarFile').addEventListener('change', e => {
  const file    = e.target.files?.[0];
  const preview = document.getElementById('avatarPreview');
  if (!file || !preview) return;

  const reader = new FileReader();
  reader.onload = ev => {
    // Mostrar preview con la nueva imagen antes de guardar
    preview.innerHTML = `<img src="${ev.target.result}" alt="Avatar preview">`;
    preview.classList.add('avatar', 'avatar--lg', 'avatar--img');
  };
  reader.readAsDataURL(file);

  checkProfileDirty();
});

/* Listener de campos — activa dirty check en cada keystroke */
document.getElementById('formProfile').addEventListener('input', e => {
  if (['profileFirstName','profileLastName','profileEmail'].includes(e.target.id)) {
    checkProfileDirty();
  }
});

/* ─────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────── */
syncSettingsHeader();
initPasswordToggles();


render();