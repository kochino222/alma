// GamepadRig - Soporte de gamepad Bluetooth en móvil - Alma en Blanco
// Lee controles genéricos de Android con mapping NO estándar y ejes faltantes.
// Las funciones puras (deadzone, readRawPad) no tocan Phaser: testables headless.

// Índices de botones según el estándar X-Input (mapping === "standard").
// Un control Android genérico puede diferir: ajustá acá o usá el volcado de debug.
export const DEFAULT_BUTTON_MAP = {
  jump: 0,      // A / Cross
  interact: 1,  // B / Circle
  attack: 2,    // X / Square
  bomb: 3       // Y / Triangle
};

export const AXIS_CFG = {
  stickX: 0,          // eje horizontal del stick izquierdo
  stickY: 1,          // eje vertical del stick izquierdo
  hatX: 6,            // cruceta digital como "hat" en algunos pads Android (-1/0/1)
  hatY: 7,
  stickDeadzone: 0.25,
  hatDeadzone: 0.5
};

export const DPAD_BUTTONS = { up: 12, down: 13, left: 14, right: 15 };

// Devuelve 0 si |v| < threshold; si no, el valor crudo. Nunca lanza.
export function deadzone(v, threshold) {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.abs(v) < threshold ? 0 : v;
}

// Accesores defensivos: devuelven 0/false ante eje o botón ausente.
function axisValue(padLike, i) {
  const a = padLike && Array.isArray(padLike.axes) ? padLike.axes[i] : undefined;
  return typeof a === "number" ? a : (a && typeof a.value === "number" ? a.value : 0);
}

function buttonDown(padLike, i) {
  const b = padLike && Array.isArray(padLike.buttons) ? padLike.buttons[i] : undefined;
  if (!b) return false;
  if (typeof b === "boolean") return b;
  if (b.pressed !== undefined) return !!b.pressed;
  return (typeof b.value === "number" ? b.value : 0) > 0.5;
}

// Lee un pad-like ({ axes: number[], buttons: [{pressed,value}] }) y devuelve el
// fragmento de controles. NUNCA lanza aunque falten ejes o botones.
export function readRawPad(padLike, map = DEFAULT_BUTTON_MAP, cfg = AXIS_CFG) {
  if (!padLike) return null;

  const sx = deadzone(axisValue(padLike, cfg.stickX), cfg.stickDeadzone);
  const sy = deadzone(axisValue(padLike, cfg.stickY), cfg.stickDeadzone);
  const hx = deadzone(axisValue(padLike, cfg.hatX), cfg.hatDeadzone);
  const hy = deadzone(axisValue(padLike, cfg.hatY), cfg.hatDeadzone);

  // Cruceta como botones (estándar) y como hat (Android genérico), combinadas con OR.
  const dpadLeft = buttonDown(padLike, DPAD_BUTTONS.left) || hx < 0;
  const dpadRight = buttonDown(padLike, DPAD_BUTTONS.right) || hx > 0;
  const dpadUp = buttonDown(padLike, DPAD_BUTTONS.up) || hy < 0;
  const dpadDown = buttonDown(padLike, DPAD_BUTTONS.down) || hy > 0;

  return {
    left: sx < 0 || dpadLeft,
    right: sx > 0 || dpadRight,
    up: sy < 0 || dpadUp,
    down: sy > 0 || dpadDown,
    jump: buttonDown(padLike, map.jump),
    interact: buttonDown(padLike, map.interact),
    attack: buttonDown(padLike, map.attack),
    bomb: buttonDown(padLike, map.bomb)
  };
}

// Devuelve true si el pad está conectado. Acepta Phaser Gamepad o nativo.
function isConnected(source) {
  const native = source && (source.pad || source);
  return !!(native && native.connected !== false);
}

export class GamepadRig {
  constructor(scene) {
    this.scene = scene;
    this.pad = null;           // Phaser Gamepad o nativo
    this.connected = false;
    this.map = { ...DEFAULT_BUTTON_MAP };
    this._bindings = [];
    this._lastScan = 0;
    this.install();
  }

  install() {
    const scene = this.scene;
    const gp = scene.input && scene.input.gamepad;
    this.gamepad = gp || null;

    // Cebar la Gamepad API con gestos del usuario. Chrome/Android no devuelve
    // gamepads hasta una interacción (tap/tecla) o un botón del control.
    const prime = () => {
      try {
        if (navigator.getGamepads) navigator.getGamepads();
        if (navigator.webkitGetGamepads) navigator.webkitGetGamepads();
      } catch (err) { /* sin Gamepad API */ }
    };
    ["pointerdown", "touchstart", "keydown", "mousedown"].forEach(type => {
      const handler = () => prime();
      window.addEventListener(type, handler, { passive: true });
      this._bindings.push(() => window.removeEventListener(type, handler));
    });

    if (gp) {
      const onConnected = pad => {
        this.pad = pad;
        this.connected = true;
        this.log(pad);
      };
      const onDisconnected = pad => {
        if (this.pad && this.pad.index === pad.index) {
          this.pad = null;
          this.connected = false;
        }
      };
      // Eventos asíncronos del navegador, encolados y reemitidos por Phaser.
      gp.on("connected", onConnected, this);
      gp.on("disconnected", onDisconnected, this);
      this._bindings.push(() => {
        gp.off("connected", onConnected, this);
        gp.off("disconnected", onDisconnected, this);
      });
    }

    // El pad pudo conectarse antes de esta escena, o en móvil no emitir
    // 'connected' (solo aparece tras apretar un botón del control).
    this.scan();
  }

  log(pad) {
    const native = pad && pad.pad;
    console.info("[Alma][gamepad] conectado", {
      id: pad ? pad.id : null,
      mapping: native ? (native.mapping || "(vacío / no estándar)") : null,
      axes: native && native.axes ? native.axes.length : 0,
      buttons: native && native.buttons ? native.buttons.length : 0
    });
  }

  // Normaliza Phaser Gamepad (.pad) o nativo a un pad-like plano.
  toPadLike(source) {
    if (!source) return null;
    const native = source.pad || source;
    return {
      id: native.id || "",
      mapping: native.mapping || "",
      connected: native.connected !== false,
      axes: Array.isArray(native.axes)
        ? native.axes.map(a => (typeof a === "number" ? a : (a && typeof a.value === "number" ? a.value : 0)))
        : [],
      buttons: Array.isArray(native.buttons)
        ? native.buttons.map(b => ({
            pressed: !!(b && (b.pressed !== undefined ? b.pressed : (typeof b.value === "number" ? b.value > 0.5 : false))),
            value: b && typeof b.value === "number" ? b.value : 0
          }))
        : []
    };
  }

  // Busca el primer pad conectado: Phaser primero, luego navegador directo.
  scan() {
    if (this.pad && isConnected(this.pad)) return this.pad;
    const gp = this.gamepad;
    const phaserPad = gp && (gp.pad1 || (Array.isArray(gp.getAll()) ? gp.getAll().find(p => p && isConnected(p)) : null));
    if (phaserPad) { this.pad = phaserPad; this.connected = true; return phaserPad; }
    let native = null;
    try {
      const list = (navigator.getGamepads && navigator.getGamepads())
        || (navigator.webkitGetGamepads && navigator.webkitGetGamepads()) || [];
      native = Array.prototype.find.call(list, p => p && p.connected) || null;
    } catch (err) { native = null; }
    if (native) { this.pad = native; this.connected = true; }
    return native;
  }

  // Escaneo de respaldo, throttled a 1s (no golpear getGamepads por frame).
  throttledScan() {
    const now = performance.now();
    if (!this._lastScan || now - this._lastScan > 1000) {
      this._lastScan = now;
      this.scan();
    }
    return this.pad && isConnected(this.pad) ? this.pad : null;
  }

  // Devuelve el fragmento de controles, o null si no hay pad.
  read() {
    const pad = this.pad && isConnected(this.pad) ? this.pad : this.throttledScan();
    if (!pad) return null;
    return readRawPad(this.toPadLike(pad), this.map);
  }

  destroy() {
    this._bindings.forEach(remove => remove());
    this._bindings.length = 0;
    this.pad = null;
    this.connected = false;
    this.gamepad = null;
  }
}
