// ControlRig - Controles multitáctil/nativos - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { AUDIO } from "../audio/AudioEngine.js";
import { screenW, screenH, clamp } from "../core/utils.js";
import { VIEW_W, VIEW_H } from "../core/constantes.js";

export class ControlRig {
  constructor(scene) {
    this.scene = scene;
    this.virtual = { left: false, right: false, up: false, down: false, jump: false, interact: false, attack: false, bomb: false };
    this.previous = { jump: false, interact: false, attack: false, bomb: false };
    this.pointerAssignments = new Map();
    this.releaseHandlers = [];
    this.nativeListeners = [];
    this.useNativePointers = typeof window.PointerEvent === "function";
    this.facing = 1;
    this.touchVisible = false;
    this.keys = scene.input.keyboard.addKeys({
      left: "LEFT",
      right: "RIGHT",
      up: "UP",
      down: "DOWN",
      a: "A",
      d: "D",
      w: "W",
      s: "S",
      jump: "SPACE",
      interact: "E",
      attack: "SHIFT",
      bomb: "Q"
    });
    this.makeTouchControls();
    this.installPointerCapture();
    this.refreshTouchVisibility();
    scene.scale.on("resize", this.onResize, this);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.releaseAll, this);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
    scene.events.on(Phaser.Scenes.Events.SLEEP, this.releaseAll, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  makeTouchControls() {
    const scene = this.scene;
    this.container = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    this.container.setAlpha(0.82);
    this.buttons = [];

    const makeButton = (id, x, y, r, label, color) => {
      const c = scene.add.circle(x, y, r, color, 0.22).setStrokeStyle(2, color, 0.72);
      const t = scene.add.text(x, y, label, {
        fontFamily: "monospace",
        fontSize: `${Math.max(15, r * 0.45)}px`,
        color: "#effcff"
      }).setOrigin(0.5);
      const zone = scene.add.zone(x, y, r * 2, r * 2).setOrigin(0.5);
      const hitArea = new Phaser.Geom.Circle(r, r, r);
      zone.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
      zone.input.cursor = "pointer";
      const button = { id, c, t, zone, color, pointerId: null, touchId: null, x, y, r, hitRadius: r };
      const pointerKey = pointer => String(pointer.id);
      const press = pointer => {
        if (!this.touchVisible || pointer?.id === undefined) return;
        if (pointer.event?.cancelable) pointer.event.preventDefault();
        const key = pointerKey(pointer);
        if (button.pointerId !== null || this.pointerAssignments.has(key)) return;
        button.pointerId = key;
        button.touchId = pointer.identifier ?? null;
        this.pointerAssignments.set(key, id);
        AUDIO.unlock();
        this.virtual[id] = true;
        c.setFillStyle(color, 0.9).setStrokeStyle(3, 0xffffff, 1).setScale(1.14);
        t.setColor("#071014").setScale(1.1);
      };
      const release = pointer => {
        const key = pointer ? pointerKey(pointer) : button.pointerId;
        if (button.pointerId === null || key !== button.pointerId) return;
        this.pointerAssignments.delete(key);
        button.pointerId = null;
        button.touchId = null;
        this.virtual[id] = false;
        c.setFillStyle(color, 0.22).setStrokeStyle(2, color, 0.72).setScale(1);
        t.setColor("#effcff").setScale(1);
        if (key.startsWith("native:")) {
          const nativeId = Number(key.slice(7));
          const canvas = scene.game.canvas;
          if (canvas.hasPointerCapture?.(nativeId)) canvas.releasePointerCapture(nativeId);
        }
      };
      button.press = press;
      button.release = release;
      // Native Pointer IDs and Phaser pointer slots are distinct namespaces.
      if (!this.useNativePointers) zone.on("pointerdown", press);
      zone.on("pointerup", release);
      zone.on("pointerupoutside", release);
      zone.on("pointercancel", release);
      scene.input.on("pointerup", release);
      scene.input.on("pointerupoutside", release);
      scene.input.on("pointercancel", release);
      this.releaseHandlers.push(release);
      this.container.add([c, t, zone]);
      this.buttons.push(button);
      return button;
    };

    makeButton("left", 78, VIEW_H - 82, 42, "<", 0x9dfcff);
    makeButton("right", 174, VIEW_H - 82, 42, ">", 0x9dfcff);
    makeButton("up", 126, VIEW_H - 132, 32, "^", 0x9dfcff);
    makeButton("down", 126, VIEW_H - 36, 32, "v", 0x9dfcff);
    makeButton("jump", VIEW_W - 204, VIEW_H - 92, 48, "↥", 0xf7fbff);
    makeButton("interact", VIEW_W - 112, VIEW_H - 138, 38, "E", 0x8af0b0);
    makeButton("attack", VIEW_W - 78, VIEW_H - 60, 42, "»", 0xffb14a);
    makeButton("bomb", VIEW_W - 170, VIEW_H - 54, 34, "💣", 0xff6b55);
    this.layoutTouchControls();
  }

  onResize() {
    this.releaseAll();
    this.layoutTouchControls();
    this.refreshTouchVisibility();
  }

  refreshTouchVisibility() {
    const fineHover = window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
    const hasTouch = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !fineHover);
    const small = screenW(this.scene) < 640 || screenH(this.scene) < 460;
    this.touchVisible = hasTouch || small;
    if (!this.touchVisible) this.releaseAll();
    if (this.container) this.container.setVisible(this.touchVisible);
  }

  layoutTouchControls() {
    if (!this.buttons) return;
    const sw = screenW(this.scene);
    const safe = window.getComputedStyle(document.documentElement);
    const sh = screenH(this.scene) - (parseFloat(safe.getPropertyValue("--safe-bottom")) || 0);
    const base = clamp(Math.min(sw * 0.085, sh * 0.09), 24, 40);
    const pad = 10 + Math.max(parseFloat(safe.getPropertyValue("--safe-left")) || 0, parseFloat(safe.getPropertyValue("--safe-right")) || 0);
    const bottomPad = 10;
    const dpadX = pad + base * 2.55;
    const dpadY = sh - bottomPad - base * 2.8;
    const positions = {
      left: [dpadX - base * 1.5, dpadY, base * 0.88],
      right: [dpadX + base * 1.5, dpadY, base * 0.88],
      up: [dpadX, dpadY - base * 1.8, base * 0.64],
      down: [dpadX, dpadY + base * 1.8, base * 0.64],
      jump: [sw - pad - base * 1.3, sh - bottomPad - base * 1.8, base * 1.08],
      interact: [sw - pad - base * 4, sh - bottomPad - base, base * 0.78],
      attack: [sw - pad - base * 3.3, sh - bottomPad - base * 4.2, base * 0.84]
      ,bomb: [sw - pad - base * 0.75, sh - bottomPad - base * 4.3, base * 0.72]
    };
    this.buttons.forEach(button => {
      const next = positions[button.id];
      if (!next) return;
      const [x, y, r] = next;
      const hitRadius = r + Math.max(8, base * 0.27);
      Object.assign(button, { x, y, r, hitRadius });
      button.c.setPosition(x, y);
      button.c.setRadius(r);
      button.t.setPosition(x, y);
      button.t.setFontSize(Math.max(14, Math.round(r * 0.45)));
      button.zone.setPosition(x, y);
      button.zone.setSize(hitRadius * 2, hitRadius * 2);
      button.zone.updateDisplayOrigin();
      if (button.zone.input && button.zone.input.hitArea) {
        button.zone.input.hitArea.setTo(hitRadius, hitRadius, hitRadius);
      }
    });
  }

  installPointerCapture() {
    const canvas = this.scene.game.canvas;
    const listen = (target, event, handler) => {
      target.addEventListener(event, handler, { passive: false });
      this.nativeListeners.push(() => target.removeEventListener(event, handler));
    };
    if (this.useNativePointers) {
      listen(canvas, "pointerdown", event => {
        if (!this.touchVisible || (event.pointerType === "mouse" && event.button !== 0)) return;
        const bounds = canvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * this.scene.scale.width / bounds.width;
        const y = (event.clientY - bounds.top) * this.scene.scale.height / bounds.height;
        const button = this.buttons.find(b => Phaser.Geom.Circle.Contains(b.zone.input.hitArea,
          x - b.x + b.hitRadius, y - b.y + b.hitRadius));
        if (!button) return;
        if (event.cancelable) event.preventDefault();
        button.press({ id: `native:${event.pointerId}`, event });
        if (this.pointerAssignments.has(`native:${event.pointerId}`)) {
          try { canvas.setPointerCapture(event.pointerId); } catch (error) {}
        }
      });
      const release = event => {
        const key = `native:${event.pointerId}`;
        const button = this.buttons.find(b => b.pointerId === key);
        if (!button) return;
        if (event.cancelable) event.preventDefault();
        button.release({ id: key });
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      listen(window, "pointerup", release);
      listen(window, "pointercancel", release);
      listen(canvas, "lostpointercapture", release);
      listen(canvas, "touchstart", event => {
        const bounds = canvas.getBoundingClientRect();
        for (const touch of event.changedTouches || []) {
          const x = (touch.clientX - bounds.left) * this.scene.scale.width / bounds.width;
          const y = (touch.clientY - bounds.top) * this.scene.scale.height / bounds.height;
          const button = this.buttons.find(b => b.pointerId !== null && b.touchId === null &&
            Phaser.Geom.Circle.Contains(b.zone.input.hitArea, x - b.x + b.hitRadius, y - b.y + b.hitRadius));
          if (button) button.touchId = touch.identifier;
        }
      });
    }
    const releaseTouches = event => {
      for (const touch of event.changedTouches || []) {
        const button = this.buttons.find(b => b.touchId === touch.identifier);
        if (button) button.release();
      }
    };
    listen(window, "touchend", releaseTouches);
    listen(window, "touchcancel", releaseTouches);
    listen(window, "blur", () => this.releaseAll());
    listen(document, "visibilitychange", () => { if (document.hidden) this.releaseAll(); });
  }

  releaseAll() {
    this.buttons?.forEach(button => button.release());
    for (const id of Object.keys(this.virtual)) this.virtual[id] = false;
    for (const id of Object.keys(this.previous)) this.previous[id] = false;
  }

  read() {
    const k = this.keys;
    const leftKey = k.left.isDown || k.a.isDown;
    const rightKey = k.right.isDown || k.d.isDown;
    const upKey = k.up.isDown || k.w.isDown;
    const downKey = k.down.isDown || k.s.isDown;
    const jump = k.jump.isDown || this.virtual.jump;
    const interact = k.interact.isDown || this.virtual.interact;
    const attack = k.attack.isDown || this.virtual.attack;
    const bomb = k.bomb.isDown || this.virtual.bomb;
    const left = leftKey || this.virtual.left;
    const right = rightKey || this.virtual.right;
    const up = upKey || this.virtual.up;
    const down = downKey || this.virtual.down;
    const out = {
      left,
      right,
      up,
      down,
      axis: (right ? 1 : 0) - (left ? 1 : 0),
      jump,
      jumpPressed: jump && !this.previous.jump,
      jumpReleased: !jump && this.previous.jump,
      interact,
      interactPressed: interact && !this.previous.interact,
      interactReleased: !interact && this.previous.interact,
      attack,
      attackPressed: attack && !this.previous.attack,
      bomb,
      bombPressed: bomb && !this.previous.bomb
    };
    this.previous.jump = jump;
    this.previous.interact = interact;
    this.previous.attack = attack;
    this.previous.bomb = bomb;
    if (out.axis !== 0) this.facing = Math.sign(out.axis);
    out.facing = this.facing;
    return out;
  }

  destroy() {
    this.releaseAll();
    this.nativeListeners.forEach(remove => remove());
    this.nativeListeners.length = 0;
    this.scene.scale.off("resize", this.onResize, this);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.releaseAll, this);
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
    this.scene.events.off(Phaser.Scenes.Events.SLEEP, this.releaseAll, this);
    this.releaseHandlers.forEach(handler => {
      this.scene.input.off("pointerup", handler);
      this.scene.input.off("pointerupoutside", handler);
      this.scene.input.off("pointercancel", handler);
    });
    this.releaseHandlers.length = 0;
    this.pointerAssignments.clear();
  }
}