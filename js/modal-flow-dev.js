/* ============================================================
   BibleDose — Dev / Test Panel  v2
   modal-flow-dev.js
   ============================================================
   Panel de variables + modals individuales.
   Quitar este archivo en producción.
   ============================================================ */

(function () {
  'use strict';

  /* ── Estado global de prueba ── */
  window.__BD_DEV_MODE__   = true;
  window.__BD_DEV_CONFIG__ = {
    userName  : 'Jordan Smith',   // name shown in cookie welcome screen
    groupName : 'The Good Soil',  // group name shown across all modals
    hasCookie : false,            // does a session cookie exist on this device?
    isLive    : false,            // does the group have a live session right now?
    isUser    : false,            // does the visitor have an account?
    isMember  : false,            // are they a member of this group? (only if isUser=true)
  };

  /* ── Toast ── */
  window.__BD_DEV_NOTIFY__ = function (msg) {
    let t = document.getElementById('bd-dev-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'bd-dev-toast';
      Object.assign(t.style, {
        position:'fixed', top:'16px', right:'16px',
        background:'#142A47', color:'#fff',
        fontFamily:"'Poppins',sans-serif", fontSize:'11px', fontWeight:'600',
        padding:'8px 13px', borderRadius:'8px',
        boxShadow:'0 4px 18px rgba(0,0,0,.30)',
        zIndex:'9999', transition:'opacity .25s',
        maxWidth:'260px', lineHeight:'1.45', pointerEvents:'none',
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
  };

  /* ── Wait for BibleDoseFlow to be ready ── */
  function waitReady(cb) {
    function check() { window.BibleDoseFlow ? cb() : setTimeout(check, 40); }
    document.readyState !== 'loading' ? check()
      : document.addEventListener('DOMContentLoaded', check);
  }

  waitReady(buildPanel);

  /* ════════════════════════════════════════════════════════
     BUILD PANEL
  ════════════════════════════════════════════════════════ */
  function buildPanel() {
    const F = window.BibleDoseFlow;

    const panel = el('div', { id:'bd-dev-panel' });
    const tab   = buildTab();
    const body  = el('div', { id:'bd-dev-panel-body' });
    const inner = el('div', { className:'dev-panel-inner' });
    body.appendChild(inner);

    /* ── Sección 1: Variables ── */
    inner.appendChild(sectionTitle('Test variables'));
    inner.appendChild(buildVariables());

    inner.appendChild(sep());

    /* ── Sección 2: Botón lanzar ── */
    inner.appendChild(buildLaunchBtn(F));

    inner.appendChild(sep());

    /* ── Sección 3: Modals individuales ── */
    inner.appendChild(sectionTitle('Individual modals'));
    inner.appendChild(buildModalButtons(F));

    panel.appendChild(tab);
    panel.appendChild(body);
    document.body.appendChild(panel);

    /* Hover expand / collapse */
    panel.addEventListener('mouseenter', openPanel);
    panel.addEventListener('mouseleave', closePanel);
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.contains('open') ? closePanel() : openPanel();
    });
  }

  /* ════════════════════════════════════════════════════════
     TAB
  ════════════════════════════════════════════════════════ */
  function buildTab() {
    const tab = el('button', {
      id:'bd-dev-tab', type:'button',
      title:'Panel de desarrollo',
    });
    tab.setAttribute('aria-haspopup','true');
    tab.setAttribute('aria-expanded','false');
    tab.setAttribute('aria-controls','bd-dev-panel-body');
    tab.innerHTML =
      '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<circle cx="6" cy="6" r="4.5"/><path d="M4 6h4M6 4v4"/>' +
      '</svg>' +
      '<span>DEV</span>';
    return tab;
  }

  /* ════════════════════════════════════════════════════════
     VARIABLES SECTION
  ════════════════════════════════════════════════════════ */
  function buildVariables() {
    const wrap = el('div', { className:'dev-vars-wrap' });

    /* ── Nombre del usuario ── */
    wrap.appendChild(varBlock('User name',
      textInput('userName', 'Jordan Smith', (v) => {
        setCfg({ userName: v });
        if (cfg().hasCookie) applyCurrentCookie();
      })
    ));

    /* ── Nombre del grupo ── */
    wrap.appendChild(varBlock('Group name',
      textInput('groupName', 'The Good Soil', (v) => setCfg({ groupName: v }))
    ));

    /* ── Separador visual ── */
    const miniSep = el('div');
    miniSep.style.cssText = 'height:1px;background:rgba(255,255,255,.05);margin:4px 0;';
    wrap.appendChild(miniSep);

    /* ── Toggles ── */
    const toggles = [
      {
        key: 'hasCookie',
        label: 'Session cookie',
        hint: ['No cookie', 'Cookie set'],
        onChange: (v) => {
          setCfg({ hasCookie: v });
          v ? applyCurrentCookie() : clearDevCookie();
          notify(v ? '🍪 Cookie set' : '🚫 Cookie cleared');
        },
      },
      {
        key: 'isLive',
        label: 'Live session',
        hint: ['No session', 'Live 🔴'],
        onChange: (v) => {
          setCfg({ isLive: v });
          notify(v ? '🔴 Group is live' : '⚫ No live session');
        },
      },
      {
        key: 'isUser',
        label: 'Has an account',
        hint: ['Anonymous', 'Has account'],
        onChange: (v) => {
          setCfg({ isUser: v });
          if (!v) {
            setCfg({ isMember: false });
            syncToggle('isMember', false);
          }
          setMemberToggleEnabled(v);
          notify(v ? '👤 User with account' : '👻 Anonymous visitor');
        },
      },
      {
        key: 'isMember',
        label: 'Group member',
        hint: ['Not a member', 'Member ✓'],
        onChange: (v) => {
          setCfg({ isMember: v });
          notify(v ? '✅ Group member' : '❌ Not a member');
        },
        disabled: true,
      },
    ];

    toggles.forEach(t => wrap.appendChild(buildToggleRow(t)));

    return wrap;
  }

  /* ── Toggle row ── */
  function buildToggleRow({ key, label, hint, onChange, disabled }) {
    const row = el('div', { className:'dev-toggle-row' });
    if (disabled) row.classList.add('dev-toggle-row--disabled');
    row.dataset.toggleKey = key;

    const lbl = el('span', { className:'dev-toggle-label' });
    lbl.textContent = label;

    /* pill switch */
    const pill = el('div', { className:'dev-pill' });
    pill.dataset.pillKey = key;

    const knob = el('div', { className:'dev-pill-knob' });
    const hintEl = el('span', { className:'dev-pill-hint' });
    hintEl.textContent = hint[0];

    pill.appendChild(knob);
    pill.appendChild(hintEl);

    pill.addEventListener('click', () => {
      if (row.classList.contains('dev-toggle-row--disabled')) return;
      const next = !cfg()[key];
      setCfg({ [key]: next });
      updatePill(pill, next, hint);
      onChange(next);
    });

    row.appendChild(lbl);
    row.appendChild(pill);
    return row;
  }

  function updatePill(pill, isOn, hint) {
    const hintEl = pill.querySelector('.dev-pill-hint');
    if (isOn) {
      pill.classList.add('on');
      if (hintEl) hintEl.textContent = hint ? hint[1] : '';
    } else {
      pill.classList.remove('on');
      if (hintEl) hintEl.textContent = hint ? hint[0] : '';
    }
  }

  /* Sync a pill from outside (e.g. force isMember=false) */
  function syncToggle(key, value) {
    const pill = document.querySelector('[data-pill-key="' + key + '"]');
    if (!pill) return;
    /* find hint from the data we stored */
    const hints = {
      hasCookie : ['Sin cookie','Cookie activa'],
      isLive    : ['Sin sesión','En vivo 🔴'],
      isUser    : ['Anónimo','Con cuenta'],
      isMember  : ['No miembro','Miembro ✓'],
    };
    updatePill(pill, value, hints[key]);
  }

  function setMemberToggleEnabled(enabled) {
    const row = document.querySelector('[data-toggle-key="isMember"]');
    if (!row) return;
    enabled
      ? row.classList.remove('dev-toggle-row--disabled')
      : row.classList.add('dev-toggle-row--disabled');
  }

  /* ── Text input helper ── */
  function textInput(key, placeholder, onChange) {
    const inp = el('input');
    inp.type        = 'text';
    inp.placeholder = placeholder;
    inp.value       = cfg()[key] || placeholder;
    inp.className   = 'dev-text-inp';
    inp.addEventListener('input', () => onChange(inp.value));
    return inp;
  }

  /* ── varBlock wrapper ── */
  function varBlock(label, control) {
    const b = el('div', { className:'dev-var-block' });
    const l = el('div', { className:'dev-var-label' });
    l.textContent = label;
    b.appendChild(l);
    b.appendChild(control);
    return b;
  }

  /* ════════════════════════════════════════════════════════
     LAUNCH BUTTON
  ════════════════════════════════════════════════════════ */
  function buildLaunchBtn(F) {
    const wrap = el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const btn = el('button', { type:'button', className:'dev-launch-btn' });
    btn.textContent = '▶ Launch flow';

    const hint = el('p', { className:'dev-launch-hint' });
    updateLaunchHint(hint);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      launchFlow(F, hint);
    });

    /* reactualizar hint cuando cambien los toggles (live, cookie, etc) */
    document.addEventListener('bd-cfg-change', () => updateLaunchHint(hint));

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    return wrap;
  }

  function launchFlow(F, hintEl) {
    const c = cfg();
    const cookieUser = c.hasCookie
      ? { name: c.userName || 'Jordan Smith', userId: 'u-dev-001' }
      : null;

    if (c.hasCookie) applyCurrentCookie();
    else clearDevCookie();

    F.trigger({
      groupId   : 'g-dev-001',
      groupName : c.groupName || 'The Good Soil',
      isLive    : c.isLive,
      cookieUser,
    });

    updateLaunchHint(hintEl);
    notify('Flow launched → ' + resolveScenarioLabel(c));
  }

  function updateLaunchHint(el) {
    const c = cfg();
    el.textContent = resolveScenarioLabel(c);
  }

  function resolveScenarioLabel(c) {
    if (c.hasCookie && c.isLive)  return '→ M00a (cookie + live)';
    if (c.hasCookie && !c.isLive) return '→ M00b (cookie + no session)';
    if (!c.hasCookie && c.isLive) return '→ M01  (live, no cookie)';
    return '→ M07  (no session, no cookie)';
  }

  /* ════════════════════════════════════════════════════════
     MODAL BUTTONS
  ════════════════════════════════════════════════════════ */
  function buildModalButtons(F) {
    const wrap = el('div', { className:'dev-modal-grid' });

    const modals = [
      { id:'M00a', color:'orange', fn: () => { applyUserName(); F._state.cookieUser={name:cfg().userName||'Jordan Smith'}; F._state.isLive=true;  showThen(F._showM00a); } },
      { id:'M00b', color:'neutral',fn: () => { applyUserName(); F._state.cookieUser={name:cfg().userName||'Jordan Smith'}; F._state.isLive=false; showThen(F._showM00b); } },
      { id:'M01',  color:'orange', fn: () => { applyGroupName(); F._state.cookieUser=null; F._state.isLive=true;  showThen(F._showM01); } },
      { id:'M02',  color:'orange', fn: () => { applyGroupName(); F._state.isLive=true;  showThen(F._showM02); } },
      { id:'M03',  color:'orange', fn: () => { applyGroupName(); F._state.isLive=true;  showThen(() => F._showM03('direct')); } },
      { id:'M04',  color:'teal',   fn: () => { applyGroupName(); showThen(F._showM04); } },
      { id:'M05',  color:'teal',   fn: () => { applyGroupName(); showThen(F._showM05); } },
      { id:'M06',  color:'teal',   fn: () => { applyGroupName(); showThen(F._showM06); } },
      { id:'M07',  color:'neutral',fn: () => { applyGroupName(); F._state.cookieUser=null; F._state.isLive=false; showThen(F._showM07); } },
      { id:'M08',  color:'neutral',fn: () => { applyGroupName(); showThen(F._showM08); } },
      { id:'M09',  color:'neutral',fn: () => { applyGroupName(); showThen(F._showM09); } },
      { id:'M10',  color:'neutral',fn: () => { applyGroupName(); showThen(F._showM10); } },
      { id:'M11',  color:'neutral',fn: () => { applyGroupName(); showThen(F._showM11); } },
      { id:'M12',  color:'teal',   fn: () => { applyGroupName(); showThen(F._showM12); } },
    ];

    modals.forEach(({ id, color, fn }) => {
      const btn = el('button', { type:'button', className:'dev-modal-btn dev-modal-btn--' + color });
      btn.innerHTML = '<span class="dev-modal-id">' + id + '</span>';
      btn.addEventListener('click', (e) => { e.stopPropagation(); fn(); notify('Modal ' + id); });
      wrap.appendChild(btn);
    });

    return wrap;
  }

  /* ════════════════════════════════════════════════════════
     PANEL OPEN / CLOSE
  ════════════════════════════════════════════════════════ */
  function openPanel() {
    const panel = document.getElementById('bd-dev-panel');
    const tab   = document.getElementById('bd-dev-tab');
    panel?.classList.add('open');
    tab?.setAttribute('aria-expanded','true');
  }
  function closePanel() {
    const panel = document.getElementById('bd-dev-panel');
    const tab   = document.getElementById('bd-dev-tab');
    panel?.classList.remove('open');
    tab?.setAttribute('aria-expanded','false');
  }

  /* ════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════ */
  function cfg()   { return window.__BD_DEV_CONFIG__ || {}; }
  function setCfg(o) {
    Object.assign(window.__BD_DEV_CONFIG__, o);
    document.dispatchEvent(new Event('bd-cfg-change'));
  }
  function notify(m) { window.__BD_DEV_NOTIFY__?.(m); }

  function applyCurrentCookie() {
    const v = encodeURIComponent(JSON.stringify({
      name: cfg().userName || 'Jordan Smith',
      userId: 'u-dev-001',
    }));
    document.cookie = 'bd_session=' + v + '; Max-Age=2592000; path=/; SameSite=Lax';
  }

  function clearDevCookie() {
    document.cookie = 'bd_session=; Max-Age=0; path=/';
  }

  function applyUserName() {
    const F = window.BibleDoseFlow;
    if (F) F._state.groupName = cfg().groupName || 'The Good Soil';
  }

  function applyGroupName() {
    const F = window.BibleDoseFlow;
    if (F) F._state.groupName = cfg().groupName || 'The Good Soil';
  }

  function showThen(fn) {
    const overlay = document.getElementById('bd-overlay');
    if (overlay && !overlay.classList.contains('is-visible')) {
      overlay.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
    }
    if (typeof fn === 'function') fn();
  }

  /* ── DOM factory ── */
  function el(tag, props = {}) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else node[k] = v;
    });
    return node;
  }

  function sep() {
    const d = document.createElement('div');
    d.className = 'dev-sep';
    return d;
  }

  function sectionTitle(text) {
    const d = document.createElement('div');
    d.className = 'dev-section-title';
    d.textContent = text;
    return d;
  }

})();
