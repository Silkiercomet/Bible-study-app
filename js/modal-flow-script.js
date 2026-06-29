/* ============================================================
   BibleDose — Join Flow Script
   modal-flow-script.js
   ============================================================
   Handles:
   · Cookie detection & routing
   · All 14 modals (M00a, M00b, M01–M12)
   · All 13 scenarios (C1–C3, S1–S10)
   · REST API calls (Node/Express backend)
   · Guest form validation + auto-capitalization
   · Auto-advancing teal screens (M04, M05, M06)
   ============================================================ */

(function () {
  'use strict';

  /* ── CONFIG ── */
  const API_BASE     = '/api';          // Change to full URL in production
  const COOKIE_NAME  = 'bd_session';
  const AUTO_ADV_MS  = 2800;            // Teal screens auto-advance delay

  /* ── STATE ── */
  const state = {
    groupId:    null,
    groupName:  'The Good Soil',        // Populated from link/API
    isLive:     false,                  // Set on init
    cookieUser: null,                   // { name, userId } | null
    currentModal: null,
    autoAdvTimer: null,
  };

  /* ──────────────────────────────────────────────
     DOM BOOTSTRAP
  ────────────────────────────────────────────── */
  function init() {
    buildOverlay();
    buildModal();
  }

  function buildOverlay() {
    if (document.getElementById('bd-overlay')) return;
    const el = document.createElement('div');
    el.id = 'bd-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'bd-modal-title');
    document.body.appendChild(el);
  }

  function buildModal() {
    const overlay = document.getElementById('bd-overlay');
    if (!overlay) return;
    overlay.innerHTML = '<div class="bd-modal" id="bd-modal-shell"></div>';
  }

  /* ──────────────────────────────────────────────
     ENTRY POINT  — called by dev panel or page load
  ────────────────────────────────────────────── */
  async function triggerGroupLink(opts = {}) {
    /*  opts: { groupId, groupName, isLive, cookieUser }
        In production these come from the link URL + API lookup.
        In dev mode they're passed by the dev panel.           */
    clearAutoAdv();
    state.groupId    = opts.groupId   ?? 'group-001';
    state.groupName  = opts.groupName ?? 'The Good Soil';
    state.isLive     = opts.isLive    ?? false;
    state.cookieUser = opts.cookieUser ?? readCookie();

    showOverlay();

    if (state.cookieUser) {
      // Cookie flows C1 / C2
      state.isLive ? showM00a() : showM00b();
    } else {
      // Standard entry
      state.isLive ? showM01() : showM07();
    }
  }

  /* ──────────────────────────────────────────────
     COOKIE HELPERS
  ────────────────────────────────────────────── */
  function readCookie() {
    const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    if (!match) return null;
    try { return JSON.parse(decodeURIComponent(match[1])); }
    catch { return null; }
  }

  function clearCookie() {
    document.cookie = COOKIE_NAME + '=; Max-Age=0; path=/';
    state.cookieUser = null;
  }

  function setCookie(userData) {
    const value = encodeURIComponent(JSON.stringify(userData));
    document.cookie = COOKIE_NAME + '=' + value + '; Max-Age=2592000; path=/; SameSite=Lax';
    state.cookieUser = userData;
  }

  /* ──────────────────────────────────────────────
     OVERLAY CONTROL
  ────────────────────────────────────────────── */
  function showOverlay() {
    const overlay = document.getElementById('bd-overlay');
    if (!overlay) return;
    overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    // Trap focus inside modal
    overlay.addEventListener('keydown', trapFocus);
  }

  function hideOverlay() {
    clearAutoAdv();
    const overlay = document.getElementById('bd-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    document.body.style.overflow = '';
    overlay.removeEventListener('keydown', trapFocus);
    state.currentModal = null;
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = document.getElementById('bd-overlay')
      .querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  }

  /* ──────────────────────────────────────────────
     RENDER HELPER
  ────────────────────────────────────────────── */
  function render(modalId, colorClass, html) {
    state.currentModal = modalId;
    const shell = document.getElementById('bd-modal-shell');
    if (!shell) return;

    // Reset CSS animation by briefly removing from DOM, then reinserting
    const parent = shell.parentNode;
    const fresh = shell.cloneNode(false);
    fresh.id = 'bd-modal-shell';
    fresh.className = 'bd-modal ' + colorClass;
    fresh.setAttribute('aria-label', modalId);
    fresh.innerHTML = html;
    parent.replaceChild(fresh, shell);

    // Focus first interactive element
    requestAnimationFrame(() => {
      const btn = fresh.querySelector('button:not([disabled]), [href], input');
      if (btn) btn.focus();
    });
  }

  /* ──────────────────────────────────────────────
     SVG ICONS
  ────────────────────────────────────────────── */
  const SVG = {
    person: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    personX: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="23" y2="12"/><line x1="23" y1="8" x2="19" y2="12"/></svg>`,
    personPlus: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>`,
    door: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`,
    infoSm: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>`,
  };

  /* ──────────────────────────────────────────────
     BADGE BUILDERS
  ────────────────────────────────────────────── */
  function badgeOrangeLive(name) {
    return `<div class="bd-badge orange" aria-label="${name} · Live"><span class="live-dot" aria-hidden="true"></span>${esc(name)}<span class="bd-badge-sep" aria-hidden="true">·</span>Live</div>`;
  }

  function badgeNeutral(name, sub) {
    return `<div class="bd-badge neutral">${esc(name)}${sub ? `<span class="bd-badge-sep" aria-hidden="true">·</span>${esc(sub)}` : ''}</div>`;
  }

  function badgeTeal(name, sub) {
    return `<div class="bd-badge teal">${esc(name)}${sub ? `<span class="bd-badge-sep" aria-hidden="true">·</span>${esc(sub)}` : ''}</div>`;
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ──────────────────────────────────────────────
     AUTO-ADVANCE HELPER
  ────────────────────────────────────────────── */
  function clearAutoAdv() {
    if (state.autoAdvTimer) { clearTimeout(state.autoAdvTimer); state.autoAdvTimer = null; }
  }

  function autoAdvance(callback, delay) {
    clearAutoAdv();
    state.autoAdvTimer = setTimeout(callback, delay ?? AUTO_ADV_MS);
  }

  /* ──────────────────────────────────────────────
     DOTS HTML
  ────────────────────────────────────────────── */
  function dotsHtml() {
    return `<div class="bd-dots" aria-label="Cargando..." role="status"><span></span><span></span><span></span></div>`;
  }

  /* ══════════════════════════════════════════════
     MODAL RENDERERS
  ══════════════════════════════════════════════ */

  /* ── M00a — Cookie · Live ── */
  function showM00a() {
    const { groupName, cookieUser } = state;
    const firstName = cookieUser?.name?.split(' ')[0] ?? 'there';
    render('M00a', 'orange', `
      <div class="bd-modal-id-label">M00a</div>
      <div class="bd-modal-inner">
        <div class="bd-icon orange">${SVG.person}</div>
        ${badgeOrangeLive(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Welcome back, ${esc(firstName)}</h2>
        <p class="bd-body">Joining <span class="gname">${esc(groupName)}</span> now.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m00a-join">Join session</button>
          <button class="bd-small-link" id="m00a-notyou">Not you?</button>
        </div>
      </div>
    `);
    document.getElementById('m00a-join')?.addEventListener('click', () => showM06());
    document.getElementById('m00a-notyou')?.addEventListener('click', notYou);
  }

  /* ── M00b — Cookie · No Live ── */
  function showM00b() {
    const { groupName, cookieUser } = state;
    const firstName = cookieUser?.name?.split(' ')[0] ?? 'there';
    render('M00b', 'neutral', `
      <div class="bd-modal-id-label">M00b</div>
      <div class="bd-modal-inner">
        <div class="bd-icon neutral">${SVG.person}</div>
        ${badgeNeutral(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Welcome back, ${esc(firstName)}</h2>
        <p class="bd-body">Nothing live right now. Head to your dashboard to access your notes and study history.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m00b-dash">Go to dashboard</button>
          <button class="bd-small-link" id="m00b-notyou">Not you?</button>
        </div>
      </div>
    `);
    document.getElementById('m00b-dash')?.addEventListener('click', () => navigateTo('dashboard'));
    document.getElementById('m00b-notyou')?.addEventListener('click', notYou);
  }

  /* ── Not you? handler ── */
  function notYou() {
    clearCookie();
    state.isLive ? showM01() : showM07();
  }

  /* ── M01 — Live entry ── */
  function showM01() {
    const { groupName } = state;
    render('M01', 'orange', `
      <div class="bd-modal-id-label">M01</div>
      <div class="bd-modal-inner">
        <div class="bd-icon orange">${SVG.door}</div>
        ${badgeOrangeLive(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Join this session</h2>
        <p class="bd-body"><span class="gname">${esc(groupName)}</span> is live right now.</p>
        <nav class="bd-link-list" aria-label="Sign in options">
          <button class="bd-link-action" id="m01-signin">Sign in →</button>
          <button class="bd-link-action" id="m01-create">Create an account →</button>
          <button class="bd-small-link" id="m01-guest">Join as guest</button>
        </nav>
      </div>
    `);
    document.getElementById('m01-signin')?.addEventListener('click', () => apiSignIn('live'));
    document.getElementById('m01-create')?.addEventListener('click', () => navigateTo('create-account', true));
    document.getElementById('m01-guest')?.addEventListener('click', () => showM03('direct'));
  }

  /* ── M02 — Not in group (live) ── */
  function showM02(context) {
    const { groupName } = state;
    render('M02', 'orange', `
      <div class="bd-modal-id-label">M02</div>
      <div class="bd-modal-inner">
        <div class="bd-icon orange">${SVG.personX}</div>
        ${badgeOrangeLive(groupName)}
        <h2 class="bd-title" id="bd-modal-title">You're not in this group</h2>
        <p class="bd-body">Register for <span class="gname">${esc(groupName)}</span> to join as a member.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m02-register">Register for this group</button>
          <button class="bd-small-link" id="m02-guest">Join as guest</button>
        </div>
      </div>
    `);
    document.getElementById('m02-register')?.addEventListener('click', () => apiRegisterLive(context));
    document.getElementById('m02-guest')?.addEventListener('click', () => showM03('from-m02'));
  }

  /* ── M03 — Guest form ── */
  function showM03(context) {
    const { groupName } = state;
    render('M03', 'orange', `
      <div class="bd-modal-id-label">M03</div>
      <div class="bd-modal-inner">
        <div class="bd-icon orange">${SVG.person}</div>
        ${badgeOrangeLive(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Join as a guest</h2>
        <div class="bd-fields" role="form" aria-label="Guest information">
          <div class="bd-field">
            <label for="g-fname">First name <span aria-hidden="true">*</span></label>
            <input class="bd-inp" id="g-fname" type="text" placeholder="e.g. Jordan"
              autocomplete="given-name" autocapitalize="words" required>
          </div>
          <div class="bd-field">
            <label for="g-lname">Last name <span aria-hidden="true">*</span></label>
            <input class="bd-inp" id="g-lname" type="text" placeholder="e.g. Smith"
              autocomplete="family-name" autocapitalize="words" required>
          </div>
          <div class="bd-field">
            <label for="g-email1">Email address <span aria-hidden="true">*</span></label>
            <input class="bd-inp" id="g-email1" type="email" placeholder="e.g. jordan@email.com"
              autocomplete="email" autocapitalize="none" required>
            <span class="bd-err-msg" id="g-email1-err" role="alert">Please enter a valid email address.</span>
          </div>
          <div class="bd-field">
            <label for="g-email2">Confirm email address <span aria-hidden="true">*</span></label>
            <input class="bd-inp" id="g-email2" type="email" placeholder="Re-enter your email"
              autocomplete="email" autocapitalize="none" required>
            <span class="bd-err-msg" id="g-email2-err" role="alert">Email addresses don't match.</span>
          </div>
        </div>
        <div class="bd-guest-note" role="note">
          ${SVG.infoSm}
          <p>Joining as a guest means you <strong>won't have access to the study notes</strong> for this session.</p>
        </div>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-disabled" id="g-submit" disabled aria-disabled="true">Join session</button>
          <button class="bd-btn bd-btn-ghost" id="g-back">Back</button>
        </div>
      </div>
    `);

    // Wire form logic
    const fname  = document.getElementById('g-fname');
    const lname  = document.getElementById('g-lname');
    const email1 = document.getElementById('g-email1');
    const email2 = document.getElementById('g-email2');
    const submit = document.getElementById('g-submit');

    fname?.addEventListener('input',  () => { capField(fname);  validateGuest(); });
    lname?.addEventListener('input',  () => { capField(lname);  validateGuest(); });
    email1?.addEventListener('input', () => validateGuest());
    email2?.addEventListener('input', () => validateGuest());
    email1?.addEventListener('blur',  () => validateEmailField());
    email2?.addEventListener('blur',  () => validateConfirmField());

    submit?.addEventListener('click', () => {
      if (!submit.disabled) apiSubmitGuest();
    });

    document.getElementById('g-back')?.addEventListener('click', () => {
      context === 'from-m02' ? showM02() : showM01();
    });
  }

  /* ── M04 — Welcome back (teal, auto-advance) ── */
  function showM04() {
    const { groupName } = state;
    render('M04', 'teal', `
      <div class="bd-modal-id-label">M04</div>
      <div class="bd-modal-inner">
        <div class="bd-icon teal">${SVG.door}</div>
        ${badgeTeal(groupName, 'Verified')}
        <h2 class="bd-title" id="bd-modal-title">Welcome back</h2>
        <p class="bd-body">Joining <span class="gname">${esc(groupName)}</span> now.</p>
        ${dotsHtml()}
      </div>
    `);
    autoAdvance(() => navigateTo('session'));
  }

  /* ── M05 — You're all set (teal, auto-advance, registered member) ── */
  function showM05() {
    const { groupName } = state;
    render('M05', 'teal', `
      <div class="bd-modal-id-label">M05</div>
      <div class="bd-modal-inner">
        <div class="bd-icon teal">${SVG.door}</div>
        ${badgeTeal(groupName, 'Registered')}
        <h2 class="bd-title" id="bd-modal-title">You're all set</h2>
        <p class="bd-body">Joining <span class="gname">${esc(groupName)}</span> now.</p>
        ${dotsHtml()}
      </div>
    `);
    autoAdvance(() => navigateTo('session'));
  }

  /* ── M06 — Welcome / guest redirect (teal, auto-advance) ── */
  function showM06() {
    const { groupName } = state;
    render('M06', 'teal', `
      <div class="bd-modal-id-label">M06</div>
      <div class="bd-modal-inner">
        <div class="bd-icon teal">${SVG.door}</div>
        ${badgeTeal(groupName, 'Joining')}
        <h2 class="bd-title" id="bd-modal-title">Welcome</h2>
        <p class="bd-body">Joining <span class="gname">${esc(groupName)}</span> now.</p>
        ${dotsHtml()}
      </div>
    `);
    autoAdvance(() => navigateTo('session'));
  }

  /* ── M07 — No-live entry ── */
  function showM07() {
    const { groupName } = state;
    render('M07', 'neutral', `
      <div class="bd-modal-id-label">M07</div>
      <div class="bd-modal-inner">
        <div class="bd-icon neutral">${SVG.personPlus}</div>
        ${badgeNeutral(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Register for this group</h2>
        <p class="bd-body">Register to access study notes and history for <span class="gname">${esc(groupName)}</span>.</p>
        <nav class="bd-link-list" aria-label="Sign in options">
          <button class="bd-link-action" id="m07-signin">Sign in →</button>
          <button class="bd-link-action" id="m07-create">Create an account →</button>
          <button class="bd-small-link" id="m07-later">Maybe later</button>
        </nav>
      </div>
    `);
    document.getElementById('m07-signin')?.addEventListener('click', () => apiSignIn('nolive'));
    document.getElementById('m07-create')?.addEventListener('click', () => navigateTo('create-account', false));
    document.getElementById('m07-later')?.addEventListener('click', () => showM11());
  }

  /* ── M08 — Nothing live (member signed in) ── */
  function showM08() {
    const { groupName } = state;
    render('M08', 'neutral', `
      <div class="bd-modal-id-label">M08</div>
      <div class="bd-modal-inner">
        <div class="bd-icon neutral">${SVG.info}</div>
        ${badgeNeutral(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Nothing live right now</h2>
        <p class="bd-body">Head to your dashboard to access your notes and study history.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m08-dash">Go to dashboard</button>
        </div>
      </div>
    `);
    document.getElementById('m08-dash')?.addEventListener('click', () => navigateTo('dashboard'));
  }

  /* ── M09 — Register for group (no-live, not member) ── */
  function showM09() {
    const { groupName } = state;
    render('M09', 'neutral', `
      <div class="bd-modal-id-label">M09</div>
      <div class="bd-modal-inner">
        <div class="bd-icon neutral">${SVG.personPlus}</div>
        ${badgeNeutral(groupName, 'Nothing live')}
        <h2 class="bd-title" id="bd-modal-title">Register for this group</h2>
        <p class="bd-body">Register to access study notes and session history for <span class="gname">${esc(groupName)}</span>.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m09-register">Register for this group</button>
          <button class="bd-small-link" id="m09-later">Maybe later</button>
        </div>
      </div>
    `);
    document.getElementById('m09-register')?.addEventListener('click', () => apiRegisterNoLive());
    document.getElementById('m09-later')?.addEventListener('click', () => showM10());
  }

  /* ── M10 — Nothing live (maybe later) ── */
  function showM10() {
    const { groupName } = state;
    render('M10', 'neutral', `
      <div class="bd-modal-id-label">M10</div>
      <div class="bd-modal-inner">
        <div class="bd-icon neutral">${SVG.info}</div>
        ${badgeNeutral(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Nothing live right now</h2>
        <p class="bd-body">Head to your dashboard to access your notes and study history.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m10-dash">Go to dashboard</button>
        </div>
      </div>
    `);
    document.getElementById('m10-dash')?.addEventListener('click', () => navigateTo('dashboard'));
  }

  /* ── M11 — Nothing live (no account) ── */
  function showM11() {
    const { groupName } = state;
    render('M11', 'neutral', `
      <div class="bd-modal-id-label">M11</div>
      <div class="bd-modal-inner">
        <div class="bd-icon neutral">${SVG.info}</div>
        ${badgeNeutral(groupName)}
        <h2 class="bd-title" id="bd-modal-title">Nothing live right now</h2>
        <p class="bd-body">Sign in or create an account to stay connected.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m11-return">Return to Bible Dose</button>
        </div>
      </div>
    `);
    document.getElementById('m11-return')?.addEventListener('click', () => navigateTo('login'));
  }

  /* ── M12 — You're now a member (teal) ── */
  function showM12() {
    const { groupName } = state;
    render('M12', 'teal', `
      <div class="bd-modal-id-label">M12</div>
      <div class="bd-modal-inner">
        <div class="bd-icon teal">${SVG.check}</div>
        ${badgeTeal(groupName, 'Registered')}
        <h2 class="bd-title" id="bd-modal-title">You're now a member</h2>
        <p class="bd-body">You've joined <span class="gname">${esc(groupName)}</span>.</p>
        <div class="bd-actions">
          <button class="bd-btn bd-btn-primary" id="m12-dash">Go to dashboard</button>
        </div>
      </div>
    `);
    document.getElementById('m12-dash')?.addEventListener('click', () => navigateTo('dashboard'));
  }

  /* ──────────────────────────────────────────────
     TOAST
  ────────────────────────────────────────────── */
  function showToast(message, opts = {}) {
    /* opts: { type: 'error'|'info', duration: ms, action: { label, fn } } */
    const existing = document.getElementById('bd-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'bd-toast';

    const isError = opts.type === 'error';
    Object.assign(toast.style, {
      position:      'fixed',
      top:           '20px',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        '9999',
      fontFamily:    "'Poppins', sans-serif",
      fontSize:      '13px',
      fontWeight:    '500',
      color:         '#fff',
      background:    isError ? '#C0392B' : '#1E3A5F',
      padding:       '11px 16px',
      borderRadius:  '10px',
      boxShadow:     '0 6px 24px rgba(0,0,0,.28)',
      display:       'flex',
      alignItems:    'center',
      gap:           '10px',
      maxWidth:      '360px',
      width:         'calc(100% - 40px)',
      boxSizing:     'border-box',
      animation:     'bd-toast-in .22s ease',
    });

    // Inject keyframe once
    if (!document.getElementById('bd-toast-style')) {
      const s = document.createElement('style');
      s.id = 'bd-toast-style';
      s.textContent = `
        @keyframes bd-toast-in {
          from { opacity:0; transform:translateX(-50%) translateY(-8px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(s);
    }

    const msg = document.createElement('span');
    msg.style.flex = '1';
    msg.textContent = message;
    toast.appendChild(msg);

    if (opts.action) {
      const btn = document.createElement('button');
      btn.textContent = opts.action.label;
      Object.assign(btn.style, {
        fontFamily:   "'Poppins', sans-serif",
        fontSize:     '12px',
        fontWeight:   '700',
        color:        '#fff',
        background:   'rgba(255,255,255,.22)',
        border:       'none',
        borderRadius: '6px',
        padding:      '5px 10px',
        cursor:       'pointer',
        whiteSpace:   'nowrap',
        flexShrink:   '0',
      });
      btn.addEventListener('click', () => {
        toast.remove();
        opts.action.fn();
      });
      toast.appendChild(btn);
    }

    // Close on click anywhere on toast (if no action button was clicked)
    toast.addEventListener('click', (e) => {
      if (e.target !== toast.querySelector('button')) toast.remove();
    });

    document.body.appendChild(toast);

    const duration = opts.duration ?? (opts.action ? 8000 : 4000);
    setTimeout(() => toast?.remove(), duration);
  }

  /* ──────────────────────────────────────────────
     API CALLS  (REST — Node/Express backend)
  ────────────────────────────────────────────── */

  /**
   * POST /api/auth/signin
   * Body: { groupId }
   * Response: { success, user: { id, name }, isMember }
   * Called from M01 (live) and M07 (no-live)
   *
   * On failure: shows a toast with a "Continue as guest" recovery action
   * so the user is never left stranded — the flow can still proceed.
   */
  async function apiSignIn(context) {
    try {
      const res = await apiFetch('/auth/signin', { groupId: state.groupId });
      if (!res.success) throw new Error(res.error ?? 'Sign-in failed');

      setCookie({ name: res.user.name, userId: res.user.id });

      if (context === 'live') {
        res.isMember ? showM04() : showM02('signed-in');
      } else {
        res.isMember ? showM08() : showM09();
      }
    } catch (err) {
      console.error('[BibleDose] Sign-in error:', err);

      // Recovery options differ by context:
      // live  → offer "Join as guest" (M03) so they can still attend
      // nolive → offer "Maybe later"  (M11) — nothing live anyway
      if (context === 'live') {
        showToast("Couldn't sign in. You can still join as a guest.", {
          type:     'error',
          duration: 9000,
          action: {
            label: 'Join as guest',
            fn:    () => showM03('direct'),
          },
        });
      } else {
        showToast("Couldn't sign in. You can continue as a visitor.", {
          type:     'error',
          duration: 9000,
          action: {
            label: 'Continue',
            fn:    () => showM11(),
          },
        });
      }
    }
  }

  /**
   * POST /api/groups/:groupId/register
   * Body: { context: 'live' | 'nolive' }
   * Response: { success }
   * Called from M02 (live flow — register then join)
   */
  async function apiRegisterLive(context) {
    try {
      const res = await apiFetch(`/groups/${state.groupId}/register`, { context: 'live' });
      if (!res.success) throw new Error('Registration failed');
      showM05(); // S2 — member joins live session
    } catch (err) {
      console.error('[BibleDose] Register (live) error:', err);
    }
  }

  /**
   * POST /api/groups/:groupId/register
   * Body: { context: 'nolive' }
   * Response: { success }
   * Called from M09 (no-live flow)
   */
  async function apiRegisterNoLive() {
    try {
      const res = await apiFetch(`/groups/${state.groupId}/register`, { context: 'nolive' });
      if (!res.success) throw new Error('Registration failed');
      showM12(); // S6 / S8
    } catch (err) {
      console.error('[BibleDose] Register (no-live) error:', err);
    }
  }

  /**
   * POST /api/guest/join
   * Body: { groupId, firstName, lastName, email }
   * Response: { success, sessionToken }
   * Called from M03
   */
  async function apiSubmitGuest() {
    const firstName = document.getElementById('g-fname')?.value.trim();
    const lastName  = document.getElementById('g-lname')?.value.trim();
    const email     = document.getElementById('g-email1')?.value.trim();

    try {
      const res = await apiFetch('/guest/join', {
        groupId: state.groupId,
        firstName,
        lastName,
        email,
      });
      if (!res.success) throw new Error('Guest join failed');
      showM06(); // S3 / S4
    } catch (err) {
      console.error('[BibleDose] Guest join error:', err);
    }
  }

  /**
   * Generic fetch wrapper.
   * In dev mode, if no real API is connected, returns a mock response
   * based on the injected devState flags.
   */
  async function apiFetch(endpoint, body, method = 'POST') {
    // If running in dev/demo mode (no real backend), use mock
    if (window.__BD_DEV_MODE__) {
      return mockApiResponse(endpoint, body);
    }

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (method !== 'GET' && body !== null) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(API_BASE + endpoint, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /* ──────────────────────────────────────────────
     MOCK API (dev mode — no backend needed)
  ────────────────────────────────────────────── */
  function mockApiResponse(endpoint, body) {
    const cfg = window.__BD_DEV_CONFIG__ || {};

    if (endpoint.includes('/status')) {
      return {
        success:   true,
        isLive:    cfg.isLive    ?? false,
        groupName: cfg.groupName ?? 'The Good Soil',
      };
    }

    if (endpoint === '/auth/signin') {
      if (cfg.signInFails) throw new Error('Mock sign-in failure');
      /* isUser=false simulates anonymous visitor — sign-in shouldn't succeed */
      if (cfg.isUser === false) {
        return { success: false, error: 'not_authenticated' };
      }
      return {
        success:  true,
        user:     { id: 'u-dev-001', name: cfg.userName || 'Jordan Smith' },
        isMember: cfg.isMember !== undefined ? cfg.isMember : true,
      };
    }

    if (endpoint.includes('/register')) {
      return { success: true };
    }

    if (endpoint === '/guest/join') {
      return { success: true, sessionToken: 'mock-token' };
    }

    return { success: false };
  }

  /* ──────────────────────────────────────────────
     NAVIGATION
  ────────────────────────────────────────────── */
  function navigateTo(destination, isLiveContext) {
    const targets = {
      session:          '/session/' + (state.groupId ?? ''),
      dashboard:        'dashboard.html',
      login:            '/login',
      'create-account': '/create-account?returnGroup=' + (state.groupId ?? ''),
    };
    const url = targets[destination] ?? '/';

    if (window.__BD_DEV_MODE__) {
      console.info('[BibleDose] Navigate →', url);

      // Simulate post-account-creation return: keep overlay open, go to M09
      if (destination === 'create-account') {
        window.__BD_DEV_NOTIFY__?.('Simulating: account created → M09');
        setTimeout(() => {
          setCookie({ name: window.__BD_DEV_CONFIG__?.userName || 'New User', userId: 'u-new' });
          showM09();
        }, 600);
        return;
      }

      hideOverlay();
      window.__BD_DEV_NOTIFY__?.('Redirect → ' + url);
      return;
    }

    hideOverlay();
    window.location.href = url;
  }

  /* ──────────────────────────────────────────────
     FORM VALIDATION (M03)
  ────────────────────────────────────────────── */
  function capField(input) {
    if (!input) return;
    const pos = input.selectionStart;
    input.value = input.value.replace(/\b\w/g, c => c.toUpperCase());
    try { input.setSelectionRange(pos, pos); } catch (_) {}
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function validateEmailField() {
    const el  = document.getElementById('g-email1');
    const err = document.getElementById('g-email1-err');
    if (!el) return;
    const val = el.value.trim();
    if (val && !validEmail(val)) {
      el.classList.add('error');
      err?.classList.add('show');
    } else {
      el.classList.remove('error');
      err?.classList.remove('show');
    }
  }

  function validateConfirmField() {
    const el1  = document.getElementById('g-email1');
    const el2  = document.getElementById('g-email2');
    const err  = document.getElementById('g-email2-err');
    if (!el1 || !el2) return;
    const v1 = el1.value.trim();
    const v2 = el2.value.trim();
    if (v2 && v1 !== v2) {
      el2.classList.add('error');
      err?.classList.add('show');
    } else {
      el2.classList.remove('error');
      err?.classList.remove('show');
    }
  }

  function validateGuest() {
    validateEmailField();
    validateConfirmField();
    const fn  = document.getElementById('g-fname')?.value.trim();
    const ln  = document.getElementById('g-lname')?.value.trim();
    const e1  = document.getElementById('g-email1')?.value.trim();
    const e2  = document.getElementById('g-email2')?.value.trim();
    const btn = document.getElementById('g-submit');
    if (!btn) return;

    const ok = fn && ln && validEmail(e1) && validEmail(e2) && e1 === e2;
    btn.className   = 'bd-btn ' + (ok ? 'bd-btn-primary' : 'bd-btn-disabled');
    btn.disabled    = !ok;
    btn.setAttribute('aria-disabled', String(!ok));
  }

  /* ──────────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────────── */
  window.BibleDoseFlow = {
    trigger:   triggerGroupLink,
    hideModal: hideOverlay,
    // Expose individual modals for dev panel
    _showM00a: showM00a,
    _showM00b: showM00b,
    _showM01:  showM01,
    _showM02:  showM02,
    _showM03:  showM03,
    _showM04:  showM04,
    _showM05:  showM05,
    _showM06:  showM06,
    _showM07:  showM07,
    _showM08:  showM08,
    _showM09:  showM09,
    _showM10:  showM10,
    _showM11:  showM11,
    _showM12:  showM12,
    _state:    state,
  };

  /* ──────────────────────────────────────────────
     AUTO-START
     Reads context from:
       1. URL search params  (?groupId=...&live=1)
       2. data-* attributes on <script> or <body>
       3. window.BD_GROUP_CONFIG  (set by server-rendered page)
     Falls back to a safe no-op if none are found
     (dev panel will call trigger() manually instead).
  ────────────────────────────────────────────── */
  async function autoStart() {
    init(); // build overlay + modal shell

    // Dev panel present — it will call trigger() itself, skip auto-start
    if (window.__BD_DEV_MODE__) return;

    const opts = resolveStartOpts();

    // No group context found — nothing to trigger
    if (!opts.groupId) return;

    // If isLive is not explicitly provided, ask the API
    if (opts.isLive === undefined) {
      try {
        const res = await apiFetch('/groups/' + opts.groupId + '/status', null, 'GET');
        opts.isLive    = res.isLive    ?? false;
        opts.groupName = res.groupName ?? opts.groupName;
      } catch (_) {
        opts.isLive = false;
      }
    }

    triggerGroupLink(opts);
  }

  /**
   * Resolves group context from multiple possible sources.
   * Returns { groupId, groupName, isLive } — any may be undefined.
   */
  function resolveStartOpts() {
    // 1. URL params — e.g. /join?groupId=abc&live=1&group=The+Good+Soil
    const params    = new URLSearchParams(window.location.search);
    const urlGroup  = params.get('groupId') || params.get('group_id') || params.get('g');
    const urlName   = params.get('groupName') || params.get('group') || undefined;
    const urlLive   = params.has('live')
      ? params.get('live') !== '0' && params.get('live') !== 'false'
      : undefined;

    if (urlGroup) {
      return { groupId: urlGroup, groupName: urlName, isLive: urlLive };
    }

    // 2. Server-injected config object — set this from your template:
    //    <script> window.BD_GROUP_CONFIG = { groupId:'abc', groupName:'...', isLive:true }; </script>
    const injected = window.BD_GROUP_CONFIG;
    if (injected?.groupId) {
      return {
        groupId:   injected.groupId,
        groupName: injected.groupName,
        isLive:    injected.isLive,
      };
    }

    // 3. data-* on the script tag itself
    //    <script src="modal-flow-script.js" data-group-id="abc" data-live="true"></script>
    const scriptTag = document.currentScript
      || document.querySelector('script[data-group-id]');
    if (scriptTag?.dataset?.groupId) {
      return {
        groupId:   scriptTag.dataset.groupId,
        groupName: scriptTag.dataset.groupName,
        isLive:    scriptTag.dataset.live === 'true' ? true
                 : scriptTag.dataset.live === 'false' ? false
                 : undefined,
      };
    }

    // 4. Nothing found
    return {};
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart);
  } else {
    autoStart();
  }

})();