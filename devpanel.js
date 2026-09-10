// DevPanel - Panel de desarrollo para Alma en Blanco
// Se carga solo si localStorage.devMode === '1' (ver juego.js)
// 10 taps/clicks rápidos (< 2s) en el badge abre/ciérra el panel.
// Para build publicable: borrar esta importación o poner localStorage.devMode = '0'

(() => {
  // ======== ESTADO ========
  const state = {
    open: false,
    taps: 0,
    lastTap: 0,
    game: null,
    scene: null,
    params: {
      gravity: 800,
      playerSpeed: 150,
      jumpSpeed: 382,
      dashSpeed: 400,
      coins: 0,
      bombs: 3,
      hp: 5,
      maxHp: 5,
      featherBoots: false,
      creditPact: false,
      guardianMirror: false,
      sacrificeDaggerUsed: false,
      certaintyAnchor: false,
      bottledPyre: false,
      amnesiaReady: false,
      doubleJumpLaw: false,
      willInertiaLaw: false,
      selectiveAmnesiaLaw: false,
    },
    elements: {},
  };

  // ======== UTILIDADES ========
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    children.forEach(c => el.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return el;
  }

  function loadParams() {
    try {
      const saved = localStorage.getItem('devPanelParams');
      if (saved) Object.assign(state.params, JSON.parse(saved));
    } catch {}
  }

  function saveParams() {
    localStorage.setItem('devPanelParams', JSON.stringify(state.params));
  }

  function applyParams() {
    if (!state.scene) return;
    const s = state.scene;
    const p = state.params;

    // Gravedad
    s.physics.world.gravity.y = Math.round(p.gravity * (s.debtMass || 1));

    // Stats jugador
    if (s.player?.body) {
      s.player.body.setMaxVelocity(300, 620 + p.gravity * 0.01);
    }

    // Monedas, bombas, HP
    s.coins = p.coins;
    s.bombs = p.bombs;
    s.hp = Math.min(p.hp, p.maxHp);
    s.maxHp = p.maxHp;

    // Flags booleanos
    s.featherBoots = p.featherBoots;
    s.creditPact = p.creditPact;
    s.guardianMirror = p.guardianMirror;
    s.sacrificeDaggerUsed = p.sacrificeDaggerUsed;
    s.certaintyAnchor = p.certaintyAnchor;
    s.bottledPyre = p.bottledPyre;
    s.amnesiaReady = p.amnesiaReady;

    // Leyes (meta)
    if (s.meta) {
      s.meta.laws = s.meta.laws || {};
      s.meta.laws.doubleJump = p.doubleJumpLaw;
      s.meta.laws.willInertia = p.willInertiaLaw;
      s.meta.laws.selectiveAmnesia = p.selectiveAmnesiaLaw;
    }

    // Actualizar HUD
    if (s.updateHud) s.updateHud(performance.now(), 16);

    saveParams();
  }

  function readCurrentParams() {
    if (!state.scene) return;
    const s = state.scene;
    state.params.gravity = s.physics.world.gravity.y / (s.debtMass || 1);
    state.params.coins = s.coins;
    state.params.bombs = s.bombs;
    state.params.hp = s.hp;
    state.params.maxHp = s.maxHp;
    state.params.featherBoots = s.featherBoots;
    state.params.creditPact = s.creditPact;
    state.params.guardianMirror = s.guardianMirror;
    state.params.sacrificeDaggerUsed = s.sacrificeDaggerUsed;
    state.params.certaintyAnchor = s.certaintyAnchor;
    state.params.bottledPyre = s.bottledPyre;
    state.params.amnesiaReady = s.amnesiaReady;
    if (s.meta?.laws) {
      state.params.doubleJumpLaw = s.meta.laws.doubleJump;
      state.params.willInertiaLaw = s.meta.laws.willInertia;
      state.params.selectiveAmnesiaLaw = s.meta.laws.selectiveAmnesia;
    }
    syncUI();
  }

  // ======== UI ========
  function createBadge() {
    const badge = createEl('div', {
      id: 'dev-badge',
      style: {
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        zIndex: '999999',
        background: 'rgba(0,0,0,0.75)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '4px 8px',
        borderRadius: '4px',
        border: '1px solid #0f0',
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'manipulation',
        lineHeight: '1.2',
      },
      onClick: onBadgeTap,
      onTouchEnd: onBadgeTap,
    }, [`v${getShortCommit()} ${getBranch()}`]);

    document.body.appendChild(badge);
    state.elements.badge = badge;
  }

  function getShortCommit() {
    // Intentar leer de un meta tag o usar fallback
    const meta = document.querySelector('meta[name="build-commit"]');
    return meta?.content?.slice(0, 7) || 'dev';
  }

  function getBranch() {
    const meta = document.querySelector('meta[name="build-branch"]');
    return meta?.content || 'unknown';
  }

  function onBadgeTap(e) {
    e.preventDefault();
    const now = Date.now();
    if (now - state.lastTap < 2000) {
      state.taps++;
    } else {
      state.taps = 1;
    }
    state.lastTap = now;

    if (state.taps >= 10) {
      state.taps = 0;
      togglePanel();
    }
  }

  function createPanel() {
    const panel = createEl('div', {
      id: 'dev-panel',
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '1000000',
        background: 'rgba(10,10,15,0.98)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #0f0',
        boxShadow: '0 0 30px rgba(0,255,0,0.3)',
        maxWidth: '90vw',
        maxHeight: '85vh',
        overflow: 'auto',
        display: 'none',
      },
    });

    // Header
    const header = createEl('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #0f0', paddingBottom: '8px' },
    }, [
      createEl('strong', {}, ['⚙️ DevPanel — Alma en Blanco']),
      createEl('button', {
        style: { background: 'none', border: '1px solid #f44', color: '#f44', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' },
        onClick: () => togglePanel(),
      }, ['✕ Cerrar']),
    ]);

    // Grid de controles
    const grid = createEl('div', { style: { display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' } });

    // Helper para crear controles
    function addControl(label, type, key, opts = {}) {
      const wrapper = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      wrapper.appendChild(createEl('label', { style: { fontSize: '11px', color: '#aaa' } }, [label]));

      let input;
      if (type === 'number') {
        input = createEl('input', {
          type: 'number',
          value: state.params[key],
          min: opts.min ?? 0,
          max: opts.max ?? 9999,
          step: opts.step ?? 1,
          style: { background: '#111', border: '1px solid #333', color: '#0f0', padding: '4px 8px', borderRadius: '3px', width: '100%' },
          onChange: e => { state.params[key] = Number(e.target.value); applyParams(); },
          onInput: e => { state.params[key] = Number(e.target.value); applyParams(); },
        });
      } else if (type === 'checkbox') {
        input = createEl('input', {
          type: 'checkbox',
          checked: state.params[key],
          style: { accentColor: '#0f0', width: '18px', height: '18px' },
          onChange: e => { state.params[key] = e.target.checked; applyParams(); },
        });
        wrapper.style.flexDirection = 'row';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        wrapper.insertBefore(input, wrapper.firstChild);
      } else if (type === 'button') {
        input = createEl('button', {
          style: { background: '#030', border: '1px solid #0f0', color: '#0f0', padding: '6px', borderRadius: '3px', cursor: 'pointer' },
          onClick: opts.onClick,
        }, [label]);
        wrapper.style.flexDirection = 'row';
        wrapper.appendChild(input);
        return wrapper; // early return
      }
      wrapper.appendChild(input);
      state.elements[key] = input;
      grid.appendChild(wrapper);
      return wrapper;
    }

    // ======== CONTROLES ========
    // Física
    addControl('Gravedad (BASE_GRAVITY)', 'number', 'gravity', { min: 100, max: 3000, step: 10 });
    addControl('Velocidad jugador', 'number', 'playerSpeed', { min: 50, max: 600, step: 10 });
    addControl('Velocidad salto', 'number', 'jumpSpeed', { min: 200, max: 1000, step: 10 });
    addControl('Velocidad dash', 'number', 'dashSpeed', { min: 200, max: 1200, step: 10 });

    // Recursos
    addControl('Monedas', 'number', 'coins', { min: 0, max: 999, step: 1 });
    addControl('Bombas', 'number', 'bombs', { min: 0, max: 99, step: 1 });
    addControl('HP actual', 'number', 'hp', { min: 1, max: 99, step: 1 });
    addControl('HP máximo', 'number', 'maxHp', { min: 1, max: 99, step: 1 });

    // Flags
    addControl('Botas de pluma', 'checkbox', 'featherBoots');
    addControl('Pacto de crédito', 'checkbox', 'creditPact');
    addControl('Espejo guardián', 'checkbox', 'guardianMirror');
    addControl('Daga sacrificio usada', 'checkbox', 'sacrificeDaggerUsed');
    addControl('Ancla certeza', 'checkbox', 'certaintyAnchor');
    addControl('Piro embotellado', 'checkbox', 'bottledPyre');
    addControl('Amnesia selectiva (ready)', 'checkbox', 'amnesiaReady');

    // Leyes
    addControl('Ley: Doble salto', 'checkbox', 'doubleJumpLaw');
    addControl('Ley: Inercia de voluntad', 'checkbox', 'willInertiaLaw');
    addControl('Ley: Amnesia selectiva', 'checkbox', 'selectiveAmnesiaLaw');

    // Acciones
    addControl('Leer valores actuales del juego', 'button', '', { onClick: readCurrentParams });
    addControl('Aplicar todo', 'button', '', { onClick: applyParams });
    addControl('Resetear a defaults', 'button', '', { onClick: () => { resetDefaults(); applyParams(); } });

    panel.appendChild(header);
    panel.appendChild(grid);

    // Overlay para cerrar click fuera
    const overlay = createEl('div', {
      id: 'dev-panel-overlay',
      style: {
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.5)', zIndex: '999999', display: 'none',
        onClick: () => togglePanel(),
      },
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    state.elements.panel = panel;
    state.elements.overlay = overlay;
  }

  function togglePanel() {
    if (!state.elements.panel) createPanel();
    state.open = !state.open;
    state.elements.panel.style.display = state.open ? 'block' : 'none';
    state.elements.overlay.style.display = state.open ? 'block' : 'none';
    if (state.open) {
      readCurrentParams();
      syncUI();
    }
  }

  function syncUI() {
    Object.entries(state.params).forEach(([k, v]) => {
      const el = state.elements[k];
      if (el) {
        if (el.type === 'checkbox') el.checked = v;
        else el.value = v;
      }
    });
  }

  function resetDefaults() {
    state.params = {
      gravity: 800,
      playerSpeed: 150,
      jumpSpeed: 382,
      dashSpeed: 400,
      coins: 0,
      bombs: 3,
      hp: 5,
      maxHp: 5,
      featherBoots: false,
      creditPact: false,
      guardianMirror: false,
      sacrificeDaggerUsed: false,
      certaintyAnchor: false,
      bottledPyre: false,
      amnesiaReady: false,
      doubleJumpLaw: false,
      willInertiaLaw: false,
      selectiveAmnesiaLaw: false,
    };
    syncUI();
  }

  // ======== INIT ========
  function init() {
    loadParams();
    createBadge();

    // Esperar a que el juego exista
    const checkGame = setInterval(() => {
      if (window.__BLANK_SOUL_GAME__?.scene?.scenes?.length) {
        state.game = window.__BLANK_SOUL_GAME__;
        state.scene = state.game.scene.scenes.find(s => s.scene.key === 'Game');
        if (state.scene) {
          clearInterval(checkGame);
          readCurrentParams();
        }
      }
    }, 500);

    // Cleanup al recargar
    window.addEventListener('beforeunload', () => saveParams());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();