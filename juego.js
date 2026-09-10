// Alma en Blanco - modulo principal.
// Fase 1 del refactor a ES Modules (ver hermes/plan-refactor.md).
//
// El IIFE que envolvia TODO este archivo fue reemplazado por el scope de modulo:
// mismo aislamiento (nada es global salvo lo que se asigna explicitamente a window),
// pero ahora los bloques se pueden exportar e importar. Es la base de la Fase 2.
//
// Notas de esta fase:
//   - Se quito "use strict": los modulos ES ya son estrictos por definicion.
//   - La indentacion de 4 espacios se conserva a proposito, para que este commit
//     tenga el diff minimo posible. Se normaliza en la Fase 2, al mover cada bloque.
//   - Se agrego el export final; todavia nada lo importa. Es intencional.
//
// Requiere servidor HTTP (no abrir con file://): los modulos no cargan por CORS.
//   python -m http.server 8123   ->   http://localhost:8123

import "./art_data.js";

    if (!window.Phaser) {
      document.querySelector(".fallback").textContent = "No se pudo cargar Phaser. Revisá la conexión a Internet y recargá la página.";
      throw new Error("[Alma] Phaser no está disponible: no se puede iniciar el juego.");
    }

    const VIEW_W = 960;
    const VIEW_H = 540;
    const TILE = 32;
    const BASE_GRAVITY = 800;
    const JUMP_SPEED = 382;
    const SACRIFICE_JUMP_SPEED = 700;
    const ROUTE_MAIN = "main";
    const ROUTE_DRAMATIC = "dramatic";
    const TOTAL_STAGES = 8;
    const MAX_LAW_TIER = 1;
    const SAVE_KEY = "blank-soul-save-v4";
    const RUN_FRAGMENT_KEY = "blank-soul-run-fragments-v3";

    const LEVELS = [
      {
        id: 1,
        key: "desert",
        name: "Ruinas del Desierto",
        concept: "Economía y materialismo",
        mantra: "Las monedas pesan.",
        tile: "tile-desert",
        bgTop: 0x261b1d,
        bgMid: 0x7b4630,
        bgLow: 0xd6964b,
        accent: 0xffce66,
        hazard: 0xcf4242,
        darkness: 0.18,
        ambient: [73.42, 110, 146.83]
      },
      {
        id: 2,
        key: "jungle",
        name: "Selva Exuberante",
        concept: "Intelecto y conciencia",
        mantra: "Conocer transforma a quien conoce.",
        tile: "tile-jungle",
        bgTop: 0x081b18,
        bgMid: 0x124933,
        bgLow: 0x2f7545,
        accent: 0x75f1b4,
        hazard: 0xb97aff,
        darkness: 0.42,
        ambient: [82.41, 164.81, 247.94]
      },
      {
        id: 3,
        key: "volcano",
        name: "Núcleo Volcánico",
        concept: "Poder y ego",
        mantra: "Para romper el mundo, entregá algo de vos.",
        tile: "tile-volcano",
        bgTop: 0x18080b,
        bgMid: 0x5e1618,
        bgLow: 0xff6b2a,
        accent: 0xffb14a,
        hazard: 0xff3f2e,
        darkness: 0.26,
        ambient: [55, 82.41, 130.81]
      },
      {
        id: 4,
        key: "void",
        name: "El Vacío / Mazmorra de Mármol",
        concept: "Dios y el absurdo",
        mantra: "El creador espera, inmóvil.",
        tile: "tile-void",
        bgTop: 0x04050a,
        bgMid: 0x131827,
        bgLow: 0x282b38,
        accent: 0xf4f0e2,
        hazard: 0x7df7ff,
        darkness: 0.55,
        ambient: [41.2, 92.5, 185]
      }
    ];

    const LAW_DEFS = [
      { key: "economyGrace", tier: 1, title: "Aligerar Oro", short: "Oro", cost: 10,
        body: "Mitiga el peso de cada moneda.", value: owned => owned ? "Peso del oro al 72%" : "Sin aprender" },
      { key: "willInertia", tier: 1, title: "Fluidez Existencial", short: "Fluidez", cost: 15,
        body: "El salto tras un dash o una caída rápida conserva toda la velocidad aérea.", value: owned => owned ? "Disponible" : "Sin aprender" },
      { key: "doubleJump", tier: 2, title: "Doble Salto Sacramental", short: "2º salto", cost: 25,
        body: "Concede un segundo salto a cambio de 1 moneda.", value: owned => owned ? "Activo" : "Sin aprender" },
      { key: "etherealBond", tier: 2, title: "Vínculo Etéreo", short: "Vínculo", cost: 35,
        body: "Al morir, conserva 15% del oro como fragmentos.", value: owned => owned ? "Activo" : "Sin aprender" },
      { key: "selectiveAmnesia", tier: 3, title: "Amnesia Selectiva", short: "Amnesia", cost: 50,
        body: "Anula el primer golpe de cada nivel, pero pierde 50% de fragmentos de zona.", value: owned => owned ? "Activa" : "Sin aprender" },
      { key: "greedTransmutation", tier: 3, title: "Transmutación de la Codicia", short: "Codicia", cost: 70,
        body: "Las caídas generan ondas según la masa acumulada.", value: owned => owned ? "Activa" : "Sin aprender" }
    ];

    const DEFAULT_META = Object.freeze({
      fragments: 0,
      economyGrace: 0,
      willInertia: 0,
      doubleJump: 0,
      etherealBond: 0,
      selectiveAmnesia: 0,
      greedTransmutation: 0,
      activeEconomyGrace: 1,
      activeWillInertia: 1,
      activeDoubleJump: 1,
      activeEtherealBond: 1,
      activeSelectiveAmnesia: 1,
      activeGreedTransmutation: 1,
      ascensions: 0,
      medallas: []
    });

    const clamp = Phaser.Math.Clamp;
    const Between = Phaser.Math.Between;

    function screenW(scene) {
      return Math.max(320, scene.scale.width || VIEW_W);
    }

    function screenH(scene) {
      return Math.max(320, scene.scale.height || VIEW_H);
    }

    function hashSeed(text) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function mulberry32(seed) {
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }

    function randInt(rng, min, max) {
      return Math.floor(rng() * (max - min + 1)) + min;
    }

    function choice(rng, list) {
      return list[Math.floor(rng() * list.length)];
    }

    // ===== Guardado unificado (Base64 + Ofuscación) =====
    // El meta-progreso permanente se persiste en localStorage con la clave
    // 'blank-soul-save-v4' y la forma base { leyes: {...}, fragmentos: N, medallas: [] }.
    // El string JSON se ofusca con Base64 (btoa/atob). El banco de fragmentos
    // por run (sessionStorage) se mantiene transitorio entre niveles de una run.

    function toSaveShape(meta) {
      const leyes = {};
      for (const law of LAW_DEFS) {
        leyes[law.key] = clamp(Math.floor(Number(meta?.[law.key]) || 0), 0, MAX_LAW_TIER);
        const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
        leyes[activeKey] = clamp(Math.floor(Number(meta?.[activeKey]) ?? (meta?.[law.key] ? 1 : 1)), 0, 1);
      }
      return {
        leyes,
        fragmentos: clamp(Math.floor(Number(meta?.fragments) || 0), 0, 999),
        medallas: Array.isArray(meta?.medallas) ? meta.medallas.slice() : [],
        ascensiones: clamp(Math.floor(Number(meta?.ascensions) || 0), 0, 999)
      };
    }

    function fromSaveShape(decoded) {
      const flat = { ...DEFAULT_META };
      const leyes = decoded?.leyes || {};
      flat.fragments = clamp(Math.floor(Number(decoded?.fragmentos) || 0), 0, 999);
      flat.ascensions = clamp(Math.floor(Number(decoded?.ascensiones) || 0), 0, 999);
      flat.medallas = Array.isArray(decoded?.medallas) ? decoded.medallas.slice() : [];
      for (const law of LAW_DEFS) {
        flat[law.key] = clamp(Math.floor(Number(leyes[law.key]) || 0), 0, MAX_LAW_TIER);
        const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
        flat[activeKey] = leyes[activeKey] === undefined ? (flat[law.key] ? 1 : 1) : (Number(leyes[activeKey]) ? 1 : 0);
      }
      return flat;
    }

    function loadMeta() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return { ...DEFAULT_META };
        const decoded = JSON.parse(atob(raw));
        return normalizeMeta(fromSaveShape(decoded));
      } catch (error) {
        return { ...DEFAULT_META };
      }
    }

    function saveMeta(meta) {
      localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(toSaveShape(meta))));
    }

    function normalizeMeta(meta) {
      const next = { ...DEFAULT_META };
      next.fragments = clamp(Math.floor(Number(meta?.fragments) || 0), 0, 999);
      next.ascensions = clamp(Math.floor(Number(meta?.ascensions) || 0), 0, 999);
      next.medallas = Array.isArray(meta?.medallas) ? meta.medallas.slice() : [];
      for (const law of LAW_DEFS) {
        next[law.key] = clamp(Math.floor(Number(meta?.[law.key]) || 0), 0, MAX_LAW_TIER);
        const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
        next[activeKey] = meta?.[activeKey] === undefined ? (next[law.key] ? 1 : 1) : (Number(meta[activeKey]) ? 1 : 0);
      }
      return next;
    }

    function gravityMultiplier(meta) {
      return 1;
    }

    function trapMultiplier(meta) {
      return 1;
    }

    function economyMultiplier(meta) {
      return meta.economyGrace && lawActive(meta, "economyGrace") ? 0.72 : 1;
    }

    function inflationMultiplier(worldNumber) {
      return [1, 1.4, 1.8, 2.2][clamp(Math.floor(worldNumber || 1), 1, 4) - 1];
    }

    function inflatedPrice(worldNumber, base = 20) {
      return Math.round(base * inflationMultiplier(worldNumber));
    }

    function daggerReward(worldNumber) {
      return [35, 50, 65, 80][clamp(Math.floor(worldNumber || 1), 1, 4) - 1];
    }

    function lawUnlocked(meta, law) {
      if (law.tier === 1) return true;
      return LAW_DEFS.some(candidate => candidate.tier === law.tier - 1 && meta[candidate.key] > 0);
    }

    function lawActive(meta, key) {
      const activeKey = `active${key[0].toUpperCase()}${key.slice(1)}`;
      return Boolean(meta?.[key] && (meta?.[activeKey] === undefined || meta[activeKey]));
    }

    function runFragmentBank() {
      return clamp(Number(sessionStorage.getItem(RUN_FRAGMENT_KEY)) || 0, 0, 999);
    }

    function setRunFragmentBank(value) {
      sessionStorage.setItem(RUN_FRAGMENT_KEY, String(clamp(value, 0, 999)));
    }

    function resetRunFragmentBank() {
      sessionStorage.setItem(RUN_FRAGMENT_KEY, "0");
    }

    function newRunId() {
      return `run-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }

    function effectiveCoinBurden(coins, meta) {
      const count = Math.max(0, Number(coins) || 0);
      const frontLoad = Math.min(count, 18) * 7;
      const excess = Math.sqrt(Math.max(0, count - 18)) * 13;
      return Math.round(clamp((frontLoad + excess) * economyMultiplier(meta), 0, 225));
    }

    function playerMoveSpeed(coins, meta, powerTimer = 0) {
      const penalty = effectiveCoinBurden(coins, meta) * 0.34;
      return clamp(190 - penalty + (powerTimer > 0 ? 26 : 0), 118, 220);
    }

    function rectsOverlap(a, b, pad = 0) {
      return a.x < b.x + b.width + pad &&
        a.x + a.width > b.x - pad &&
        a.y < b.y + b.height + pad &&
        a.y + a.height > b.y - pad;
    }

    function makeRect(x, y, w, h) {
      return { x, y, width: w, height: h };
    }

    class AudioEngine {
      constructor() {
        this.ctx = null;
        this.master = null;
        this.droneGain = null;
        this.droneOsc = [];
        this.unlocked = false;
        this.themeKey = "";
      }

      ensure() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      }

      unlock() {
        this.ensure();
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") this.ctx.resume();
        this.unlocked = true;
      }

      tone(freq = 440, duration = 0.12, type = "sine", gain = 0.15, glide = 0) {
        if (!this.unlocked) return;
        this.ensure();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const vol = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (glide) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), now + duration);
        }
        vol.gain.setValueAtTime(0.0001, now);
        vol.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(vol);
        vol.connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      }

      noise(duration = 0.15, gain = 0.12, tone = 900) {
        if (!this.unlocked) return;
        this.ensure();
        const now = this.ctx.currentTime;
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const vol = this.ctx.createGain();
        filter.type = "bandpass";
        filter.frequency.value = tone;
        filter.Q.value = 4;
        vol.gain.setValueAtTime(gain, now);
        vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(vol);
        vol.connect(this.master);
        source.start(now);
      }

      setDrone(levelInfo) {
        if (!this.unlocked) return;
        this.ensure();
        if (this.themeKey === levelInfo.key && this.droneOsc.length) return;
        this.stopDrone();
        this.themeKey = levelInfo.key;
        const now = this.ctx.currentTime;
        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.setValueAtTime(0.0001, now);
        this.droneGain.gain.linearRampToValueAtTime(0.035, now + 1.2);
        this.droneGain.connect(this.master);
        this.droneOsc = levelInfo.ambient.map((freq, index) => {
          const osc = this.ctx.createOscillator();
          const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
          osc.type = index === 0 ? "sine" : "triangle";
          osc.frequency.value = freq;
          if (pan) {
            pan.pan.value = (index - 1) * 0.28;
            osc.connect(pan);
            pan.connect(this.droneGain);
          } else {
            osc.connect(this.droneGain);
          }
          osc.start(now);
          return osc;
        });
      }

      stopDrone() {
        if (!this.ctx || !this.droneOsc.length) return;
        const now = this.ctx.currentTime;
        if (this.droneGain) {
          this.droneGain.gain.cancelScheduledValues(now);
          this.droneGain.gain.setTargetAtTime(0.0001, now, 0.1);
        }
        this.droneOsc.forEach(osc => {
          try { osc.stop(now + 0.25); } catch (error) {}
        });
        this.droneOsc = [];
      }

      jump() { this.tone(240, 0.12, "square", 0.08, 240); }
      coin() { this.tone(620, 0.08, "triangle", 0.12, 280); }
      hurt() { this.noise(0.18, 0.18, 180); this.tone(92, 0.24, "sawtooth", 0.08, -36); }
      fragment() { this.tone(392, 0.12, "sine", 0.08, 392); setTimeout(() => this.tone(784, 0.16, "triangle", 0.07), 80); }
      dash() { this.noise(0.08, 0.10, 1400); this.tone(185, 0.08, "square", 0.07, 210); }
      demolition() { this.noise(0.34, 0.22, 120); this.tone(48, 0.32, "sine", 0.13, -18); }
      altar() { this.tone(110, 0.3, "sine", 0.11, 110); this.tone(329.63, 0.22, "triangle", 0.08, -40); }
      buy() { this.tone(261.63, 0.12, "triangle", 0.09, 261.63); setTimeout(() => this.tone(523.25, 0.16, "triangle", 0.08), 90); }
      reject() { this.tone(90, 0.11, "sawtooth", 0.10, -20); }
    }

    const AUDIO = new AudioEngine();

    class BootScene extends Phaser.Scene {
      constructor() {
        super("Boot");
      }

      create() {
        this.createTextures();
        installNativeTouchGuards(this.game);
        this.scene.start("Menu");
      }

      createTextures() {
        if (window.ArtData) {
            window.ArtData.generateBootTextures(this);
        } else {
            console.error("No se encontró art_data.js. Por favor, vincúlalo en el HTML.");
        }
      }
    }


    class MenuScene extends Phaser.Scene {
      constructor() {
        super("Menu");
      }

      create() {
        this.meta = loadMeta();
        const sw = screenW(this);
        const sh = screenH(this);
        const narrow = sw < 620 || sh < 460;
        const short = sh < 460;
        this.cameras.main.setBackgroundColor("#05060a");
        this.drawBackground();
        const title = this.add.text(sw / 2, short ? 36 : (narrow ? 66 : 92), "ALMA EN BLANCO", {
          fontFamily: "monospace",
          fontSize: `${short ? 28 : (narrow ? 32 : 54)}px`,
          color: "#f7fbff",
          align: "center"
        }).setOrigin(0.5).setShadow(0, 0, "#99f7ff", 16);
        this.add.text(sw / 2, short ? 68 : (narrow ? 108 : 145), "LEYES DEL ABSURDO", {
          fontFamily: "monospace",
          fontSize: `${short ? 12 : (narrow ? 14 : 18)}px`,
          color: "#9dfcff",
          align: "center"
        }).setOrigin(0.5);
        this.add.text(sw / 2, short ? 104 : (narrow ? 172 : 205), "Una figura sin nombre despierta bajo un autor silencioso y pregunta: ¿por qué estoy aquí?", {
          fontFamily: "monospace",
          fontSize: `${short ? 12 : (narrow ? 14 : 17)}px`,
          color: "#c9d7df",
          align: "center",
          wordWrap: { width: Math.min(720, sw - 42) }
        }).setOrigin(0.5);

        const laws = LAW_DEFS.map((law, i) => `${law.short}: ${this.meta[law.key] ? "✓" : "·"}${i === 2 && narrow ? "\n" : "  "}`).join("").trim();
        this.add.text(sw / 2, short ? 166 : (narrow ? 280 : 286), `Leyes permanentes\n${laws}\nConciencia disponible: ${this.meta.fragments}\nAscensiones: ${this.meta.ascensions}`, {
          fontFamily: "monospace",
          fontSize: `${short ? 10 : (narrow ? 12 : 15)}px`,
          color: "#aab7c0",
          align: "center",
          lineSpacing: short ? 2 : 5
        }).setOrigin(0.5);

        const start = this.add.text(sw / 2, short ? sh - 92 : (narrow ? Math.min(sh - 172, 470) : 374), "INICIAR DESCENSO", {
          fontFamily: "monospace",
          fontSize: `${short ? 15 : (narrow ? 18 : 23)}px`,
          color: "#071014",
          backgroundColor: "#a7f7ff",
          padding: { left: narrow ? 18 : 24, right: narrow ? 18 : 24, top: 12, bottom: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const seedBtn = this.add.text(sw / 2, 0, "SEMILLA PERSONALIZADA", {
          fontFamily: "monospace",
          fontSize: `${short ? 12 : (narrow ? 15 : 17)}px`,
          color: "#9dfcff",
          backgroundColor: "rgba(157, 252, 255, 0.08)",
          padding: { left: narrow ? 12 : 16, right: narrow ? 12 : 16, top: 8, bottom: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        seedBtn.y = start.y + start.height / 2 + seedBtn.height / 2 + (short ? 10 : 16);

        const help = this.add.text(sw / 2, 0, "Mover: WASD / Flechas · Saltar: Espacio\nAcción: E · Impulso: Mayús · Controles táctiles en móviles\nC borra las leyes: una nueva discusión metafísica.", {
          fontFamily: "monospace",
          fontSize: `${short ? 9 : (narrow ? 11 : 14)}px`,
          color: "#7f929e",
          align: "center",
          lineSpacing: short ? 1 : (narrow ? 3 : 6),
          wordWrap: { width: Math.min(820, sw - 38) }
        }).setOrigin(0.5);
        help.y = seedBtn.y + seedBtn.height / 2 + (short ? 6 : (narrow ? 18 : 44));

        // Herramienta Dev: botón tenue de reseteo del meta-progreso (esquina superior derecha).
        const resetBtn = this.add.text(sw - 12, 12, "[ Resetear Progreso ]", {
          fontFamily: "monospace",
          fontSize: `${short ? 9 : (narrow ? 10 : 11)}px`,
          color: "#7f929e",
          backgroundColor: "rgba(157, 252, 255, 0.06)",
          padding: { left: 6, right: 6, top: 4, bottom: 4 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        resetBtn.on("pointerdown", () => {
          if (window.confirm("¿Borrar todo el meta-progreso de Leyes, Fragmentos y Medallas?")) {
            localStorage.removeItem(SAVE_KEY);
            this.scene.restart();
          }
        });

        seedBtn.on("pointerdown", () => this.promptCustomSeed());

        const startGame = () => {
          AUDIO.unlock();
          resetRunFragmentBank();
          this.scene.start("Game", { level: 1, seed: `blank-${Date.now()}`, runId: newRunId(), coins: 0, fragments: 0, hp: 5, isCustomSeed: false });
        };
        start.on("pointerdown", startGame);
        this.input.keyboard.once("keydown-ENTER", startGame);
        this.input.keyboard.once("keydown-SPACE", startGame);
        this.input.keyboard.on("keydown-C", () => {
          saveMeta({ ...DEFAULT_META });
          resetRunFragmentBank();
          this.scene.restart();
        });
        this.input.once("pointerdown", () => AUDIO.unlock());
        this.input.keyboard.once("keydown", () => AUDIO.unlock());

        this.tweens.add({
          targets: title,
          alpha: { from: 0.65, to: 1 },
          duration: 1300,
          yoyo: true,
          repeat: -1
        });
        this.scale.on("resize", this.onMenuResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.onMenuResize, this));
      }

      onMenuResize() {
        this.scene.restart();
      }

      promptCustomSeed() {
        AUDIO.unlock();
        const value = window.prompt("Ingresa la semilla del nivel:");
        if (value == null || String(value).trim() === "") return;
        resetRunFragmentBank();
        this.scene.start("Game", { level: 1, seed: String(value).trim(), runId: newRunId(), coins: 0, fragments: 0, hp: 5, isCustomSeed: true });
      }

      drawBackground() {
        const sw = screenW(this);
        const sh = screenH(this);
        const g = this.add.graphics();
        g.fillStyle(0x05060a, 1);
        g.fillRect(0, 0, sw, sh);
        for (let i = 0; i < 90; i += 1) {
          const x = Between(0, sw);
          const y = Between(0, sh);
          const a = Phaser.Math.FloatBetween(0.1, 0.7);
          g.fillStyle(i % 7 === 0 ? 0x9dfcff : 0xf7fbff, a);
          g.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
        }
        g.lineStyle(2, 0x1e9fb1, 0.16);
        for (let y = 60; y < sh; y += 38) {
          g.beginPath();
          g.moveTo(0, y);
          for (let x = 0; x <= sw; x += 48) {
            g.lineTo(x, y + Math.sin((x + y) * 0.02) * 12);
          }
          g.strokePath();
        }
      }
    }

    class ProceduralMap {
      constructor(seedText, levelInfo, meta, stageNumber = (levelInfo.id - 1) * 2 + 1) {
        this.stageNumber = clamp(stageNumber, 1, TOTAL_STAGES);
        this.worldNumber = Math.ceil(this.stageNumber / 2);
        this.substage = this.stageNumber % 2 ? 1 : 2;
        this.seedText = `${seedText}:${levelInfo.key}:${this.worldNumber}-${this.substage}`;
        this.levelInfo = levelInfo;
        this.meta = meta;
        this.rng = mulberry32(hashSeed(this.seedText));
        this.cols = 78;
        this.rows = 72;
        this.data = Array.from({ length: this.rows }, () => Array(this.cols).fill(-1));
        this.platforms = [];
        this.coins = [];
        this.fragments = [];
        this.spikes = [];
        this.boulders = [];
        this.crates = [];
        this.pots = [];
        this.ladders = [];
        this.altars = [];
        this.spores = [];
        this.lava = [];
        this.destructibles = [];
        this.slopes = [];
        this.decor = [];
        this.path = [];
        this.mainCorridors = [];
        this.dramaticRoutes = [];
        this.symbolicSpawns = [];
        this.specialRooms = [];
        this.merchant = null;
        this.veinCells = [];
        this.secretChambers = [];
      }

      generate() {
        this.frameWorld();
        this.buildMainPath();
        this.addDramaticRoutes();
        this.addSpecialRooms();
        this.addSidePlatforms();
        this.addLaddersAndSlopes();
        this.addEntities();
        this.validateOrRepair();
        this.addCavernMass();
        this.addSymbolicEntities();
        return this;
      }

      addSymbolicEntities() {
        // Fixed patrol bounds keep entities on their floor without changing terrain.
        const kinds = ["creditor", "inflation", "doubt", "bias", "impulse", "guilt", "dogma", "relativeVoid"];
        this.symbolicSpawns = [2, 5, 8].map((index, i) => {
          const p = this.path[index];
          return { kind: kinds[this.stageNumber - 1], x: p.centerX, y: p.y - 19,
            left: p.rect.x + 30, right: p.rect.x + p.rect.width - 30,
            phase: this.rng() * Math.PI * 2, direction: i % 2 ? -1 : 1 };
        });
      }

      addCavernMass() {
        const protectedRects = [
          ...this.mainCorridors,
          ...this.dramaticRoutes.flatMap(route => [route.reserved, route.bridge]),
          ...this.platforms.map(p => makeRect(p.rect.x - TILE, p.y - TILE * 3, p.rect.width + TILE * 2, TILE * 3)),
          ...this.boulders.map(b => makeRect(b.x - 24, b.y - 24, 48, Math.min(340, this.rows * TILE - b.y))),
          makeRect(this.spawn.x - 128, this.spawn.y - 96, 256, 192),
          makeRect(this.exit.x - 128, this.exit.y - 128, 256, 224)
        ];
        const protectedCell = (x, y) => protectedRects.some(rect => rectsOverlap(makeRect(x * TILE, y * TILE, TILE, TILE), rect, 2));
        for (let y = 3; y < this.rows - 4; y += 1) {
          for (let x = 2; x < this.cols - 2; x += 1) {
            if (this.data[y][x] === 1 || protectedCell(x, y)) continue;
            const noise = Math.sin(x * 1.73 + y * 0.91 + hashSeed(this.seedText) * 0.0001) +
              Math.sin(x * 0.37 - y * 1.19 + this.levelInfo.id);
            if (noise > -0.48 || this.rng() < 0.18) this.data[y][x] = 1;
          }
        }
        for (const [chamberIndex, pathIndex] of [6, 11].entries()) {
          const p = this.path[Math.min(pathIndex, this.path.length - 2)];
          const side = -p.exitDirection;
          const chamberX = side > 0 ? p.tx + p.w + 2 : p.tx - 7;
          const x0 = clamp(chamberX, 3, this.cols - 8);
          const y0 = p.ty - 3;
          for (let y = y0; y < p.ty; y += 1) for (let x = x0; x < x0 + 5; x += 1) this.data[y][x] = -1;
          for (let x = x0; x < x0 + 5; x += 1) this.data[p.ty][x] = 1;
          const gateX = side > 0 ? x0 - 1 : x0 + 5;
          for (let y = p.ty - 2; y < p.ty; y += 1) {
            this.data[y][gateX] = 1;
            this.veinCells.push({ tx: gateX, ty: y });
          }
          const centerX = (x0 + 2.5) * TILE;
          this.secretChambers.push({ x: centerX, y: (p.ty - 1) * TILE, gateX, floorY: p.ty });
          this.pots.push({ x: centerX + (chamberIndex ? 42 : -42), y: (p.ty - 2) * TILE + 16, secret: true });
          for (let i = -1; i <= 1; i += 1) this.coins.push({ x: centerX + i * 24, y: (p.ty - 1) * TILE + 8, secret: true });
          this.fragments.push({ x: centerX, y: (p.ty - 2) * TILE + 4, secret: true });
        }
      }

      addSpecialRooms() {
        const vaultSite = (kind, chance) => {
          const dramatic = this.rng() < chance;
          if (dramatic) {
            const vault = choice(this.rng, this.dramaticRoutes);
            return { x: vault.reward.x, y: vault.reward.y + 2, route: ROUTE_DRAMATIC,
              dramaticId: vault.id, requiresSacrifice: true, kind };
          }
          const p = this.path[Math.floor(this.path.length / 2)];
          return { x: p.centerX, y: p.y - 28, route: ROUTE_MAIN,
            dramaticId: null, requiresSacrifice: false, kind };
        };
        if (this.substage === 1) {
          if (this.rng() < 0.6) {
            const site = vaultSite("special", 0.3);
            this.specialRooms.push({ ...site, id: `special-${this.worldNumber}-1`,
              type: this.rng() < 0.5 ? "barter" : "risk", used: false,
              widthTiles: 5, heightTiles: 3 });
          }
          return;
        }
        this.merchant = { ...vaultSite("merchant", 0.15), widthTiles: 6, heightTiles: 4 };
      }

      frameWorld() {
        for (let y = 0; y < this.rows; y += 1) {
          this.data[y][0] = 1;
          this.data[y][this.cols - 1] = 1;
        }
        for (let x = 2; x < this.cols - 2; x += 11) {
          const width = 4 + (x % 3);
          for (let sx = x; sx < Math.min(this.cols - 2, x + width); sx += 1) {
            this.data[this.rows - 2][sx] = 1;
          }
        }
      }

      stampPlatform(tx, ty, width, tag = "stone") {
        const x0 = clamp(Math.floor(tx), 2, this.cols - 3);
        const w = clamp(Math.floor(width), 3, this.cols - x0 - 2);
        const y = clamp(Math.floor(ty), 3, this.rows - 3);
        for (let x = x0; x < x0 + w; x += 1) {
          this.data[y][x] = 1;
          if (tag !== "vault" && tag !== "approach" && this.levelInfo.key !== "jungle" && this.rng() > 0.45) this.data[y + 1][x] = 1;
        }
        const rect = makeRect(x0 * TILE, y * TILE, w * TILE, TILE);
        const category = tag === "path" || tag === "repair" ? ROUTE_MAIN : ROUTE_DRAMATIC;
        this.platforms.push({ tx: x0, ty: y, w, tag, category, requiresSacrifice: tag === "vault", rect, centerX: (x0 + w / 2) * TILE, y: y * TILE });
        return this.platforms[this.platforms.length - 1];
      }

      buildMainPath() {
        let tx = randInt(this.rng, 32, 38);
        let ty = 5;
        let width = 8;
        let platform = this.stampPlatform(tx, ty, width, "path");
        this.path.push(platform);
        this.spawn = {
          x: (tx + 2) * TILE + 16,
          y: (ty - 2) * TILE,
          facing: 1
        };

        while (ty < this.rows - 13) {
          // Each lower ledge extends past the departure edge: no jump is required.
          let dir = this.rng() > 0.5 ? 1 : -1;
          const shift = randInt(this.rng, 3, 4);
          if (tx + dir * shift < 24 || tx + dir * shift > 46) dir *= -1;
          platform.exitDirection = dir;
          platform.departureX = dir > 0 ? (tx + width) * TILE + 24 : tx * TILE - 24;
          tx += dir * shift;
          ty += 4;
          platform = this.stampPlatform(tx, ty, width, "path");
          this.path.push(platform);
        }

        const final = this.path[this.path.length - 1];
        this.mainBounds = {
          left: Math.min(...this.path.map(p => p.rect.x)) - TILE,
          right: Math.max(...this.path.map(p => p.rect.x + p.rect.width)) + TILE
        };
        for (let i = 0; i < this.path.length; i += 1) {
          const p = this.path[i];
          this.mainCorridors.push(makeRect(p.rect.x, p.y - 80, p.rect.width, 80));
          if (i < this.path.length - 1) {
            this.mainCorridors.push(makeRect(p.departureX - 22, p.y - 70, 44, this.path[i + 1].y - p.y + 70));
          }
        }
        this.exit = {
          x: (final.tx + final.w - 2) * TILE + 16,
          y: (final.ty - 2) * TILE
        };
      }

      addDramaticRoutes() {
        const count = randInt(this.rng, 2, 3);
        const anchors = count === 3 ? [3, 6, 9] : [3, 8];
        anchors.forEach((index, routeIndex) => {
          const p = this.path[index];
          const side = -p.exitDirection;
          const tx = side < 0 ? 8 : this.cols - 15;
          const floor = p.ty;
          const ledgeY = floor - 7;
          const roof = ledgeY - 3;
          const doorTx = side < 0 ? tx + 6 : tx;
          const id = `ofrenda-${routeIndex}`;
          const approachStart = side < 0 ? tx : p.tx + p.w;
          const approachEnd = side < 0 ? p.tx : tx + 7;
          this.stampPlatform(approachStart, floor, approachEnd - approachStart, "approach");
          const ledgeTx = side < 0 ? tx + 1 : tx + 3;
          const ledge = this.stampPlatform(ledgeTx, ledgeY, 3, "vault");
          ledge.dramaticId = id;
          const launchX = (side < 0 ? tx + 5 : tx + 2) * TILE;
          const route = {
            id, category: ROUTE_DRAMATIC, unlocked: false, collected: false,
            x: doorTx * TILE + 16, y: floor * TILE - 24,
            launchX, floorY: floor * TILE, ledgeY: ledgeY * TILE,
            launchZone: makeRect((tx + 1) * TILE, (floor - 2) * TILE, 5 * TILE, 2 * TILE),
            reserved: makeRect((tx - 1) * TILE, (roof - 1) * TILE, 9 * TILE, (floor - roof + 3) * TILE),
            bridge: makeRect(approachStart * TILE, (floor - 3) * TILE, (approachEnd - approachStart) * TILE, 5 * TILE),
            reward: { x: ledge.centerX, y: ledge.y - 26 }
          };
          this.dramaticRoutes.push(route);
          for (let x = tx; x <= tx + 6; x += 1) this.data[roof][x] = 1;
          for (let y = roof + 1; y < floor; y += 1) {
            for (const x of [tx, tx + 6]) {
              if (x === doorTx && y >= floor - 2) {
                this.destructibles.push({ x: x * TILE + 16, y: y * TILE + 16, dramaticId: id });
              } else this.data[y][x] = 1;
            }
          }
          this.fragments.push({ ...route.reward, dramaticId: id });
          for (let c = 1; c <= 3; c += 1) {
            this.coins.push({ x: route.x - side * (32 + c * 24), y: route.y - 2 });
          }
        });
      }

      addSidePlatforms() {
        const count = 18 + this.levelInfo.id * 4;
        for (let i = 0; i < count; i += 1) {
          const anchor = choice(this.rng, this.path);
          const width = randInt(this.rng, 3, 8);
          const tx = clamp(anchor.tx + randInt(this.rng, -13, 13), 4, this.cols - width - 4);
          const ty = clamp(anchor.ty + randInt(this.rng, -2, 3), 4, this.rows - 4);
          const candidate = makeRect(tx * TILE, (ty - 1) * TILE, width * TILE, TILE * 3);
          const tooClose = this.platforms.some(p => rectsOverlap(candidate, p.rect, TILE * 0.25));
          const protectedArea = this.mainCorridors.some(r => rectsOverlap(candidate, r)) ||
            this.dramaticRoutes.some(r => rectsOverlap(candidate, r.reserved) || rectsOverlap(candidate, r.bridge));
          if (!tooClose && !protectedArea) this.stampPlatform(tx, ty, width, "side");
        }
      }

      addLaddersAndSlopes() {
        for (let i = 0; i < this.path.length - 1; i += 1) {
          const a = this.path[i];
          const b = this.path[i + 1];
          if (i % 3 === 1) this.ladders.push({ x: a.departureX - 16, y: a.y - TILE, height: b.y - a.y + TILE });
        }
        for (const p of this.platforms.filter(p => p.tag === "side").slice(0, 3)) {
          const slope = { x: p.rect.x, y: p.y - 24, width: TILE * 2, height: 24, dir: 1 };
          if (!this.mainCorridors.some(r => rectsOverlap(slope, r))) this.slopes.push(slope);
        }
      }

      addEntities() {
        const spawnSafe = makeRect(this.spawn.x - 120, this.spawn.y - 90, 240, 180);
        const exitSafe = makeRect(this.exit.x - 120, this.exit.y - 120, 240, 200);

        // Four readable props are staged before random decoration: two on the main route and two on nearby ledges.
        const mainProp = (platform, kind, offset = 1) => {
          if (!platform) return;
          const x = (platform.tx + clamp(offset, 1, platform.w - 2)) * TILE + 16;
          const y = (platform.ty - 2) * TILE + 16;
          this[kind].push({ x, y, guaranteed: true });
        };
        mainProp(this.path[1], "pots", 2);
        mainProp(this.path[2], "crates", 3);
        mainProp(this.path[4], "pots", 1);
        mainProp(this.platforms.find(platform => platform.tag === "side" && platform.w >= 4), "crates", 2);

        for (const platform of this.platforms) {
          if (platform.requiresSacrifice) continue;
          if (platform.tag === "path" || this.rng() > 0.35) {
            const slots = clamp(platform.w - 2, 1, 5);
            for (let s = 0; s < slots; s += 1) {
              if (this.rng() < (this.levelInfo.key === "desert" ? 0.58 : 0.34)) {
                const x = (platform.tx + 1 + s) * TILE + 16;
                const y = (platform.ty - 1) * TILE + 10;
                const rect = makeRect(x - 14, y - 14, 28, 28);
                if (!rectsOverlap(rect, spawnSafe) && !rectsOverlap(rect, exitSafe)) this.coins.push({ x, y });
              }
            }
          }

          if (platform.tag !== "path" && this.rng() < 0.15 + this.levelInfo.id * 0.03) {
            const x = (platform.tx + randInt(this.rng, 1, Math.max(1, platform.w - 2))) * TILE + 16;
            const y = (platform.ty - 1) * TILE + 8;
            this.fragments.push({ x, y });
          }

          if (platform.tag === "side" && platform.ty > 9 && this.rng() < 0.27 && platform.w > 4) {
            const x = (platform.tx + randInt(this.rng, 1, platform.w - 2)) * TILE;
            const y = (platform.ty - 1) * TILE;
            const rect = makeRect(x, y, TILE, TILE);
            if (!rectsOverlap(rect, spawnSafe) && !rectsOverlap(rect, exitSafe)) this.spikes.push({ x: x + 16, y: y + 16 });
          }

          if (platform.tag === "side" && this.rng() < 0.25 && platform.w > 5) {
            const x = (platform.tx + randInt(this.rng, 1, platform.w - 2)) * TILE + 16;
            const y = (platform.ty - 2) * TILE + 16;
            const rect = makeRect(x - 18, y - 18, 36, 36);
            if (!rectsOverlap(rect, spawnSafe) && !rectsOverlap(rect, exitSafe)) this.crates.push({ x, y });
          }

          if (platform.tag !== "path" && platform.w > 3 && this.rng() < 0.32) {
            const x = (platform.tx + randInt(this.rng, 1, Math.max(1, platform.w - 2))) * TILE + 16;
            const y = (platform.ty - 2) * TILE + 16;
            const rect = makeRect(x - 18, y - 18, 36, 36);
            if (!rectsOverlap(rect, spawnSafe) && !rectsOverlap(rect, exitSafe)) this.pots.push({ x, y });
          }
        }

        if (this.pots.length < 3) {
          for (const p of this.platforms.filter(platform => platform.tag === "side" && platform.w >= 4).slice(0, 3 - this.pots.length)) {
            this.pots.push({ x: (p.tx + 1) * TILE + 16, y: (p.ty - 2) * TILE + 16 });
          }
        }
        const visibleProps = this.crates.length + this.pots.length;
        if (visibleProps > 4) {
          let excess = visibleProps - 4;
          while (excess > 0 && this.pots.length > 2) { this.pots.pop(); excess -= 1; }
          while (excess > 0 && this.crates.length > 2) { this.crates.pop(); excess -= 1; }
        }

        for (const p of this.platforms.filter(p => p.tag === "side" && p.w >= 5).slice(0, 3)) {
          const x = (p.tx + clamp(randInt(this.rng, 1, p.w - 2), 1, p.w - 2)) * TILE + 16;
          const y = (p.ty - randInt(this.rng, 4, 7)) * TILE;
          this.boulders.push({ x, y });
        }

        if (this.levelInfo.key !== "void") {
          const altarPlatform = this.path[Math.max(2, Math.floor(this.path.length * 0.58))];
          this.altars.push({
            x: (altarPlatform.tx + Math.floor(altarPlatform.w / 2)) * TILE,
            y: (altarPlatform.ty - 1) * TILE - 10
          });
        }

        if (this.levelInfo.key === "jungle") {
          for (const p of this.platforms.filter(p => p.tag === "side").slice(0, 6)) {
            this.spores.push({
              x: (p.tx + randInt(this.rng, 1, Math.max(1, p.w - 2))) * TILE + 16,
              y: (p.ty - 1) * TILE + 8
            });
          }
        }

        if (this.levelInfo.key === "volcano") {
          const sideLava = this.platforms.filter(p => p.tag === "side" && p.w >= 5).slice(0, 7);
          for (const p of sideLava) {
            const w = randInt(this.rng, 2, Math.min(3, p.w - 2));
            const tx = p.tx + randInt(this.rng, 1, p.w - w - 1);
            this.lava.push({
              x: tx * TILE,
              y: (p.ty - 0.15) * TILE,
              width: w * TILE,
              height: TILE * 0.38
            });
          }
          for (const p of this.platforms.filter(p => p.tag === "side").slice(0, 3)) {
            const side = this.rng() > 0.5 ? -1 : 1;
            const tx = clamp(p.tx + side * randInt(this.rng, 5, 9), 2, this.cols - 4);
            for (let y = p.ty - 3; y < p.ty; y += 1) {
              this.destructibles.push({ x: tx * TILE + 16, y: y * TILE + 16 });
            }
          }
        }

        if (this.levelInfo.key === "void") {
          const p = this.path[Math.max(2, this.path.length - 3)];
          this.god = {
            x: (p.tx + Math.floor(p.w / 2)) * TILE,
            y: (p.ty - 6) * TILE,
            zone: makeRect((p.tx - 3) * TILE, (p.ty - 6) * TILE, (p.w + 6) * TILE, 6 * TILE)
          };
        }
      }

      validateOrRepair() {
        const startFloor = this.tileAtWorld(this.spawn.x, this.spawn.y + 80);
        if (startFloor !== 1) {
          const tx = Math.floor(this.spawn.x / TILE) - 2;
          const ty = Math.floor((this.spawn.y + 80) / TILE);
          this.stampPlatform(tx, ty, 7, "repair");
        }
        const exitFloor = this.tileAtWorld(this.exit.x, this.exit.y + 80);
        if (exitFloor !== 1) {
          const tx = Math.floor(this.exit.x / TILE) - 3;
          const ty = Math.floor((this.exit.y + 80) / TILE);
          this.stampPlatform(tx, ty, 7, "repair");
        }
        const spawnSafe = makeRect(this.spawn.x - 96, this.spawn.y - 96, 192, 192);
        const exitSafe = makeRect(this.exit.x - 96, this.exit.y - 96, 192, 192);
        this.spikes = this.spikes.filter(s => !rectsOverlap(makeRect(s.x - 16, s.y - 16, 32, 32), spawnSafe) && !rectsOverlap(makeRect(s.x - 16, s.y - 16, 32, 32), exitSafe));
        this.lava = this.lava.filter(l => !rectsOverlap(l, spawnSafe) && !rectsOverlap(l, exitSafe));
        const protectedRect = r => this.mainCorridors.some(c => rectsOverlap(r, c, 12)) ||
          this.dramaticRoutes.some(d => rectsOverlap(r, d.reserved) || rectsOverlap(r, d.bridge));
        this.spikes = this.spikes.filter(s => !protectedRect(makeRect(s.x - 16, s.y - 16, 32, 32)));
        this.lava = this.lava.filter(l => !protectedRect(l));
        this.spores = this.spores.filter(s => !protectedRect(makeRect(s.x - 16, s.y - 16, 32, 32)));
        this.destructibles = this.destructibles.filter(d => d.dramaticId || !protectedRect(makeRect(d.x - 16, d.y - 16, 32, 32)));
        const outsideMain = p => p.x < this.mainBounds.left - 80 || p.x > this.mainBounds.right + 80;
        this.boulders = this.boulders.filter(b => outsideMain(b) && !protectedRect(makeRect(b.x - 40, b.y - 20, 80, this.rows * TILE - b.y)));
        this.crates = this.crates.filter(c => c.guaranteed || (outsideMain(c) && !protectedRect(makeRect(c.x - 20, c.y - 16, 40, 32))));
        this.pots = this.pots.filter(p => p.guaranteed || !protectedRect(makeRect(p.x - 18, p.y - 18, 36, 36)));
      }

      tileAtWorld(x, y) {
        const tx = Math.floor(x / TILE);
        const ty = Math.floor(y / TILE);
        if (!this.data[ty]) return -1;
        return this.data[ty][tx];
      }

      selfTest() {
        const failures = [];
        if (!this.spawn || !this.exit) failures.push("missing spawn or exit");
        if (this.rows !== 72) failures.push("expected 72 rows");
        if (this.path.length < 13 || this.path.length > 15) failures.push("expected 13 to 15 main path segments");
        if (this.substage === 1 && this.specialRooms.length > 1) failures.push("too many special rooms");
        if (this.substage === 1 && this.merchant) failures.push("merchant in X-1 stage");
        if (this.substage === 2 && !this.merchant) failures.push("merchant missing in X-2 stage");
        if (this.substage === 2 && this.specialRooms.length) failures.push("special room in X-2 stage");
        if (this.dramaticRoutes.length < 2 || this.dramaticRoutes.length > 3) failures.push("expected 2 or 3 dramatic routes");
        for (let i = 0; i < this.path.length - 1; i += 1) {
          const a = this.path[i];
          const b = this.path[i + 1];
          if (b.ty <= a.ty) failures.push(`path step ${i} does not descend`);
          if (Math.abs(b.centerX - a.centerX) > TILE * 8.5) failures.push(`path step ${i} horizontal gap too wide`);
          if ((b.ty - a.ty) > 6) failures.push(`path step ${i} vertical drop too deep`);
          if (a.departureX - 10 < b.rect.x || a.departureX + 10 > b.rect.x + b.rect.width) failures.push(`step ${i} requires a jump`);
        }
        for (const c of this.mainCorridors) {
          for (let y = Math.ceil(c.y / TILE); y < Math.floor((c.y + c.height) / TILE); y += 1) {
            for (let x = Math.floor(c.x / TILE); x <= Math.floor((c.x + c.width - 1) / TILE); x += 1) {
              if (this.data[y]?.[x] === 1) failures.push(`blocked main corridor at ${x},${y}`);
            }
          }
        }
        const bestNormalJump = JUMP_SPEED ** 2 / (2 * BASE_GRAVITY * gravityMultiplier({ gravityRelief: MAX_LAW_TIER }));
        for (const r of this.dramaticRoutes) {
          const rise = r.floorY - r.ledgeY;
          if (rise <= bestNormalJump + 40) failures.push("dramatic ledge reachable by standard jump");
          if (rise >= SACRIFICE_JUMP_SPEED ** 2 / (2 * BASE_GRAVITY) - 32) failures.push("sacrifice jump too weak");
          if (this.destructibles.filter(d => d.dramaticId === r.id).length !== 2) failures.push("dramatic gate not sealed");
          if (!this.fragments.some(f => f.dramaticId === r.id)) failures.push("dramatic reward missing");
        }
        if (this.tileAtWorld(this.spawn.x, this.spawn.y + 80) !== 1) failures.push("spawn has no floor");
        if (this.tileAtWorld(this.exit.x, this.exit.y + 80) !== 1) failures.push("exit has no floor");
        const solidCount = this.data.reduce((sum, row) => sum + row.filter(tile => tile === 1).length, 0);
        if (solidCount / (this.rows * this.cols) < 0.28) failures.push("cavern mass too sparse");
        if (this.secretChambers.length !== 2 || this.veinCells.length !== 4) failures.push("secret chambers or veins missing");
        if (this.pots.length < 2) failures.push("too few throwable pots");
        if (this.data[this.rows - 1].filter(tile => tile === 1).length > 2) failures.push("bottom row should remain mostly open");
        if (this.spikes.some(s => Phaser.Math.Distance.Between(s.x, s.y, this.spawn.x, this.spawn.y) < 130)) failures.push("spike too close to spawn");
        if (this.lava.some(l => rectsOverlap(l, makeRect(this.exit.x - 100, this.exit.y - 100, 200, 200)))) failures.push("lava too close to exit");
        for (const p of this.path) {
          const pathRect = makeRect(p.tx * TILE, (p.ty - 0.2) * TILE, p.w * TILE, TILE * 0.6);
          for (const lava of this.lava) {
            if (rectsOverlap(lava, pathRect)) {
              const clearWidth = p.w * TILE - lava.width;
              if (clearWidth < TILE * 4) failures.push("path lava leaves too little safe lane");
            }
          }
        }
        if (effectiveCoinBurden(60, this.meta) > 225) failures.push("coin burden exceeds cap");
        if (playerMoveSpeed(60, this.meta, 0) < 118) failures.push("coin speed floor too low");
        return { ok: failures.length === 0, failures, pathLength: this.path.length, coins: this.coins.length, hazards: this.spikes.length + this.lava.length + this.boulders.length };
      }
    }

    class SymbolicEntity {
      constructor(scene, spawn) {
        this.scene = scene;
        Object.assign(this, spawn);
        this.homeX = this.x;
        this.homeY = this.y;
        this.state = "active";
        this.stunnedUntil = 0;
        this.respawnAt = 0;
        this.safeUntil = scene.time.now + 1000;
        this.chargeUntil = 0;
        this.chargeReadyAt = scene.time.now + 1000;
        this.pulseStart = scene.time.now + 1600 + this.phase * 220;
        this.pulseHit = false;
        this.previousRadius = 0;
        this.windupUntil = 0;
        this.attackAt = 0;
        this.attackHit = false;
        this.storedCoins = 0;
        this.targetLockStartedAt = 0;
        this.lassoActiveUntil = 0;
        this.ballooning = false;
        this.projectilesReleased = false;
        this.embeddedUntil = 0;
        this.observedByPlayer = false;
        this.reboundUntil = 0;
        this.chargeVelocityY = 0;
        this.names = { creditor: "El Acreedor", inflation: "La Inflación", doubt: "La Duda",
          bias: "El Sesgo / Reflejo", impulse: "El Impulso Ciego", guilt: "La Culpa",
          dogma: "El Dogma", relativeVoid: "El Vacío Relativo" };
          
        const key = `symbolic-${this.kind}`;
        
        if (window.ArtData) {
           window.ArtData.makeSymbolicEntity(scene, this.kind, scene.levelInfo.accent);
        }

        // No solid body: symbolic contact never blocks the guaranteed route.
        this.sprite = scene.add.image(this.x, this.y, key).setDepth(10);
        this.ring = scene.add.graphics().setDepth(9);
      }

      vulnerable(time) {
        if (this.state !== "active" || time < this.safeUntil) return false;
        if (time < this.stunnedUntil) return true;
        if (this.kind === "dogma") return time < this.pulseStart;
        if (["guilt", "relativeVoid"].includes(this.kind)) return !this.attackAt;
        return time >= this.chargeUntil && (this.scene.player.x - this.x) * this.direction < -8;
      }

      dissipate(time, absorbed = false) {
        if (this.state !== "active") return false;
        this.state = absorbed ? "absorbed" : "dissipated";
        this.respawnAt = time + 8000;
        this.sprite.setVisible(false);
        this.ring.clear();
        this.scene.blue.explode(16, this.x, this.y);
        if (!absorbed) this.scene.showMessage("Pensamiento disipado. Regresa en 8 s.", 1700);
        return true;
      }

      update(time, dt) {
        if (this.scene.ending) return;
        if (["absorbed", "carried", "thrown"].includes(this.state)) return;
        const scene = this.scene, player = scene.player;
        if (this.kind === "dogma" && time >= this.pulseStart && time < this.pulseStart + 500) this.windupUntil = this.pulseStart + 500;
        if (this.kind === "impulse" && this.chargeUntil && time >= this.chargeUntil) {
          if (!this.attackHit) this.stunnedUntil = time + 1500;
          this.chargeUntil = 0;
        }
        if (this.state === "dissipated") {
          if (time < this.respawnAt) return;
          this.state = "active";
          this.x = this.homeX; this.y = this.homeY;
          this.safeUntil = time + 1000;
          this.stunnedUntil = time + 1000;
          this.chargeUntil = 0; this.chargeReadyAt = time + 1500;
          this.pulseStart = time + 1600;
          this.pulseHit = false; this.previousRadius = 0;
          this.sprite.setVisible(true);
          scene.blue.explode(8, this.x, this.y);
        }
        const dx = player.x - this.x, dy = player.y - this.y;
        if (!["dogma", "guilt", "creditor"].includes(this.kind) && time >= this.stunnedUntil) {
          if (this.kind === "impulse" && time >= this.chargeReadyAt && !this.windupUntil && Math.abs(dx) < 230 && Math.abs(dy) < 36) {
            this.direction = Math.sign(dx) || this.direction;
            this.windupUntil = time + 500;
            this.attackAt = this.windupUntil;
            this.chargeReadyAt = time + 1900;
            this.reboundUntil = time + 260;
          }
          if (this.kind === "impulse" && this.attackAt && time >= this.attackAt) {
            this.chargeUntil = time + 500; this.attackAt = 0; this.windupUntil = 0; this.attackHit = false;
            this.chargeVelocityY = 210;
          }
          const charging = time < this.chargeUntil;
          const speed = time < this.windupUntil || time < this.embeddedUntil || (this.kind === "bias" && this.observedByPlayer) ? 0 : this.kind === "creditor" ? 28 : ["inflation", "doubt", "relativeVoid"].includes(this.kind) ? 24 : this.kind === "bias" ? 48 : charging ? 235 : 78;
          this.x += this.direction * speed * dt / 1000;
          if (this.kind === "impulse" && time < this.reboundUntil) this.y -= 48 * dt / 1000;
          if ((this.x <= this.left || this.x >= this.right) && time >= this.embeddedUntil) {
            this.x = clamp(this.x, this.left, this.right);
            this.direction *= -1;
            if (charging && this.kind === "impulse") {
              this.embeddedUntil = time + 2000;
              this.stunnedUntil = this.embeddedUntil;
              this.scene.showMessage("El Impulso queda incrustado en la roca.", 1500);
            }
            this.stunnedUntil = Math.max(this.stunnedUntil, time + (charging ? 1500 : 750));
            this.chargeUntil = 0;
          }
          if (charging && this.kind === "impulse") this.y += this.chargeVelocityY * dt / 1000;
        }
        if (["inflation", "doubt", "bias", "relativeVoid"].includes(this.kind) && !this.ballooning) this.y = this.homeY - 12 + Math.sin(time * 0.002 + this.phase) * 9;
        if (this.kind === "inflation" && this.ballooning) {
          this.y -= 32 * dt / 1000;
          if (this.y < 64 && !this.projectilesReleased) {
            this.projectilesReleased = true;
            for (let i = 0; i < 7; i += 1) scene.spawnSymbolicAttack(this, "coinRain", this.x, this.y, (i - 3) * 48, -165 - (i % 3) * 24, 1800);
            scene.showMessage("La Inflación se eleva y deja caer una lluvia de oro.", 1800);
            scene.spark.explode(18, this.x, this.y);
          }
          if (this.projectilesReleased && this.y <= 64) {
            this.ballooning = false; this.projectilesReleased = false; this.y = this.homeY; this.sprite.setScale(1, 1);
          }
        }
        if (this.kind === "bias" && time >= this.stunnedUntil) this.updateBias(time, dt);
        if (this.kind === "inflation" && time >= this.stunnedUntil) this.updateInflation(time);
        if (this.kind === "guilt") this.updateGuilt(time);
        if (this.kind === "relativeVoid" && time >= this.stunnedUntil) this.updateRelativeVoid(time);
        const winding = time < this.windupUntil;
        this.sprite.setPosition(this.x + (winding ? Math.sin(time * 0.09) * 4 : 0), this.y).setFlipX(this.direction < 0);
        this.sprite.setAlpha(time < this.safeUntil ? 0.4 : 1);
        this.sprite.setTint(this.kind === "bias" && this.observedByPlayer ? 0x9a9da4 : winding ? 0xffd45e : this.vulnerable(time) ? 0x8af0b0 : time < this.chargeUntil ? 0xff596e : 0xffffff);
        this.ring.clear();
        if (this.kind === "creditor" && time >= this.stunnedUntil) this.updateCreditor(time);
        if (this.kind === "guilt" && winding && this.targetX) {
          this.ring.fillStyle(0xff5b32, 0.25).fillRect(this.targetX - 20, player.y - 250, 40, 500);
        }
        if (this.kind === "relativeVoid") {
          this.ring.lineStyle(1, 0x9dfcff, 0.28);
          this.ring.lineBetween(this.x, this.y, this.x + this.direction * 210, this.y - 70);
          this.ring.lineBetween(this.x, this.y, this.x + this.direction * 210, this.y + 70);
        }
        if (this.kind === "dogma") {
          const pulse = Math.sin(time * 0.004) * 6;
          const points = [[this.x - 96 - pulse, this.y + 54], [this.x + 96 + pulse, this.y + 54],
            [this.x + 68, this.y - 76 - pulse], [this.x - 68, this.y - 76 - pulse]];
          if (this.ring.beginPath) {
            this.ring.lineStyle(2, 0x9dfcff, 0.3 + (winding ? 0.35 : 0));
            this.ring.beginPath(); this.ring.moveTo(points[0][0], points[0][1]);
            points.slice(1).forEach(point => this.ring.lineTo(point[0], point[1]));
            this.ring.closePath(); this.ring.strokePath();
          }
          this.ring.lineStyle(1, 0x8af0b0, 0.5); this.ring.strokeCircle(this.x, this.y - 10, 27);
        }
        if (this.vulnerable(time)) {
          this.ring.lineStyle(1, 0x8af0b0, 0.65);
          this.ring.strokeCircle(this.x, this.y, 26);
        }
        if (time < this.safeUntil) return;
        const b = player.body;
        const hit = rectsOverlap(b, { x: this.x - 16, y: this.y - 19, width: 32, height: 38 });
        const dashing = time < scene.dashUntil;
        if (hit && dashing) {
          if (this.kind === "creditor" && time < this.lassoActiveUntil) { scene.parryAttack(this, time); this.lassoActiveUntil = 0; return; }
          if (this.kind === "inflation") { this.explodeInflation(time); scene.parryAttack(this, time); return; }
          if (winding || time < this.chargeUntil) { scene.parryAttack(this, time); return; }
          this.dissipate(time); return;
        }
        if (hit && time >= scene.invulnUntil && time >= this.stunnedUntil) {
          if (this.kind === "doubt") {
            scene.doubtUntil = time + 3000;
            scene.staggerUntil = time + 250;
            scene.invulnUntil = time + 1000;
            scene.showMessage("La Duda: aturdimiento; dirección invertida durante 3 s.", 2600);
            scene.blue.explode(8, player.x, player.y);
          } else if (this.kind !== "creditor" && this.kind !== "relativeVoid" && (this.kind !== "bias" || b.velocity.x * this.direction < -20)) {
            if (this.kind === "impulse") this.attackHit = true;
            scene.takeDamage(1, "symbolic");
          }
        }
        if (scene.ending) return;
        if (this.kind === "creditor" && scene.coins > 5 && Math.abs(dx) < 170 && Math.abs(dy) < 35 && !dashing && b.blocked.down) {
          // Attraction is capped and stops near floor edges, so wealth cannot force a fall.
          const toward = Math.sign(this.x - player.x);
          if (player.x > this.left + 8 && player.x < this.right - 8) {
            b.velocity.x = clamp(b.velocity.x + toward * 65 * dt / 1000, -300, 300);
            this.ring.lineStyle(1, 0xffce66, 0.4);
            this.ring.lineBetween(this.x, this.y, player.x, player.y);
          }
        }
        if (this.kind === "dogma" && time >= this.stunnedUntil) this.updatePulse(time);
      }

      updateInflation(time) {
        if (this.ballooning) return;
        if (this.storedCoins >= 4) {
          this.ballooning = true;
          this.projectilesReleased = false;
          this.stunnedUntil = 0;
          return;
        }
        this.scene.coinsGroup.children.iterate(coin => {
          if (!coin?.active || this.storedCoins >= 4) return;
          if (Math.hypot(coin.x - this.x, coin.y - this.y) < 46) {
            coin.disableBody(true, true); this.storedCoins += 1;
          }
        });
        if (this.storedCoins >= 4) { this.ballooning = true; this.projectilesReleased = false; }
        this.sprite.setScale(1 + this.storedCoins * 0.08, 1 + this.storedCoins * 0.08);
      }

      explodeInflation(time) {
        if (time < this.stunnedUntil || !this.storedCoins && time < this.safeUntil) return;
        this.storedCoins = 0;
        for (const [vx, vy] of [[190, 0], [-190, 0], [0, 190], [0, -190]]) this.scene.spawnSymbolicAttack(this, "coin", this.x, this.y, vx, vy, 1200);
        this.stunnedUntil = time + 1500;
        this.scene.spark.explode(20, this.x, this.y);
      }

      updateBias(time, dt) {
        const history = this.scene.playerHistory || [];
        // Delay de copia de posición ampliado de 1.0s a 1.8s (más fácil de esquivar).
        const past = history.find(point => point.time >= time - 1800) || history[0];
        if (!past) return;
        const scene = this.scene;
        this.observedByPlayer = (scene.player.x - this.x) * scene.player.facing > 0 && Math.abs(scene.player.x - this.x) < 320;
        if (!this.observedByPlayer) {
          // El Sesgo copia la posición del jugador, pero su velocidad de persecución
          // queda limitada a un 15% menos que la del jugador para permitir escapar.
          const playerSpeed = playerMoveSpeed(scene.featherBoots ? 0 : scene.coins, scene.meta, scene.godPowerTimer);
          const maxBias = Math.max(36, playerSpeed * 0.85);
          const dx = past.x - this.x;
          const dy = (past.y || this.y) - this.y;
          const dist = Math.hypot(dx, dy);
          const step = maxBias * (dt / 1000);
          if (dist > step) {
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
          } else {
            this.x = past.x;
            this.y = past.y;
          }
          this.direction = past.facing || this.direction;
        }
      }

      updateCreditor(time) {
        const scene = this.scene;
        const dx = scene.player.x - this.x, dy = Math.abs(scene.player.y - this.y);
        const aiming = Math.abs(dx) < 270 && dy < 48;
        if (aiming && !this.lassoActiveUntil) {
          this.direction = Math.sign(dx) || this.direction;
          if (!this.targetLockStartedAt) this.targetLockStartedAt = time;
          this.ring.lineStyle(1, 0xffce66, 0.28 + Math.sin(time * 0.02) * 0.08);
          this.ring.lineBetween(this.x, this.y - 8, scene.player.x, scene.player.y - 8);
          if (time - this.targetLockStartedAt >= 1200) {
            this.lassoActiveUntil = time + 950;
            this.targetLockStartedAt = 0;
            scene.spawnSymbolicAttack(this, "lasso", this.x, this.y - 8, this.direction * 390, 0, 950);
            scene.showMessage("El Acreedor fija un lazo sobre tu oro.", 1300);
          }
        } else if (!aiming) this.targetLockStartedAt = 0;
      }

      updateGuilt(time) {
        const scene = this.scene;
        if (time < this.stunnedUntil) return;
        if (!this.attackAt && scene.idleGroundSince && time - scene.idleGroundSince >= 1500) {
          this.windupUntil = time + 500; this.attackAt = this.windupUntil;
          this.targetX = scene.player.x;
        }
        if (this.attackAt && time >= this.attackAt) {
          this.attackAt = 0; this.windupUntil = 0;
          scene.spawnSymbolicAttack(this, "pillar", this.targetX, scene.player.y, 0, 0, 650);
        }
      }

      updateRelativeVoid(time) {
        const scene = this.scene, dx = scene.player.x - this.x, dy = Math.abs(scene.player.y - this.y);
        const seen = Math.sign(dx || this.direction) === this.direction && Math.abs(dx) < 210 && dy < 70;
        if (seen && !this.attackAt && time >= this.chargeReadyAt) {
          this.windupUntil = time + 500; this.attackAt = this.windupUntil; this.chargeReadyAt = time + 2200;
        }
        if (this.attackAt && time >= this.attackAt) {
          this.attackAt = 0; this.windupUntil = 0;
          if (!seen) { this.stunnedUntil = time + 1500; return; }
          if (scene.rng() < 0.5) scene.player.x = clamp(scene.player.x - this.direction * TILE * 3, TILE * 2, scene.generated.cols * TILE - TILE * 2);
          else scene.localGravityUntil = time + 2000;
          scene.invulnUntil = time + 500;
        }
      }

      updatePulse(time) {
        const scene = this.scene;
        if (scene.ending) return;
        let age = time - this.pulseStart;
        if (age >= 1900) {
          if (!this.pulseHit) this.stunnedUntil = time + 1500;
          this.pulseStart = time + 1600;
          this.windupUntil = 0;
          this.previousRadius = 0; this.pulseHit = false;
          return;
        }
        if (age < 0) return;
        const warning = age < 500;
        const radius = warning ? 24 + age / 500 * 16 : 40 + (age - 500) / 1400 * 110;
        this.ring.lineStyle(warning ? 2 : 3, warning ? 0xffce66 : 0xff596e, warning ? 0.55 + Math.sin(age * 0.025) * 0.25 : 0.85);
        this.ring.strokeCircle(this.x, this.y, radius);
        const distance = Math.hypot(scene.player.x - this.x, scene.player.y - this.y);
        if (!warning && !this.pulseHit && distance <= radius + 22 && distance >= this.previousRadius - 22) {
          this.pulseHit = true;
          if (scene.ending) return;
          if (this.kind === "dogma" && distance <= 30) {
            scene.blue.explode(10, scene.player.x, scene.player.y);
            scene.showMessage("El centro del polígono silencia el estallido.", 1100);
            return;
          }
          if (time < scene.dashUntil) {
            scene.parryAttack(this, time);
            return;
          } else {
            scene.takeDamage(1, "symbolic");
            return;
          }
        }
        if (!warning) this.previousRadius = radius;
      }

      destroy() {
        this.sprite.destroy(); this.ring.destroy();
      }
    }

    class ControlRig {
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

    class GameScene extends Phaser.Scene {
      constructor() {
        super("Game");
      }

      init(data) {
        this.levelNumber = clamp(data.level || 1, 1, TOTAL_STAGES);
        this.worldNumber = Math.ceil(this.levelNumber / 2);
        this.substage = this.levelNumber % 2 ? 1 : 2;
        this.seed = data.seed || `blank-${Date.now()}`;
        this.runId = data.runId || newRunId();
        this.maxHp = clamp(data.maxHp || 5, 1, 5);
        this.hp = clamp(data.hp || 5, 1, this.maxHp);
        this.creditPact = Boolean(data.creditPact);
        this.debtMass = this.creditPact ? 1.1 : 1;
        this.coins = data.coins || 0;
        this.bombs = data.bombs ?? 3;
        this.runFragments = data.fragments || runFragmentBank();
        this.stageFragmentBase = this.runFragments;
        this.isCustomSeed = Boolean(data.isCustomSeed);
      }

      create() {
        this.meta = loadMeta();
        this.levelInfo = LEVELS[this.worldNumber - 1] || LEVELS[0];
        this.currentSeed = /^\d+$/.test(String(this.seed)) ? Number(this.seed) : hashSeed(String(this.seed));
        this.rng = mulberry32(this.currentSeed);
        this.cameras.main.fadeIn(350, 4, 6, 10);
        this.cameras.main.setBackgroundColor(Phaser.Display.Color.IntegerToColor(this.levelInfo.bgTop).rgba);
        this.physics.world.gravity.y = Math.round(BASE_GRAVITY * gravityMultiplier(this.meta) * this.debtMass);
        this.physics.world.TILE_BIAS = 24;
        this.invulnUntil = 0;
        this.lastDamageAt = -1000;
        this.lastGroundedAt = -9999;
        this.lastJumpPressAt = -9999;
        this.dashReadyAt = 0;
        this.dashUntil = 0;
        this.dashDirection = 1;
        this.doubtUntil = 0;
        this.staggerUntil = 0;
        this.absorptionUntil = 0;
        this.nearSymbolic = null;
        this.nearPortable = null;
        this.nearStunned = null;
        this.nearSpecial = null;
        this.nearMerchant = false;
        this.merchantSelection = 0;
        this.featherBoots = false;
        this.guardianMirror = false;
        this.sacrificeDaggerUsed = false;
        this.abyssBagCharges = 0;
        this.certaintyAnchor = false;
        this.bottledPyre = false;
        this.amnesiaReady = lawActive(this.meta, "selectiveAmnesia");
        this.airJumps = 1;
        this.inertiaUntil = 0;
        this.inertiaDirection = 0;
        this.fluidezAirUntil = 0;
        this.fluidezAirVelocity = 0;
        this.symbolicAttacks = [];
        this.playerHistory = [];
        this.idleGroundSince = 0;
        this.localGravityUntil = 0;
        this.riskFog = false;
        this.riskJumpUntil = 0;
        this.riskInvulnerableUntil = 0;
        this.nearPrompt = "";
        this.perceptionTimer = 0;
        this.inverted = false;
        this.heat = this.levelInfo.key === "volcano" ? 14 : 0;
        this.godPowerTimer = 0;
        this.ascentUntil = 0;
        this.walkDustTimer = 0;
        this.skidDustReadyAt = 0;
        this.maxFallSpeed = 0;
        this.landingFeelReadyAt = 0;
        this.nearDramatic = null;
        this.warnedDramaticId = null;
        this.carried = null;
        this.thrownEntities = [];
        this.actionHoldStartedAt = 0;
        this.channelToneAt = 0;
        this.confinementAnchor = null;
        this.confinedSince = 0;
        this.graceAvailable = false;
        this.interactionConsumedUntil = 0;
        this.usedExit = false;
        this.ending = false;
        this.onSlope = false;
        this.currentMessage = this.levelInfo.mantra;
        this.messageTimer = 4300;

        this.createBackground();
        this.generated = new ProceduralMap(this.currentSeed, this.levelInfo, this.meta, this.levelNumber).generate();
        this.createWorld();
        this.createEntities();
        this.createPlayer();
        this.createEffects();
        this.rubble = this.add.particles(0, 0, "particle-white", {
          lifespan: { min: 260, max: 620 }, speed: { min: 45, max: 210 }, gravityY: 420,
          tint: this.levelInfo.accent, scale: { start: 0.75, end: 0 }, alpha: { start: 0.8, end: 0 },
          maxParticles: 90, emitting: false
        }).setDepth(19);
        this.symbolicEntities = this.generated.symbolicSpawns.map(spawn => new SymbolicEntity(this, spawn));
        if (this.creditPact) this.spawnDebtCreditor();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          for (const entity of this.symbolicEntities) entity.destroy();
          for (const attack of this.symbolicAttacks || []) attack.graphics?.destroy();
          this.symbolicAttacks = [];
          this.symbolicEntities = [];
          this.nearSymbolic = null;
        });
        this.createHud();
        if (!this.sys.game.__blankSoulPointersReady) {
          this.input.addPointer(4);
          this.sys.game.__blankSoulPointersReady = true;
        }
        this.controls = new ControlRig(this);
        this.setupCollisions();
        this.cameras.main.setBounds(0, 0, this.generated.cols * TILE, this.generated.rows * TILE);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.08);
        this.configureCamera();
        this.scale.on("resize", this.configureCamera, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.configureCamera, this));
        this.physics.world.setBounds(0, 0, this.generated.cols * TILE, this.generated.rows * TILE + 360);
        this.input.on("pointerdown", () => { AUDIO.unlock(); AUDIO.setDrone(this.levelInfo); });
        this.input.keyboard.on("keydown", () => { AUDIO.unlock(); AUDIO.setDrone(this.levelInfo); });
        this.input.keyboard.on("keydown-ESC", this.pauseGame, this);
        this.input.keyboard.on("keydown-P", this.pauseGame, this);
        AUDIO.setDrone(this.levelInfo);
      }

      configureCamera() {
        const sw = screenW(this);
        const sh = screenH(this);
        const portrait = sh > sw;
        this.cameras.main.deadzone = new Phaser.Geom.Rectangle(0, 0, Math.min(110, sw * 0.23), portrait ? 110 : 70);
        this.cameras.main.setFollowOffset(0, portrait ? -60 : -30);
        // Keep the existing scroll on rotation; following converges without recentering.
        this.cameraPortrait = portrait;
        this.cameraSettleMs = 700;
      }

      createBackground() {
        const width = 78 * TILE;
        const height = 72 * TILE;
        const g = this.add.graphics().setScrollFactor(0.25).setDepth(-30);
        g.fillStyle(this.levelInfo.bgTop, 1);
        g.fillRect(-200, -100, width + 400, height + 200);
        g.fillStyle(this.levelInfo.bgMid, 0.68);
        g.fillRect(-200, height * 0.24, width + 400, height * 0.38);
        g.fillStyle(this.levelInfo.bgLow, 0.32);
        g.fillRect(-200, height * 0.58, width + 400, height * 0.52);

        if (this.levelInfo.key === "desert") {
          for (let i = 0; i < 16; i += 1) {
            const x = i * 190 + 30;
            const y = 230 + Math.sin(i) * 36;
            g.fillStyle(i % 2 ? 0x4a2f2a : 0x69402d, 0.6);
            g.fillRect(x, y, 26, 260);
            g.fillRect(x - 10, y, 46, 12);
          }
          g.lineStyle(3, 0xffc76f, 0.18);
          for (let y = 330; y < 1100; y += 90) {
            g.beginPath();
            g.moveTo(-50, y);
            for (let x = -50; x < width + 200; x += 80) g.lineTo(x, y + Math.sin((x + y) * 0.008) * 22);
            g.strokePath();
          }
        }

        if (this.levelInfo.key === "jungle") {
          g.lineStyle(5, 0x0f2e21, 0.72);
          for (let x = 20; x < width + 260; x += 84) {
            g.beginPath();
            g.moveTo(x, -20);
            for (let y = -20; y < height + 60; y += 80) g.lineTo(x + Math.sin(y * 0.012 + x) * 28, y);
            g.strokePath();
          }
          for (let i = 0; i < 120; i += 1) {
            g.fillStyle(i % 2 ? 0x72f0b1 : 0xb987ff, 0.08);
            g.fillCircle(Between(0, width), Between(0, height), Between(5, 15));
          }
        }

        if (this.levelInfo.key === "volcano") {
          for (let i = 0; i < 28; i += 1) {
            g.fillStyle(0x2a1113, 0.72);
            const x = i * 95;
            g.fillTriangle(x - 80, 700, x + 80, 700, x + 10, 180 + (i % 5) * 40);
          }
          g.lineStyle(4, 0xff7438, 0.32);
          for (let x = 40; x < width; x += 170) {
            g.beginPath();
            g.moveTo(x, 200);
            g.lineTo(x + 38, 440);
            g.lineTo(x - 14, 760);
            g.strokePath();
          }
        }

        if (this.levelInfo.key === "void" && this.stageNumber === TOTAL_STAGES) {
          for (let i = 0; i < 130; i += 1) {
            g.fillStyle(i % 11 === 0 ? 0x9dfcff : 0xf4f0e2, Phaser.Math.FloatBetween(0.15, 0.82));
            g.fillRect(Between(0, width), Between(0, height), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
          }
          g.lineStyle(2, 0xf4f0e2, 0.14);
          for (let i = 0; i < 10; i += 1) {
            g.strokeCircle(width * 0.5, 520 + i * 78, 220 + i * 85);
          }
        }
      }

      createWorld() {
        const map = this.make.tilemap({ data: this.generated.data, tileWidth: TILE, tileHeight: TILE });
        const tileset = map.addTilesetImage(this.levelInfo.tile, this.levelInfo.tile, TILE, TILE, 0, 0, 1);
        this.terrain = map.createLayer(0, tileset, 0, 0);
        this.terrain.setCollision(1);
        this.terrain.setDepth(1);
        this.map = map;
        this.veinMarks = new Map();
        for (const vein of this.generated.veinCells) {
          const mark = this.add.graphics().setDepth(2);
          const x = vein.tx * TILE, y = vein.ty * TILE;
          mark.lineStyle(2, this.levelInfo.accent, 0.72);
          mark.beginPath(); mark.moveTo(x + 5, y + 3); mark.lineTo(x + 17, y + 13);
          mark.lineTo(x + 10, y + 21); mark.lineTo(x + 27, y + 29); mark.strokePath();
          this.veinMarks.set(`${vein.tx},${vein.ty}`, mark);
        }
        this.routeGraphics = this.add.graphics().setDepth(3);
        this.routeGraphics.lineStyle(2, 0x8af0b0, 0.65);
        for (const p of this.generated.path) {
          this.routeGraphics.lineBetween(p.rect.x + 4, p.y + 2, p.rect.x + p.rect.width - 4, p.y + 2);
          if (p.exitDirection) {
            const x = p.departureX - p.exitDirection * 24;
            this.routeGraphics.lineBetween(x - p.exitDirection * 15, p.y - 15, x, p.y - 15);
            this.routeGraphics.lineBetween(x, p.y - 15, x - p.exitDirection * 6, p.y - 21);
            this.routeGraphics.lineBetween(x, p.y - 15, x - p.exitDirection * 6, p.y - 9);
          }
        }
        this.dramaticLabels = [];
        for (const route of this.generated.dramaticRoutes) {
          this.routeGraphics.lineStyle(2, 0xffb14a, 0.65);
          this.routeGraphics.lineBetween(route.launchX, route.floorY - 12, route.launchX, route.floorY - 62);
          this.routeGraphics.lineBetween(route.launchX, route.floorY - 62, route.launchX - 8, route.floorY - 52);
          this.routeGraphics.lineBetween(route.launchX, route.floorY - 62, route.launchX + 8, route.floorY - 52);
          const label = this.add.text(route.x, route.floorY - 90, "RUTA DRAMÁTICA\nOFRENDA", {
            fontFamily: "monospace", fontSize: "11px", color: "#ffcf83", align: "center",
            backgroundColor: "#171015", padding: { x: 5, y: 4 }
          }).setOrigin(0.5).setDepth(4);
          this.dramaticLabels.push({ route, label });
        }

        this.slopeGraphics = this.add.graphics().setDepth(0);
        this.slopeGraphics.fillStyle(this.levelInfo.accent, 0.18);
        this.slopeGraphics.lineStyle(2, this.levelInfo.accent, 0.28);
        for (const slope of this.generated.slopes) {
          this.slopeGraphics.beginPath();
          if (slope.dir > 0) {
            this.slopeGraphics.moveTo(slope.x, slope.y + slope.height);
            this.slopeGraphics.lineTo(slope.x + slope.width, slope.y);
            this.slopeGraphics.lineTo(slope.x + slope.width, slope.y + slope.height);
          } else {
            this.slopeGraphics.moveTo(slope.x, slope.y);
            this.slopeGraphics.lineTo(slope.x + slope.width, slope.y + slope.height);
            this.slopeGraphics.lineTo(slope.x, slope.y + slope.height);
          }
          this.slopeGraphics.closePath();
          this.slopeGraphics.fillPath();
          this.slopeGraphics.strokePath();
        }

        this.ladderZones = [];
        this.ladderGroup = this.add.group();
        for (const ladder of this.generated.ladders) {
          for (let y = ladder.y; y < ladder.y + ladder.height; y += TILE) {
            const tile = this.add.image(ladder.x + 16, y + 16, "ladder").setDepth(0);
            this.ladderGroup.add(tile);
          }
          const zone = this.add.zone(ladder.x + 16, ladder.y + ladder.height / 2, TILE, ladder.height);
          this.physics.add.existing(zone, true);
          this.ladderZones.push(zone);
        }
      }

      createEntities() {
        this.coinsGroup = this.physics.add.group({ allowGravity: false, immovable: true });
        for (const c of this.generated.coins) {
          const coin = this.coinsGroup.create(c.x, c.y, "coin");
          coin.body.setCircle(10, 2, 2);
          coin.phase = this.rng() * Math.PI * 2;
        }

        this.fragmentsGroup = this.physics.add.group({ allowGravity: false, immovable: true });
        for (const f of this.generated.fragments) {
          const shard = this.fragmentsGroup.create(f.x, f.y, "fragment");
          shard.body.setSize(18, 22).setOffset(3, 4);
          shard.phase = this.rng() * Math.PI * 2;
          shard.dramaticId = f.dramaticId || null;
        }

        this.spikesGroup = this.physics.add.staticGroup();
        for (const s of this.generated.spikes) this.spikesGroup.create(s.x, s.y + 7, "spike").refreshBody();

        this.cratesGroup = this.physics.add.group({
          bounceX: 0.02,
          bounceY: 0,
          dragX: 780,
          maxVelocityX: 140
        });
        for (const c of this.generated.crates) {
          const crate = this.cratesGroup.create(c.x, c.y, "crate");
          crate.body.setSize(30, 30);
          crate.pickupType = "crate";
        }

        this.bouldersGroup = this.physics.add.group({ bounceX: 0.25, bounceY: 0.2, dragX: 12 });
        for (const b of this.generated.boulders) {
          const rock = this.bouldersGroup.create(b.x, b.y, "boulder");
          rock.body.setCircle(17, 1, 1);
          rock.body.allowGravity = false;
          rock.body.setMaxVelocity(240, 420);
          rock.sleepingStone = true;
          rock.pickupType = "boulder";
        }

        this.altarsGroup = this.physics.add.staticGroup();
        for (const a of this.generated.altars) {
          const altar = this.altarsGroup.create(a.x, a.y, "altar").refreshBody();
          altar.body.setSize(62, 50).setOffset(1, 2);
        }

        this.sporesGroup = this.physics.add.group({ allowGravity: false, immovable: true });
        for (const s of this.generated.spores) {
          const spore = this.sporesGroup.create(s.x, s.y, "spore");
          spore.body.setCircle(12, 2, 2);
          spore.phase = this.rng() * Math.PI * 2;
        }

        this.lavaZones = [];
        this.lavaGraphics = this.add.graphics().setDepth(2);
        for (const lava of this.generated.lava) {
          const zone = this.add.zone(lava.x + lava.width / 2, lava.y + lava.height / 2, lava.width, lava.height);
          this.physics.add.existing(zone, true);
          this.lavaZones.push(zone);
        }
        this.drawLava(0);

        this.destructiblesGroup = this.physics.add.staticGroup();
        for (const d of this.generated.destructibles) {
          const wall = this.destructiblesGroup.create(d.x, d.y, "break-wall").refreshBody();
          wall.hp = 1;
          wall.dramaticId = d.dramaticId || null;
        }

        this.exitDoor = this.physics.add.staticImage(this.generated.exit.x, this.generated.exit.y + 6, "exit");
        this.exitDoor.refreshBody();

        this.bombsGroup = this.physics.add.group({ bounceX: 0.42, bounceY: 0.32, dragX: 180 });
        this.potsGroup = this.physics.add.group({ bounceX: 0.28, bounceY: 0.18, dragX: 420 });
        for (const p of this.generated.pots) {
          const pot = this.potsGroup.create(p.x, p.y, "pot");
          pot.body.setSize(26, 29).setOffset(3, 2);
          pot.pickupType = "pot";
        }

        if (this.generated.god) this.createGod();
        this.createSpecialSites();
      }

      createSpecialSites() {
        this.specialSites = [];
        for (const room of this.generated.specialRooms) {
          const g = this.add.graphics().setDepth(4);
          const color = room.type === "barter" ? 0x75f1b4 : 0xff596e;
          const w = room.widthTiles * TILE, h = room.heightTiles * TILE;
          g.fillStyle(0x03050a, 0.94); g.fillRect(room.x - w / 2, room.y - h + 25, w, h);
          g.lineStyle(3, color, 0.82); g.beginPath();
          g.arc(room.x, room.y - h + 25 + w / 2, w / 2 - 3, Math.PI, Math.PI * 2);
          g.lineTo(room.x + w / 2 - 3, room.y + 25); g.moveTo(room.x - w / 2 + 3, room.y + 25);
          g.lineTo(room.x - w / 2 + 3, room.y - h / 2); g.strokePath();
          g.strokeCircle(room.x, room.y - 7, room.type === "barter" ? 15 : 20);
          if (room.type === "barter") g.lineBetween(room.x - 24, room.y + 17, room.x + 24, room.y + 17);
          else { g.lineBetween(room.x - 20, room.y - 7, room.x + 20, room.y - 7); g.lineBetween(room.x, room.y - 27, room.x, room.y + 13); }
          const label = this.add.text(room.x, room.y + 35, room.type === "barter" ? "ALTAR DEL TRUEQUE" : "POZO DEL RIESGO", {
            fontFamily: "monospace", fontSize: "11px", color: `#${color.toString(16).padStart(6, "0")}`, align: "center"
          }).setOrigin(0.5).setDepth(5);
          this.specialSites.push({ room, graphics: g, label });
        }
        const merchant = this.generated.merchant;
        if (!merchant) return;
        const caveW = merchant.widthTiles * TILE, caveH = merchant.heightTiles * TILE;
        this.merchantGraphics = this.add.graphics().setDepth(6);
        this.merchantGraphics.fillStyle(0x020308, 0.96).fillRect(merchant.x - caveW / 2, merchant.y - caveH + 28, caveW, caveH);
        const biomeArch = { desert: 0xd7a85c, jungle: 0x62c98e, volcano: 0xe76842, void: 0xc9c5da }[this.levelInfo.key];
        this.merchantGraphics.lineStyle(4, biomeArch, 0.8).beginPath();
        this.merchantGraphics.arc(merchant.x, merchant.y - caveH + 28 + caveW / 2, caveW / 2 - 4, Math.PI, Math.PI * 2);
        this.merchantGraphics.lineTo(merchant.x + caveW / 2 - 4, merchant.y + 28);
        this.merchantGraphics.moveTo(merchant.x - caveW / 2 + 4, merchant.y + 28);
        this.merchantGraphics.lineTo(merchant.x - caveW / 2 + 4, merchant.y - caveH / 2);
        this.merchantGraphics.strokePath();
        this.merchantGraphics.lineStyle(2, biomeArch, 0.35);
        for (let i = -2; i <= 2; i += 1) this.merchantGraphics.strokeCircle(merchant.x + i * 32, merchant.y - 54, 17);

        // --- Evolución narrativa del Mercader según el mundo actual ---
        const floorY = merchant.y + 30;            // nivel del suelo de la cueva
        const machineW = 58, machineH = 76;        // tamaño de la máquina expendedora
        const cx = merchant.x;
        const W = this.worldNumber;

        if (W === 1 || W === 2) {
          // Máquina expendedora rectangular: fría, puramente transaccional
          this.merchantGraphics.fillStyle(0x20242c, 1);
          this.merchantGraphics.fillRoundedRect(cx - machineW / 2, floorY - machineH, machineW, machineH, 5);
          this.merchantGraphics.lineStyle(2, 0x9dfcff, 0.85);
          this.merchantGraphics.strokeRoundedRect(cx - machineW / 2, floorY - machineH, machineW, machineH, 5);
          // Vitrina con mercancías
          this.merchantGraphics.fillStyle(0x0b1119, 0.92);
          this.merchantGraphics.fillRoundedRect(cx - machineW / 2 + 6, floorY - machineH + 6, machineW - 12, 30, 3);
          this.merchantGraphics.fillStyle(0x9dfcff, 0.16);
          this.merchantGraphics.fillRect(cx - machineW / 2 + 8, floorY - machineH + 8, machineW - 16, 26);
          // Mesa selector / botones luminosos
          const btnColors = [0xff596e, 0x75f1b4, 0x9ef9ff, 0xffb14a];
          this.merchantGraphics.fillStyle(0x10141d, 1);
          this.merchantGraphics.fillRect(cx - machineW / 2 + 6, floorY - machineH + 41, machineW - 12, 18);
          for (let i = 0; i < 4; i += 1) {
            this.merchantGraphics.fillStyle(btnColors[i], 0.9);
            this.merchantGraphics.fillCircle(cx - machineW / 2 + 14 + i * 12, floorY - machineH + 50, 3);
          }
          // Rejilla + ranura de entrega inferior
          this.merchantGraphics.fillStyle(0x151b26, 1);
          this.merchantGraphics.fillRect(cx - machineW / 2 + 10, floorY - 22, machineW - 20, 12);
          this.merchantGraphics.fillStyle(0x0c0f16, 1);
          this.merchantGraphics.fillRoundedRect(cx - 18, floorY - 7, 36, 7, 2);
          this.merchantGraphics.lineStyle(1, 0xbfd9e6, 0.35);
          this.merchantGraphics.strokeRect(cx - 18, floorY - 7, 36, 7);
        } else if (W === 3) {
          // Máquina rota / ladeada + entidad reparándola + chispas
          const tilt = 0.17;
          this.merchantGraphics.save();
          this.merchantGraphics.translateCanvas(cx, floorY);
          this.merchantGraphics.rotateCanvas(tilt);
          this.merchantGraphics.fillStyle(0x2a2f3a, 1);
          this.merchantGraphics.fillRoundedRect(-machineW / 2, -machineH, machineW, machineH, 5);
          this.merchantGraphics.lineStyle(2, 0x5d6470, 0.9);
          this.merchantGraphics.strokeRoundedRect(-machineW / 2, -machineH, machineW, machineH, 5);
          // Vitrina agrietada
          this.merchantGraphics.fillStyle(0x0b1119, 0.92);
          this.merchantGraphics.fillRoundedRect(-machineW / 2 + 6, -machineH + 6, machineW - 12, 30, 3);
          this.merchantGraphics.lineStyle(1, 0x9dfcff, 0.55);
          this.merchantGraphics.beginPath();
          this.merchantGraphics.moveTo(0, -machineH + 10);
          this.merchantGraphics.lineTo(-12, -machineH + 24);
          this.merchantGraphics.lineTo(6, -machineH + 34);
          this.merchantGraphics.strokePath();
          // Botones apagados / en cortocircuito
          for (let i = 0; i < 4; i += 1) {
            this.merchantGraphics.fillStyle(i % 2 ? 0xff596e : 0x3a4150, 0.6);
            this.merchantGraphics.fillCircle(-machineW / 2 + 14 + i * 12, -machineH + 50, 3);
          }
          this.merchantGraphics.restore();
          // Silueta de la entidad al lado, "arreglando" la máquina
          const sideX = cx + machineW / 2 + 18, sideY = floorY - 4;
          this.merchantGraphics.fillStyle(0x232a33, 0.92);
          this.merchantGraphics.fillRoundedRect(sideX - 9, sideY - 54, 17, 32, 6);   // torso
          this.merchantGraphics.fillCircle(sideX, sideY - 62, 9);                      // cabeza
          this.merchantGraphics.fillRect(sideX + 4, sideY - 46, 28, 4);                // brazo hacia la máquina
          this.merchantGraphics.fillRect(sideX - 6, sideY - 20, 3, 22);                // piernas
          this.merchantGraphics.fillRect(sideX + 4, sideY - 20, 3, 22);
          this.merchantGraphics.lineStyle(2, 0xffb14a, 0.9);
          this.merchantGraphics.strokeCircle(sideX, sideY - 62, 9);
          // Chispas (particle-fire) saliendo del panel abierto
          this.merchantSparks = this.add.particles(cx + machineW / 4, floorY - machineH + 22, "particle-fire", {
            lifespan: { min: 220, max: 480 },
            speed: { min: 18, max: 85 },
            gravityY: 260,
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.9, end: 0 },
            frequency: 34,
            maxParticles: 40,
            emitting: true
          }).setDepth(7);
        } else {
          // Mundo 4: la Entidad se muestra completa — diseño final
          this.merchantGraphics.fillStyle(0x3a4150, 1);
          this.merchantGraphics.fillRoundedRect(cx - machineW / 2 - 4, floorY - 8, machineW + 8, 8, 3); // plinto
          this.merchantGraphics.lineStyle(2, 0x9ef9ff, 1);
          this.merchantGraphics.fillStyle(0x9ef9ff, 0.16);
          this.merchantGraphics.fillRoundedRect(cx - 13, floorY - 66, 26, 34, 6);
          this.merchantGraphics.strokeRoundedRect(cx - 13, floorY - 66, 26, 34, 6);
          this.merchantGraphics.fillCircle(cx, floorY - 76, 12);
          this.merchantGraphics.strokeCircle(cx, floorY - 76, 12);
          // Brazos de la entidad
          this.merchantGraphics.lineBetween(cx - 10, floorY - 34, cx - 14, floorY - 6);
          this.merchantGraphics.lineBetween(cx + 10, floorY - 34, cx + 14, floorY - 6);
          // Halo/emblema del linaje
          this.merchantGraphics.lineStyle(2, 0xffb14a, 0.9);
          this.merchantGraphics.strokeCircle(cx, floorY - 76, 15);
          // Caja dispensadora abierta a sus pies con mercancías
          this.merchantGraphics.fillStyle(0x20242c, 1);
          this.merchantGraphics.fillRect(cx - 30, floorY - 12, 24, 12);
          this.merchantGraphics.fillStyle(0xffb14a, 1).fillCircle(cx - 24, floorY - 17, 3);
          this.merchantGraphics.fillStyle(0x75f1b4, 1).fillCircle(cx - 17, floorY - 17, 3);
          this.merchantGraphics.fillStyle(0x9ef9ff, 1).fillCircle(cx - 10, floorY - 17, 3);
        }
        this.merchantLabel = this.add.text(merchant.x, merchant.y + 39, "MERCADER TURBIO", {
          fontFamily: "monospace", fontSize: "11px", color: "#9dfcff"
        }).setOrigin(0.5).setDepth(7);
      }

      createGod() {
        const g = this.add.graphics().setDepth(0);
        const god = this.generated.god;
        g.fillStyle(0xe9e4d7, 0.92);
        g.fillRoundedRect(god.x - 150, god.y - 18, 300, 192, 28);
        g.fillStyle(0x292c36, 1);
        g.fillCircle(god.x, god.y + 58, 54);
        g.fillStyle(0xf7fbff, 1);
        g.fillCircle(god.x, god.y + 58, 34);
        g.fillStyle(0x05060a, 1);
        g.fillCircle(god.x, god.y + 58, 12);
        g.lineStyle(3, 0x6f7382, 0.58);
        for (let i = 0; i < 7; i += 1) {
          const x = god.x - 126 + i * 42;
          g.beginPath();
          g.moveTo(x, god.y + 5);
          g.lineTo(x + Math.sin(i) * 26, god.y + 166);
          g.strokePath();
        }
        g.fillStyle(0xe9e4d7, 0.55);
        g.fillRoundedRect(god.x - 230, god.y + 64, 80, 140, 24);
        g.fillRoundedRect(god.x + 150, god.y + 64, 80, 140, 24);
        this.godZone = this.add.zone(god.zone.x + god.zone.width / 2, god.zone.y + god.zone.height / 2, god.zone.width, god.zone.height);
        this.physics.add.existing(this.godZone, true);
      }

      spawnDebtCreditor() {
        if ((this.symbolicEntities || []).some(entity => entity.kind === "creditor")) return;
        const p = this.generated.path[Math.min(4, this.generated.path.length - 1)];
        const entity = new SymbolicEntity(this, { kind: "creditor", x: p.centerX, y: p.y - 19,
          left: p.rect.x + 30, right: p.rect.x + p.rect.width - 30,
          phase: this.rng() * Math.PI * 2, direction: -1 });
        entity.debtCollector = true;
        this.symbolicEntities.push(entity);
        this.blue.explode(18, entity.x, entity.y);
      }

      createPlayer() {
        this.player = this.physics.add.sprite(this.generated.spawn.x, this.generated.spawn.y, "player");
        this.player.setDepth(8);
        this.player.body.setSize(20, 35).setOffset(6, 10);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setMaxVelocity(300, 620);
        this.player.body.setDragX(0);
        this.player.facing = 1;
        this.player.wasGrounded = true;

        // === RIG ESQUELÉTICO (Paper-Doll) — ETAPA 2 ===
        // El sprite físico pasa a ser un collider Arcade invisible. Toda la fisica
        // (setSize/setOffset/setCollideWorldBounds, etc.) se conserva intacta arriba;
        // la representación visual ahora la lleva el contenedor this.playerRig.
        this.player.setVisible(false);

        // Contenedor visual anclado a la posicion del collider. Se mueve con el
        // jugador en handleMovement() (ETAPA 2: solo pose neutra, aun sin animar).
        this.playerRig = this.add.container(this.player.x, this.player.y).setDepth(8);

        // Piezas del cuerpo. Los miembros pivotan desde el hombro/cadera (en lugar del
        // centro) gracias a setOrigin(0.5, 0); sus coordenadas x/y son relativas al
        // contenedor y arman una figura humanoide en pose neutra.
        // Orden estricto (atras -> adelante):
        //   backArm -> backLeg -> torso -> head -> frontLeg -> frontArm
        const rigBackArm = this.add.sprite(-9, -8, "player-limb-back").setOrigin(0.5, 0);
        const rigBackLeg = this.add.sprite(-4, 7, "player-limb-back").setOrigin(0.5, 0);
        const rigTorso = this.add.sprite(0, -1, "player-torso");
        const rigHead = this.add.sprite(0, -14, "player-head");
        const rigFrontLeg = this.add.sprite(4, 7, "player-limb").setOrigin(0.5, 0);
        const rigFrontArm = this.add.sprite(9, -8, "player-limb").setOrigin(0.5, 0);

        // Referencias guardadas para animar (trigonometria) en la ETAPA 3.
        this.rigParts = {
          head: rigHead,
          torso: rigTorso,
          backArm: rigBackArm,
          backLeg: rigBackLeg,
          frontArm: rigFrontArm,
          frontLeg: rigFrontLeg
        };
        this.playerRig.add([rigBackArm, rigBackLeg, rigTorso, rigHead, rigFrontLeg, rigFrontArm]);
      }

      createEffects() {
        this.dust = this.add.particles(0, 0, "particle-white", {
          lifespan: { min: 220, max: 430 },
          speed: { min: 20, max: 115 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 0.45, end: 0 },
          emitting: false
        }).setDepth(20);
        this.spark = this.add.particles(0, 0, "particle-fire", {
          lifespan: { min: 240, max: 520 },
          speed: { min: 35, max: 190 },
          gravityY: 320,
          scale: { start: 0.9, end: 0 },
          alpha: { start: 0.9, end: 0 },
          emitting: false
        }).setDepth(20);
        this.blue = this.add.particles(0, 0, "particle-blue", {
          lifespan: { min: 360, max: 760 },
          speed: { min: 25, max: 130 },
          scale: { start: 1.1, end: 0 },
          alpha: { start: 0.85, end: 0 },
          emitting: false
        }).setDepth(20);
        // Fuente de salud: flujo sutil de motas que ascienden desde el cuenco
        this.altarWater = this.add.particles(0, 0, "particle-blue", {
          lifespan: { min: 520, max: 1150 },
          speedX: { min: -14, max: 14 },
          speedY: { min: -46, max: -16 },
          gravityY: -14,
          scale: { start: 0.62, end: 0 },
          alpha: { start: 0.5, end: 0 },
          frequency: 90,
          maxParticles: 26,
          emitting: false
        }).setDepth(7);
        this.sporeMist = this.add.particles(0, 0, "particle-spore", {
          lifespan: { min: 550, max: 1150 },
          speed: { min: 8, max: 48 },
          gravityY: -25,
          scale: { start: 0.9, end: 0 },
          alpha: { start: 0.42, end: 0 },
          emitting: false
        }).setDepth(20);
        this.footDust = this.add.particles(0, 0, "particle-white", {
          lifespan: { min: 150, max: 300 },
          speedX: { min: -20, max: 20 }, speedY: { min: -18, max: -7 },
          gravityY: 35, tint: this.levelInfo.accent,
          scale: { start: 0.45, end: 0 }, alpha: { start: 0.36, end: 0 },
          maxParticles: 24, emitting: false
        }).setDepth(7);
        this.channelRing = this.add.graphics().setDepth(21);
        this.portableHalo = this.add.graphics().setDepth(18);
      }

      createHud() {
        const sw = screenW(this);
        const sh = screenH(this);
        const hudW = Math.min(468, sw - 24);
        this.hudBg = this.add.rectangle(12, 12, hudW, 102, 0x04060b, 0.56)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(900);
        this.hudBg.setStrokeStyle(1, 0x9dfcff, 0.24);
        this.hudText = this.add.text(24, 20, "", {
          fontFamily: "monospace",
          fontSize: `${sw < 520 ? 11 : 14}px`,
          color: "#eefcff",
          lineSpacing: sw < 520 ? 2 : 4,
          wordWrap: { width: hudW - 22 }
        }).setScrollFactor(0).setDepth(901);
        this.promptText = this.add.text(sw / 2, sh - 86, "", {
          fontFamily: "monospace",
          fontSize: `${sw < 520 ? 12 : 15}px`,
          color: "#f7fbff",
          align: "center",
          backgroundColor: "rgba(2, 5, 12, 0.58)",
          padding: { left: 14, right: 14, top: 8, bottom: 8 },
          wordWrap: { width: Math.min(650, sw - 34) }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(902);
        this.lawText = this.add.text(sw - 22, 20, "", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#9fb1bb",
          align: "right",
          lineSpacing: 5
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(901);
        this.pauseBtn = this.add.text(sw - 16, 20, "❚❚", {
          fontFamily: "monospace",
          fontSize: `${screenW(this) < 520 ? 13 : 15}px`,
          color: "#eefcff",
          backgroundColor: "rgba(2, 5, 12, 0.72)",
          padding: { left: 10, right: 10, top: 7, bottom: 7 }
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(903).setInteractive({ useHandCursor: true });
        this.pauseBtn.on("pointerdown", () => this.pauseGame());
        // Texto discreto "Modo Libre" cuando la run se inicia con Semilla Personalizada.
        if (this.isCustomSeed) {
          this.customSeedTag = this.add.text(24, 122, "Modo Libre: Progreso desactivado", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#ff4766",
            backgroundColor: "rgba(4, 6, 11, 0.6)",
            padding: { left: 6, right: 6, top: 3, bottom: 3 }
          }).setScrollFactor(0).setDepth(902);
        }
        this.darkness = this.add.graphics().setScrollFactor(0).setDepth(850);
        this.lightGlow = this.add.graphics().setScrollFactor(0).setDepth(851);
        this.layoutHud();
        this.scale.on("resize", this.layoutHud, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layoutHud, this));
      }

      layoutHud() {
        if (!this.hudBg) return;
        const sw = screenW(this);
        const sh = screenH(this);
        const narrow = sw < 620 || sh < 460;
        const short = sh < 460;
        const fineHover = window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
        const likelyTouch = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !fineHover) || sw < 640 || sh < 460;
        const hudW = Math.max(280, Math.min(short ? 320 : (narrow ? sw - 24 : 468), sw - 24));
        const hudH = narrow ? 92 : 102;
        this.hudBg.setPosition(12, 12);
        this.hudBg.setSize(hudW, hudH);
        this.hudBg.displayWidth = hudW;
        this.hudBg.displayHeight = hudH;
        this.hudText.setPosition(24, 20);
        this.hudText.setFontSize(narrow ? 11 : 14);
        this.hudText.setWordWrapWidth(hudW - 22);
        this.promptText.setOrigin(short ? 1 : 0.5, short ? 0 : 1);
        this.promptText.setPosition(short ? sw - 12 : sw / 2, short ? 14 : sh - (likelyTouch ? 205 : 56));
        this.promptText.setFontSize(narrow ? 12 : 15);
        this.promptText.setWordWrapWidth(short ? Math.max(140, sw - hudW - 68) : Math.min(650, sw - 64));
        this.lawText.setPosition(sw - 22, this.pauseBtn.y + this.pauseBtn.height / 2 + 12);
        this.lawText.setVisible(sw >= 760 && !short);
        if (this.customSeedTag) {
          this.customSeedTag.setPosition(24, this.hudBg.y + this.hudBg.displayHeight + 6);
        }
      }

      pauseGame() {
        if (this.ending) return;
        if (this.scene.isPaused("Game")) return;
        this.scene.pause();
        this.scene.launch("Pause", { seed: this.currentSeed });
      }

      setupCollisions() {
        this.physics.add.collider(this.player, this.terrain);
        this.physics.add.collider(this.cratesGroup, this.terrain, this.onPortableTerrainHit, null, this);
        this.physics.add.collider(this.cratesGroup, this.cratesGroup);
        this.physics.add.collider(this.bouldersGroup, this.terrain, this.onBoulderTerrainHit, null, this);
        this.physics.add.collider(this.bombsGroup, this.terrain);
        this.physics.add.collider(this.bombsGroup, this.cratesGroup);
        this.physics.add.collider(this.potsGroup, this.terrain, this.onPortableTerrainHit, null, this);
        this.physics.add.collider(this.potsGroup, this.destructiblesGroup, this.onPortableWallHit, null, this);
        this.physics.add.collider(this.potsGroup, this.cratesGroup);
        this.physics.add.collider(this.player, this.potsGroup, this.onPushCrate, null, this);
        this.physics.add.collider(this.bouldersGroup, this.spikesGroup, this.onPortableSpikeHit, null, this);
        this.physics.add.collider(this.cratesGroup, this.spikesGroup, this.onPortableSpikeHit, null, this);
        this.physics.add.collider(this.potsGroup, this.spikesGroup, this.onPortableSpikeHit, null, this);
        this.physics.add.collider(this.bouldersGroup, this.cratesGroup, this.onBoulderCrateHit, null, this);
        this.physics.add.collider(this.player, this.cratesGroup, this.onPushCrate, null, this);
        this.physics.add.collider(this.player, this.destructiblesGroup);
        this.physics.add.collider(this.cratesGroup, this.destructiblesGroup, this.onPortableWallHit, null, this);
        this.physics.add.collider(this.bouldersGroup, this.destructiblesGroup, this.crackWall, null, this);
        this.physics.add.overlap(this.player, this.coinsGroup, this.collectCoin, null, this);
        this.physics.add.overlap(this.player, this.fragmentsGroup, this.collectFragment, null, this);
        this.physics.add.overlap(this.player, this.spikesGroup, () => this.takeDamage(2, "spikes"), null, this);
        this.physics.add.overlap(this.player, this.bouldersGroup, this.onBoulderHit, null, this);
        this.physics.add.overlap(this.player, this.sporesGroup, this.touchSpore, null, this);
        this.physics.add.overlap(this.player, this.exitDoor, () => { this.nearExit = true; }, null, this);
      }

      update(time, delta) {
        if (this.ending) return;
        const dt = Math.min(delta, 40);
        const settle = Math.max(0, this.cameraSettleMs || 0) * 400 / 700;
        this.cameraSettleMs = Math.max(0, (this.cameraSettleMs || 0) - dt);
        this.cameras.main.setLerp(1 - Math.exp(-dt / (150 + settle)), 1 - Math.exp(-dt / ((this.cameraPortrait ? 260 : 170) + settle)));
        this.nearExit = false;
        this.nearAltar = null;
        this.nearGod = false;
        this.resolveSlope();
        const controls = this.controls.read();
        if (controls.bombPressed) this.deployBomb(time);
        this.updateProximity();
        if (!this.certaintyAnchor && (this.inverted || time < this.doubtUntil)) controls.axis *= -1;
        if (time < this.staggerUntil) {
          controls.axis = 0;
          controls.jumpPressed = false;
          controls.up = controls.down = false;
        }
        this.handleLadders(controls);
        this.handleMovement(controls, time, dt);
        this.updatePlayerAnimation(time);
        if (this.ending) return;
        this.updateHandsRig?.(controls, time, dt);
        if (this.ending) return;
        for (const entity of this.symbolicEntities || []) {
          if (this.ending) return;
          entity.update(time, dt);
          if (this.ending) return;
        }
        this.updateSymbolicAttacks(time, dt);
        if (this.ending) return;
        this.updateProximity();
        this.handleInteractions(controls, time);
        if (this.ending) return;
        this.updateWorldDynamics(time, dt);
        if (this.ending) return;
        this.updateCaveSafeguards?.(controls, time, dt);
        if (this.ending) return;
        this.updateHud(time, dt);
        this.updateLighting(time);
        if (this.ending) return;
        this.checkDeathPlane();
        if (this.ending) return;
      }

      handleMovement(controls, time, dt) {
        const body = this.player.body;
        const onGround = body.blocked.down || body.touching.down || this.onSlope;
        // ETAPA 2: el contenedor visual sigue al collider invisible en cada frame.
        if (this.playerRig) {
          this.playerRig.setPosition(this.player.x, this.player.y);
        }
        if (onGround && Math.abs(body.velocity.x) < 8 && !controls.axis) {
          if (!this.idleGroundSince) this.idleGroundSince = time;
        } else this.idleGroundSince = 0;
        if (!this.playerHistory) this.playerHistory = [];
        this.playerHistory.push({ time, x: this.player.x, y: this.player.y, facing: this.player.facing });
        while (this.playerHistory.length && this.playerHistory[0].time < time - 1150) this.playerHistory.shift();
        if (!onGround && body.velocity.y > 0) this.maxFallSpeed = Math.max(this.maxFallSpeed, body.velocity.y);
        if (onGround) { this.lastGroundedAt = time; this.airJumps = 1; }
        if (controls.jumpPressed) this.lastJumpPressAt = time;

        const coinBurden = this.featherBoots ? 0 : effectiveCoinBurden(this.coins, this.meta);
        const empowered = time < this.absorptionUntil;
        const speed = (playerMoveSpeed(this.featherBoots ? 0 : this.coins, this.meta, this.godPowerTimer) + (empowered ? 28 : 0)) * (this.carried ? 0.9 : 1);
        const accel = onGround ? 0.23 : 0.14;
        if (controls.axis) {
          this.inertiaDirection = Math.sign(controls.axis);
          this.inertiaUntil = 0;
        }
        const inertialAxis = controls.axis;
        const desired = inertialAxis * speed;
        if (onGround && controls.axis && Math.sign(controls.axis) !== Math.sign(body.velocity.x) && Math.abs(body.velocity.x) > 70 && time >= this.skidDustReadyAt) {
          this.footDust.explode(4, body.center.x + Math.sign(body.velocity.x) * 9, body.bottom - 2);
          this.skidDustReadyAt = time + 180;
        }
        body.velocity.x = Phaser.Math.Linear(body.velocity.x, desired, inertialAxis ? accel : (onGround ? 0.18 : 0.04));
        if (!controls.axis && onGround && Math.abs(body.velocity.x) < 8) body.velocity.x = 0;
        const ascending = time < this.ascentUntil;
        body.setGravityY(time < this.localGravityUntil ? -2 * this.physics.world.gravity.y : ascending ? 0 : coinBurden * (this.debtMass || 1));
        body.setMaxVelocity(300, ascending ? 820 : 620 + coinBurden * 0.55);

        if (controls.axis !== 0) {
          this.player.facing = Math.sign(controls.axis);
          this.player.setFlipX(this.player.facing < 0);
        }

        const canCoyote = time - this.lastGroundedAt <= 110;
        const buffered = time - this.lastJumpPressAt <= 125;
        if (buffered && canCoyote && !this.onLadder && !(time < this.staggerUntil)) {
          const route = this.generated.dramaticRoutes.find(r => r.unlocked &&
            rectsOverlap(makeRect(body.x, body.y, body.width, body.height), r.launchZone));
          if (route) {
            this.ascentUntil = time + 1700;
            body.setGravityY(0).setMaxVelocity(300, 820);
          }
          body.setVelocityY(route ? -SACRIFICE_JUMP_SPEED : -(JUMP_SPEED + (empowered ? 48 : 0) + (time < this.riskJumpUntil ? 80 : 0)));
          this.lastJumpPressAt = -9999;
          this.lastGroundedAt = -9999;
          this.player.wasGrounded = false;
          this.footDust.explode(5, this.player.x - 9, this.player.y + 22);
          this.footDust.explode(5, this.player.x + 9, this.player.y + 22);
          this.squashPlayer(0.8, 1.25, 130);
          AUDIO.jump();
          if (this.nearDramatic && !this.nearDramatic.unlocked) {
            this.showMessage("Ese ascenso exige una ofrenda. E: entregar oro o 1 vida.", 1800);
          }
        } else if (buffered && !canCoyote && !this.onLadder && lawActive(this.meta, "doubleJump") && this.airJumps > 0 && this.coins > 0 && !(time < this.staggerUntil)) {
          this.coins -= 1;
          this.airJumps -= 1;
          body.setVelocityY(-(JUMP_SPEED + 20));
          if (lawActive(this.meta, "willInertia") && Math.abs(body.velocity.x) > 24) {
            this.fluidezAirVelocity = body.velocity.x;
            this.fluidezAirUntil = time + 1500;
          }
          this.lastJumpPressAt = -9999;
          this.dust.explode(8, this.player.x, this.player.y + 16);
          this.squashPlayer(0.84, 1.2, 120);
          AUDIO.jump();
          this.showMessage("Doble Salto Sacramental: 1 moneda.", 1100);
        }

        if (controls.jumpReleased && body.velocity.y < -120) {
          body.setVelocityY(-120);
        }

        if (controls.attackPressed && time >= this.dashReadyAt) {
          if (this.carried) {
            this.releaseCarried(controls.down, time);
            this.dashReadyAt = time + 180;
          } else if (this.nearMerchant) {
            this.cycleMerchant();
            this.dashReadyAt = time + 220;
          } else if (this.nearDramatic && !this.nearDramatic.unlocked && this.levelInfo.key === "volcano") {
            this.sacrificeForRoute(this.nearDramatic, true);
            this.dashReadyAt = time + 720;
          } else if (this.nearGod && this.levelInfo.key === "void") {
            this.absorbGodPower(time);
          } else {
            const dir = this.player.facing || controls.facing || 1;
            this.dashDirection = dir;
            this.dashUntil = time + 160;
            body.setVelocityX(dir * 300);
            if (lawActive(this.meta, "willInertia")) {
              this.fluidezAirVelocity = dir * 300;
              this.fluidezAirUntil = time + 520;
            }
            body.setVelocityY(Math.min(body.velocity.y, -60));
            this.invulnUntil = Math.max(this.invulnUntil, time + 160);
            this.dashReadyAt = time + 720;
            this.dust.explode(14, this.player.x - dir * 10, this.player.y + 14);
            AUDIO.dash();
          }
        }

        if (time < this.dashUntil) body.setVelocityX(this.dashDirection * 300);

        if (onGround && this.player.wasGrounded === false && body.velocity.y >= 0) {
          // Ignore tiny contact oscillations: only a real fall gets landing feedback.
          if (this.maxFallSpeed >= 80 && time >= this.landingFeelReadyAt) {
            this.footDust.explode(7, this.player.x, this.player.y + 24);
            this.squashPlayer(1.25, 0.75, 150);
            this.landingFeelReadyAt = time + 220;
          }
          if (this.maxFallSpeed >= 390) this.cameras?.main?.shake(100, 0.005);
          this.maxFallSpeed = 0;
          if (lawActive(this.meta, "greedTransmutation") && this.coins > 0 && this.maxFallSpeed >= 340) {
            const mass = this.featherBoots ? 0 : effectiveCoinBurden(this.coins, this.meta);
            const radius = clamp(44 + mass * 0.48, 44, 150);
            this.blue.explode(clamp(Math.round(8 + mass / 12), 8, 26), this.player.x, this.player.y + 20);
            for (const entity of this.symbolicEntities || []) {
              if (entity.state === "active" && Math.hypot(entity.x - this.player.x, entity.y - this.player.y) <= radius) {
                entity.stunnedUntil = Math.max(entity.stunnedUntil, time + 1200);
              }
            }
          }
        }
        if (!onGround && lawActive(this.meta, "willInertia") && time < this.fluidezAirUntil) body.velocity.x = this.fluidezAirVelocity;
        this.player.wasGrounded = onGround;
        this.walkDustTimer += dt;
        if (onGround && body.velocity.y >= 0 && !this.onLadder && controls.axis && Math.abs(body.velocity.x) > 35 && this.walkDustTimer >= 85) {
          this.footDust.explode(1, body.center.x - this.player.facing * 8, body.bottom - 1);
          this.walkDustTimer = 0;
        } else if (!onGround || !controls.axis) this.walkDustTimer = 85;
      }

      // ══════════════════════════════════════════════════════════════════════════
      // ANIMACIÓN PROCEDURAL PULIDA (Paper-Doll Rig) — Optimizada para Game Feel
      // ══════════════════════════════════════════════════════════════════════════
      // Trigonometría pura para animar this.playerRig y this.rigParts.
      // NO toca físicas ni colisiones (solo visual). El flip se hace con scaleX.
      updatePlayerAnimation(time) {
        if (!this.player?.body || !this.playerRig || !this.rigParts) return;

        const body = this.player.body;
        const parts = this.rigParts;

        // ============================================================
        // 1. Estado persistente de la animación
        // ============================================================
        if (!this.rigAnim) {
          this.rigAnim = {
            torsoAngle: 0,
            torsoScaleY: 1,
            torsoY: parts.torso.y,

            headAngle: 0,
            headY: parts.head.y,

            frontLeg: 0,
            backLeg: 0,
            frontArm: 0,
            backArm: 0,

            lastTime: time
          };

          this.rigTorsoBaseY = parts.torso.y;
          this.rigHeadBaseY = parts.head.y;
        }

        const R = this.rigAnim;

        // ============================================================
        // 2. Datos físicos
        // ============================================================
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        const speedX = Math.abs(vx);
        const onGround = Boolean(body.blocked.down || this.onSlope);

        // ============================================================
        // 3. Flip visual
        // ============================================================
        this.playerRig.setScale(this.player.facing, 1);

        // ============================================================
        // 4. Delta estable para suavizado independiente del FPS
        // ============================================================
        const dt = Phaser.Math.Clamp(time - R.lastTime, 1, 50);
        R.lastTime = time;

        // ✨ OPTIMIZADO: Lerp más responsivo (45ms → transición sedosa, no resbaladiza).
        const lerp = 1 - Math.exp(-dt / 45);

        // ============================================================
        // 5. Defaults / objetivo de pose
        // ============================================================
        let targetTorsoAngle = 0;
        let targetTorsoScaleY = 1;

        let targetTorsoY = this.rigTorsoBaseY;
        let targetHeadAngle = 0;
        let targetHeadY = this.rigHeadBaseY;

        let targetFrontLeg = 0;
        let targetBackLeg = 0;
        let targetFrontArm = 0;
        let targetBackArm = 0;

        // ============================================================
        // 6. PRIORIDAD DE ESTADOS
        // ============================================================

        // ------------------------------------------------------------
        // HURT / STAGGER
        // ------------------------------------------------------------
        if (this.staggerUntil > time) {
          // Retroceso fuerte, pero con pequeñas diferencias entre miembros
          // para evitar el aspecto perfectamente simétrico.
          targetTorsoAngle = -24;
          targetHeadAngle = -18;

          targetFrontArm = -148;
          targetBackArm = -122;

          targetFrontLeg = -34;
          targetBackLeg = 28;

          targetTorsoY = this.rigTorsoBaseY + 1;
          targetHeadY = this.rigHeadBaseY - 1;
          targetTorsoScaleY = 0.96;
        }
        // ------------------------------------------------------------
        // DASH
        // ------------------------------------------------------------
        else if (this.dashUntil > time) {
          // Inclinación agresiva hacia delante.
          targetTorsoAngle = 30;
          targetHeadAngle = 25;

          // Brazos completamente arrastrados hacia atrás.
          targetFrontArm = -62;
          targetBackArm = -82;

          // Piernas compactas para reforzar la sensación de impulso.
          targetFrontLeg = -18;
          targetBackLeg = 12;

          targetTorsoY = this.rigTorsoBaseY - 1;
          targetHeadY = this.rigHeadBaseY - 2;
          targetTorsoScaleY = 0.93;
        }

        // ------------------------------------------------------------
        // AIRE
        // ------------------------------------------------------------
        else if (!onGround) {
          const jumpReference = 382;
          const fallReference = 620;

          // ----------------------------------------------------------
          // SUBIENDO (vy < -10)
          // ----------------------------------------------------------
          if (vy < -10) {
            const rise = Phaser.Math.Clamp(
              Math.abs(vy) / jumpReference,
              0,
              1
            );

            // ✨ PULIDO: Inclinación más enérgica (+2°) para sensación de impulso.
            targetTorsoAngle = Phaser.Math.Linear(8, 15, rise);
            targetHeadAngle = Phaser.Math.Linear(5, 12, rise);

            // ✨ Brazo frontal más dramático (alcanza -165° en pico).
            targetFrontArm = Phaser.Math.Linear(-120, -165, rise);

            // Brazo trasero compensa.
            targetBackArm = Phaser.Math.Linear(12, 30, rise);

            // ✨ Piernas: asimetría más marcada para energía dinámica.
            targetFrontLeg = Phaser.Math.Linear(-28, -54, rise);
            targetBackLeg = Phaser.Math.Linear(8, 20, rise);

            targetTorsoY = this.rigTorsoBaseY - Phaser.Math.Linear(0, 2.0, rise);
            targetHeadY = this.rigHeadBaseY - Phaser.Math.Linear(0, 1.4, rise);

            // ✨ Squash más sutil para evitar deformación excesiva.
            targetTorsoScaleY = Phaser.Math.Linear(1, 0.96, rise);
          }

          // ----------------------------------------------------------
          // ✨ ÁPICE MEJORADO: Momento zen suspendido (vy entre -20 y +20)
          // ----------------------------------------------------------
          else if (Math.abs(vy) <= 20) {
            // Micro-transición dentro del ápice (cuanto más cerca de 0, más suspendido).
            const apexBlend = 1 - Math.abs(vy) / 20;

            // Brazos flotantes simétricos.
            targetFrontArm = Phaser.Math.Linear(-118, -135, apexBlend);
            targetBackArm = Phaser.Math.Linear(-112, -128, apexBlend);

            // Piernas compactas pero no idénticas.
            targetFrontLeg = Phaser.Math.Linear(-10, -18, apexBlend);
            targetBackLeg = Phaser.Math.Linear(6, 12, apexBlend);

            // Torso casi neutral = suspensión.
            targetTorsoAngle = Phaser.Math.Linear(4, 1, apexBlend);
            targetHeadAngle = Phaser.Math.Linear(2, 0, apexBlend);

            targetTorsoY = this.rigTorsoBaseY - Phaser.Math.Linear(0.5, 1.2, apexBlend);
            targetHeadY = this.rigHeadBaseY - Phaser.Math.Linear(0.3, 0.8, apexBlend);

            targetTorsoScaleY = Phaser.Math.Linear(0.99, 0.975, apexBlend);
          }

          // ----------------------------------------------------------
          // CAYENDO (vy > 20)
          // ----------------------------------------------------------
          else {
            const fall = Phaser.Math.Clamp(
              vy / fallReference,
              0,
              1
            );

            // ✨ Torso se inclina hacia atrás progresivamente (-4° en caída máxima).
            targetTorsoAngle = Phaser.Math.Linear(2, -4, fall);
            targetHeadAngle = Phaser.Math.Linear(1, -6, fall);

            // ✨ Brazos: resistencia al aire (más elevados = -152°).
            targetFrontArm = Phaser.Math.Linear(-110, -152, fall);
            targetBackArm = Phaser.Math.Linear(-95, -148, fall);

            // ✨ Piernas: extensión asimétrica (no idénticas).
            targetFrontLeg = Phaser.Math.Linear(-12, 5, fall);
            targetBackLeg = Phaser.Math.Linear(8, -3, fall);

            targetTorsoY = this.rigTorsoBaseY + Phaser.Math.Linear(0, 2.2, fall);
            targetHeadY = this.rigHeadBaseY + Phaser.Math.Linear(0, 1.5, fall);

            // ✨ Stretch muy sutil en caída máxima.
            targetTorsoScaleY = Phaser.Math.Linear(0.98, 1.02, fall);
          }
        }
        // ------------------------------------------------------------
        // RUN
        // ------------------------------------------------------------
        else if (speedX > 15) {
          const speed01 = Phaser.Math.Clamp(speedX / 300, 0, 1);

          // ✨ PULIDO: Frecuencia más rápida (0.012 → 0.025) para carrera enérgica.
          const frequency = Phaser.Math.Linear(0.012, 0.025, speed01);
          const phase = time * frequency;

          const legWave = Math.sin(phase);
          const armWave = Math.sin(phase + Math.PI);

          // ✨ Amplitud de piernas aumentada (45° → 52°) para zancadas más largas.
          targetFrontLeg = legWave * 52;
          targetBackLeg = -legWave * 52;

          // ✨ Brazos: amplitud aumentada (34° → 42°) para contrabalanceo visible.
          targetFrontArm = armWave * 42;
          targetBackArm = -armWave * 42;

          // ✨ Inclinación hacia delante más pronunciada (7° → 10° a velocidad max).
          targetTorsoAngle = Phaser.Math.Linear(3, 10, speed01);
          targetHeadAngle = Phaser.Math.Linear(1, 6, speed01);

          // ✨ TORSO BOBBING MEJORADO: peso realista en cada pisada.
          // Usamos sin² (footImpact²) para acelerar el "golpe" del pie.
          const footImpact = Math.abs(Math.sin(phase));
          const impactSquared = footImpact * footImpact;
          const bob = impactSquared * Phaser.Math.Linear(1.2, 3.8, speed01);

          targetTorsoY = this.rigTorsoBaseY + bob;
          targetHeadY = this.rigHeadBaseY + bob * 0.75;

          // ✨ Squash & Stretch: compresión más visible (0.035 → 0.055).
          targetTorsoScaleY = 1 - impactSquared * Phaser.Math.Linear(0.020, 0.055, speed01);
        }

        // ------------------------------------------------------------
        // IDLE (Respiración)
        // ------------------------------------------------------------
        else {
          // ✨ PULIDO: Respiración más lenta (0.0026 → 0.0020) y asimétrica.
          const breath = Math.sin(time * 0.0020);
          const breathSoft = Math.sin(time * 0.0020 + 0.6);

          // ✨ Amplitud reducida (1.2° → 0.7°) para respiración sutil, no mareante.
          targetTorsoAngle = breath * 0.7;
          targetHeadAngle = breathSoft * 0.5;

          // ✨ ScaleY más sutil (0.035 → 0.022) para evitar "inflar" demasiado.
          targetTorsoScaleY = 1 + breath * 0.022;

          // ✨ Movimiento vertical reducido para respiración orgánica, no flotante.
          targetTorsoY = this.rigTorsoBaseY - breath * 0.25;
          targetHeadY = this.rigHeadBaseY - breath * 0.40;

          // Extremidades en reposo.
          targetFrontLeg = 0;
          targetBackLeg = 0;
          targetFrontArm = 0;
          targetBackArm = 0;
        }
        // ============================================================
        // 7. Suavizado de TODA la pose
        // ============================================================
        R.torsoAngle = Phaser.Math.Linear(
          R.torsoAngle,
          targetTorsoAngle,
          lerp
        );

        R.torsoScaleY = Phaser.Math.Linear(
          R.torsoScaleY,
          targetTorsoScaleY,
          lerp
        );

        R.torsoY = Phaser.Math.Linear(
          R.torsoY,
          targetTorsoY,
          lerp
        );

        R.headAngle = Phaser.Math.Linear(
          R.headAngle,
          targetHeadAngle,
          lerp
        );

        R.headY = Phaser.Math.Linear(
          R.headY,
          targetHeadY,
          lerp
        );

        R.frontLeg = Phaser.Math.Linear(
          R.frontLeg,
          targetFrontLeg,
          lerp
        );

        R.backLeg = Phaser.Math.Linear(
          R.backLeg,
          targetBackLeg,
          lerp
        );

        R.frontArm = Phaser.Math.Linear(
          R.frontArm,
          targetFrontArm,
          lerp
        );

        R.backArm = Phaser.Math.Linear(
          R.backArm,
          targetBackArm,
          lerp
        );

        // ============================================================
        // 8. Aplicación final al Paper-Doll Rig
        // ============================================================
        parts.torso.rotation = Phaser.Math.DegToRad(R.torsoAngle);
        parts.torso.y = R.torsoY;
        parts.torso.scaleY = R.torsoScaleY;

        parts.head.rotation = Phaser.Math.DegToRad(R.headAngle);
        parts.head.y = R.headY;

        parts.frontLeg.rotation = Phaser.Math.DegToRad(R.frontLeg);
        parts.backLeg.rotation = Phaser.Math.DegToRad(R.backLeg);

        parts.frontArm.rotation = Phaser.Math.DegToRad(R.frontArm);
        parts.backArm.rotation = Phaser.Math.DegToRad(R.backArm);
      }
      squashPlayer(scaleX, scaleY, duration) {
        if (!this.player?.setScale || !this.tweens?.add || this.ending) return;
        if (this.squashTween) this.squashTween.stop();
        this.player.setScale(scaleX, scaleY);
        this.stabilizePlayerBody();
        this.squashTween = this.tweens.add({
          targets: this.player, scaleX: 1, scaleY: 1, duration,
          ease: "Back.Out",
          onUpdate: () => this.stabilizePlayerBody(),
          onComplete: () => {
            if (this.ending) return;
            this.player.setScale(1, 1);
            this.player.body.setSize(20, 35).setOffset(6, 10);
            this.squashTween = null;
          }
        });
      }

      stabilizePlayerBody() {
        const body = this.player?.body;
        if (!body) return;
        const sx = Math.max(0.01, Math.abs(this.player.scaleX || 1));
        const sy = Math.max(0.01, Math.abs(this.player.scaleY || 1));
        body.setSize(20 / sx, 35 / sy).setOffset(6 / sx, 10 / sy);
      }

      spawnSymbolicAttack(owner, type, x, y, vx, vy, duration) {
        if (this.ending) return;
        const graphics = this.add.graphics().setDepth(12);
        this.symbolicAttacks.push({ owner, type, x, y, vx, vy, born: this.time.now,
          expires: this.time.now + duration, hit: false, gravity: type === "coinRain" ? 260 : 0, graphics });
      }

      parryAttack(owner, time, attack = null) {
        if (attack) {
          attack.graphics.destroy();
          attack.dead = true;
        }
        owner.stunnedUntil = Math.max(owner.stunnedUntil, time + 1500);
        owner.windupUntil = 0; owner.attackAt = 0; owner.chargeUntil = 0;
        this.dashReadyAt = Math.min(this.dashReadyAt, time + 360);
        this.blue.explode(18, this.player.x, this.player.y);
        this.showMessage("Parry simbólico: ataque disipado; pensamiento aturdido.", 1700);
        AUDIO.dash();
      }

      updateSymbolicAttacks(time, dt) {
        if (this.ending) return;
        if (!this.symbolicAttacks) this.symbolicAttacks = [];
        const playerRect = this.player.body;
        for (const attack of this.symbolicAttacks) {
          if (this.ending) return;
          if (attack.dead) continue;
          attack.x += attack.vx * dt / 1000;
          attack.y += attack.vy * dt / 1000;
          attack.vy += (attack.gravity || 0) * dt / 1000;
          attack.graphics.clear();
          const rect = attack.type === "pillar"
            ? makeRect(attack.x - 18, attack.y - 250, 36, 500)
            : attack.type === "lasso" ? makeRect(attack.x - 15, attack.y - 9, 30, 18)
            : makeRect(attack.x - 7, attack.y - 7, 14, 14);
          if (attack.type === "pillar") {
            attack.graphics.fillStyle(0xff5b32, 0.72).fillRect(rect.x, rect.y, rect.width, rect.height);
            attack.graphics.fillStyle(0xffd45e, 0.85).fillRect(attack.x - 5, rect.y, 10, rect.height);
          } else if (attack.type === "lasso") {
            attack.graphics.lineStyle(2, 0xffce66, 0.78);
            attack.graphics.lineBetween(attack.owner.x, attack.owner.y - 8, attack.x, attack.y);
            attack.graphics.strokeCircle(attack.x, attack.y, 13);
          } else {
            attack.graphics.fillStyle(0xffce66, 0.95).fillCircle(attack.x, attack.y, 7);
          }
          if (rectsOverlap(playerRect, rect)) {
            if (time < this.dashUntil) this.parryAttack(attack.owner, time, attack);
            else if (attack.type === "lasso") {
              const stolen = Math.min(2, this.coins);
              this.coins -= stolen;
              attack.owner.storedCoins += stolen;
              attack.owner.lassoActiveUntil = 0;
              attack.hit = true; attack.dead = true; attack.graphics.destroy();
              this.showMessage(stolen ? `El lazo arrastra ${stolen} monedas hacia El Acreedor.` : "El lazo encuentra tus bolsillos vacíos.", 1600);
            }
            else {
              attack.hit = true; attack.dead = true; attack.graphics.destroy();
              this.takeDamage(1, "symbolic");
              if (this.ending) return;
            }
          } else if (time >= attack.expires) {
            attack.dead = true; attack.graphics.destroy();
            if (attack.type === "lasso") attack.owner.lassoActiveUntil = 0;
            if (!attack.hit && attack.owner.state === "active") attack.owner.stunnedUntil = Math.max(attack.owner.stunnedUntil, time + 1500);
          }
        }
        this.symbolicAttacks = this.symbolicAttacks.filter(attack => !attack.dead);
      }

      handleLadders(controls) {
        this.onLadder = this.ladderZones.some(zone => this.physics.overlap(this.player, zone));
        if (this.onLadder && (controls.up || controls.down)) {
          this.player.body.allowGravity = false;
          this.player.body.setVelocityY((controls.down ? 1 : 0) * 120 - (controls.up ? 1 : 0) * 120);
          this.player.body.velocity.x = Phaser.Math.Linear(this.player.body.velocity.x, controls.axis * 95, 0.2);
        } else {
          this.player.body.allowGravity = true;
        }
      }

      resolveSlope() {
        this.onSlope = false;
        const body = this.player.body;
        const footX = body.x + body.width / 2;
        const footY = body.y + body.height;
        for (const slope of this.generated.slopes) {
          if (footX < slope.x || footX > slope.x + slope.width) continue;
          const t = (footX - slope.x) / slope.width;
          const lineY = slope.dir > 0
            ? slope.y + slope.height - t * slope.height
            : slope.y + t * slope.height;
          if (footY >= lineY - 4 && footY <= lineY + 20 && body.velocity.y >= -30) {
            this.player.y -= footY - lineY;
            body.setVelocityY(0);
            this.onSlope = true;
            break;
          }
        }
      }

      handleInteractions(controls, time) {
        if (controls.interactPressed) {
          if (this.carried) {
            this.dropCarried(time);
            return;
          }
          if (this.graceAvailable) {
            this.surrenderToAstral("grace");
            return;
          }
          if (this.tryPickupNearby(time, controls.down || Boolean(this.nearStunned))) return;
          const grounded = this.player.body.blocked.down || this.player.body.touching.down || this.onSlope;
          if (controls.down && grounded) {
            if (this.ending || this.hp <= 0) return;
            this.seismicLifeStrike(time);
            return;
          }
          if (this.nearExit) {
            this.descend();
            return;
          }
          if (this.nearMerchant) {
            this.buyMerchantItem(time);
            return;
          }
          if (this.nearSpecial) {
            this.useSpecialRoom(this.nearSpecial, time);
            return;
          }
          if (this.nearDramatic) {
            this.sacrificeForRoute(this.nearDramatic);
            return;
          }
          if (this.nearAltar) {
            this.useAltar();
            return;
          }
          if (this.nearGod) {
            this.negotiateWithGod();
            return;
          }
          if (this.nearSymbolic) {
            this.absorbSymbolic(this.nearSymbolic, time);
            return;
          }
        }
      }

      nearbyPortable(includeSymbolic = true) {
        const candidates = [];
        const addGroup = (group, type) => group?.children?.iterate(object => {
          if (!object?.active || object === this.carried?.target) return;
          const distance = Math.hypot(this.player.x - object.x, this.player.y - object.y);
          if (distance < 62) candidates.push({ type, target: object, distance });
        });
        addGroup(this.cratesGroup, "crate");
        addGroup(this.bouldersGroup, "boulder");
        addGroup(this.potsGroup, "pot");
        addGroup(this.bombsGroup, "bomb");
        for (const entity of includeSymbolic ? (this.symbolicEntities || []) : []) {
          if (entity.state !== "active" || !entity.vulnerable(this.time.now)) continue;
          const distance = Math.hypot(this.player.x - entity.x, this.player.y - entity.y);
          if (distance < 68) candidates.push({ type: "symbolic", target: entity, distance });
        }
        return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
      }

      tryPickupNearby(time, includeSymbolic = true) {
        if (this.ending || this.carried) return false;
        const portable = this.nearbyPortable(includeSymbolic);
        if (!portable) return false;
        const { target, type } = portable;
        if (type !== "symbolic" && (!target?.active || !target?.body)) return false;
        this.carried = { target, type };
        if (type === "symbolic") {
          target.state = "carried";
          target.ring.clear();
        } else {
          target.body.stop();
          target.body.enable = false;
          target.setAngularVelocity?.(0);
          if (type === "boulder") target.sleepingStone = false;
        }
        target.thrownByPlayer = false;
        this.interactionConsumedUntil = time + 320;
        this.actionHoldStartedAt = 0;
        this.blue.explode(8, this.player.x, this.player.y - 26);
        AUDIO.tone(245, 0.08, "square", 0.045, 80);
        this.showMessage(type === "symbolic" ? "La idea aturdida pesa menos sobre los hombros." : "Objeto levantado. »: lanzar · Abajo+»: depositar.", 1800);
        return true;
      }

      updateHandsRig(controls, time, dt) {
        if (this.ending) return;
        if (this.carried) {
          const { target, type } = this.carried;
          if (!target || (type === "symbolic" && !target.sprite) || (type !== "symbolic" && !target.active)) { this.carried = null; return; }
          const x = this.player.x, y = this.player.y - 28;
          if (type === "symbolic") {
            target.x = x; target.y = y; target.sprite.setPosition(x, y).setVisible(true).setAngle(Math.sin(time * 0.008) * 4);
          } else target.setPosition(x, y).setAngle(Math.sin(time * 0.009) * 5);
          return;
        }
        const gravity = this.physics.world.gravity.y;
        for (const thrown of this.thrownEntities || []) {
          const entity = thrown.target;
          if (!entity || entity.state !== "thrown") { thrown.dead = true; continue; }
          // Guarda anti-crash: si el sprite/referencia fue anulado, descartar el lanzamiento.
          if (!entity.sprite || !entity.sprite.active) { thrown.dead = true; continue; }
          try {
            thrown.vy += gravity * dt / 1000;
            entity.x += thrown.vx * dt / 1000;
            entity.y += thrown.vy * dt / 1000;
            entity.sprite.setPosition(entity.x, entity.y).setAngle(entity.sprite.angle + thrown.vx * dt * 0.0012);
            const tile = this.terrain.getTileAtWorldXY(entity.x, entity.y + 15, true);
            let hitOther = false;
            for (const other of this.symbolicEntities || []) {
              if (other === entity || other.state !== "active") continue;
              if (Math.hypot(other.x - entity.x, other.y - entity.y) < 34) {
                other.dissipate(time); hitOther = true; break;
              }
            }
            if (hitOther || tile?.index === 1 || time >= thrown.expires) {
              entity.state = "dissipated"; entity.respawnAt = time + 8000; entity.sprite.setVisible(false);
              this.blue.explode(16, entity.x, entity.y); thrown.dead = true;
            }
          } catch (err) {
            thrown.dead = true;
          }
        }
        this.thrownEntities = (this.thrownEntities || []).filter(item => !item.dead);

        for (const group of [this.cratesGroup, this.bouldersGroup, this.potsGroup, this.bombsGroup]) group?.children?.iterate(object => {
          if (!object?.active || !object.body?.enable) return;
          object.impactSpeed = Math.max(object.impactSpeed || 0, Math.hypot(object.body.velocity.x, object.body.velocity.y));
          if (!object.thrownByPlayer) return;
          for (const entity of this.symbolicEntities || []) {
            if (entity.state !== "active" || Math.hypot(entity.x - object.x, entity.y - object.y) >= 38) continue;
            if (object.pickupType === "pot") this.breakPot(object);
            entity.stunnedUntil = Math.max(entity.stunnedUntil, time + 1500);
            entity.windupUntil = 0; entity.attackAt = 0; entity.chargeUntil = 0;
            this.blue.explode(10, entity.x, entity.y);
            object.thrownByPlayer = false;
            this.showMessage("El pensamiento queda aturdido por el peso de lo real.", 1500);
            break;
          }
        });
      }

      releaseCarried(soft, time) {
        if (!this.carried || !this.carried.target) return false;
        const carried = this.carried;
        const dir = this.player.facing || 1;
        // Limpiar referencias y estado visual (aura verde del portaobjetos) antes de
        // que el objeto vuelva a entrar en las físicas activas del mundo.
        this.carried = null;
        this.portableHalo?.clear();
        if (carried.type === "symbolic") {
          const entity = carried.target;
          if (!entity?.sprite) return false;
          try {
            entity.state = "thrown";
            entity.ring?.clear();
            entity.sprite.setVisible(true);
            this.thrownEntities = this.thrownEntities || [];
            this.thrownEntities.push({ target: entity, vx: soft ? 0 : dir * 320, vy: soft ? 20 : -140, expires: time + 2300 });
          } catch (err) {
            return false;
          }
        } else {
          const object = carried.target;
          // Guarda anti-crash: si el objeto o su cuerpo físico ya fueron anulados
          // (p. ej. una vasija rota), no reintroducirlo en las físicas activas.
          if (!object || !object.active || !object.body) return false;
          try {
            object.body.enable = true;
            object.body.setMaxVelocity(360, 620);
            object.setPosition(this.player.x + dir * 22, this.player.y - (soft ? 2 : 20));
            object.setVelocity(soft ? 0 : dir * 320, soft ? 25 : -140);
            object.setAngularVelocity?.(soft ? 0 : dir * 460);
            object.thrownByPlayer = !soft;
            object.impactSpeed = 0;
          } catch (err) {
            return false;
          }
        }
        AUDIO.dash();
        return true;
      }

      dropCarried(time) {
        if (!this.carried) return false;
        this.releaseCarried(true, time);
        this.interactionConsumedUntil = time + 250;
        return true;
      }

      onPortableTerrainHit(object) {
        if (this.ending || !object?.active) return;
        const force = object.impactSpeed || 0;
        object.impactSpeed = 0;
        if (object.pickupType === "pot" && force > 130) this.breakPot(object);
        if (object.thrownByPlayer && force >= 120) object.thrownByPlayer = false;
      }

      onPortableWallHit(object) {
        if (this.ending || !object?.active) return;
        if (object.pickupType === "pot" && (object.impactSpeed || 0) > 130) this.breakPot(object);
      }

      onPortableSpikeHit(object, spike) {
        if (this.ending || !object?.active || !spike?.active) return;
        spike.disableBody(true, true);
        object.setVelocityY(Math.min(0, object.body.velocity.y));
        object.setAngularVelocity?.(0);
        object.thrownByPlayer = false;
        this.rubble.explode(7, spike.x, spike.y);
        this.showMessage("El objeto cubre los filos y crea un apoyo seguro.", 1700);
      }

      breakPot(pot) {
        if (!pot?.active) return false;
        if (this.carried?.target === pot) this.carried = null;
        const x = pot.x, y = pot.y;
        pot.disableBody(true, true);
        this.rubble.explode(12, x, y);
        const roll = this.rng();
        if (roll < 0.15) {
          if (this.rng() < 0.55) { this.bombs += 1; this.showMessage("La vasija ocultaba una bomba.", 1400); }
          else {
            const spore = this.sporesGroup.create(x, y - 8, "spore");
            spore.body.setCircle(12, 2, 2); spore.phase = this.rng() * Math.PI * 2;
            this.showMessage("Una espora despierta entre la arcilla.", 1400);
          }
        } else {
          const count = randInt(this.rng, 1, 3);
          for (let i = 0; i < count; i += 1) {
            const coin = this.coinsGroup.create(x + (i - (count - 1) / 2) * 18, y - 8, "coin");
            coin.body.setCircle(10, 2, 2); coin.phase = this.rng() * Math.PI * 2;
          }
        }
        AUDIO.noise(0.14, 0.09, 980);
        return true;
      }

      seismicLifeStrike(time) {
        if (this.ending) return;
        this.hp -= 1;
        const removed = this.destroyTerrainCircle(this.player.x, this.player.y + 10, 2);
        this.destructiblesGroup.children.iterate(wall => {
          if (wall?.active && Math.hypot(wall.x - this.player.x, wall.y - this.player.y) < TILE * 2.2) this.breakWall(wall, true);
        });
        this.rubble.explode(30, this.player.x, this.player.y + 12);
        this.cameras.main.shake(220, 0.011);
        AUDIO.demolition();
        this.interactionConsumedUntil = time + 500;
        this.showMessage(`Golpe sísmico: 1 vida abre ${removed} fragmentos de roca.`, 1900);
        if (this.hp <= 0) this.die();
      }

      hasVerticalEscape() {
        if (!this.terrain || !this.player?.body) return true;
        const tx = Math.floor(this.player.x / TILE);
        const footTy = Math.floor(this.player.body.bottom / TILE);
        const maxRiseTiles = Math.max(5, Math.floor(JUMP_SPEED ** 2 / (2 * Math.max(1, this.physics.world.gravity.y) * TILE)));
        for (let ox = -2; ox <= 2; ox += 1) {
          let clear = true;
          for (let oy = 1; oy <= maxRiseTiles; oy += 1) {
            if (this.generated.data[footTy - oy]?.[tx + ox] === 1) { clear = false; break; }
          }
          if (clear) return true;
        }
        return false;
      }

      isCaveConfined() {
        const tx = Math.floor(this.player.x / TILE);
        const ty = Math.floor(this.player.y / TILE);
        const solid = (x, y) => this.generated.data[y]?.[x] === 1;
        const leftClosed = [1, 2].some(distance => [0, 1].every(dy => solid(tx - distance, ty + dy)));
        const rightClosed = [1, 2].some(distance => [0, 1].every(dy => solid(tx + distance, ty + dy)));
        return leftClosed && rightClosed && !this.hasVerticalEscape();
      }

      updateCaveSafeguards(controls, time) {
        if (this.ending) return;
        const grounded = this.player.body.blocked.down || this.player.body.touching.down || this.onSlope;
        if (!this.confinementAnchor) this.confinementAnchor = { x: this.player.x, y: this.player.y };
        if (Math.abs(this.player.x - this.confinementAnchor.x) > 64 || Math.abs(this.player.y - this.confinementAnchor.y) > 96 || !grounded) {
          this.confinementAnchor = { x: this.player.x, y: this.player.y };
          this.confinedSince = 0;
          this.graceAvailable = false;
        } else if (this.isCaveConfined()) {
          if (!this.confinedSince) this.confinedSince = time;
          this.graceAvailable = time - this.confinedSince >= 7000;
        } else {
          this.confinedSince = 0;
          this.graceAvailable = false;
        }

        const contextual = this.carried || this.nearbyPortable() || this.nearExit || this.nearMerchant || this.nearSpecial ||
          this.nearDramatic || this.nearAltar || this.nearGod || this.nearSymbolic;
        const canChannel = grounded && !controls.down && !contextual && time >= this.interactionConsumedUntil;
        if (controls.interact && canChannel) {
          if (!this.actionHoldStartedAt) this.actionHoldStartedAt = time;
          const progress = clamp((time - this.actionHoldStartedAt) / 2500, 0, 1);
          this.channelRing.clear();
          this.channelRing.lineStyle(2 + progress * 3, 0x9dfcff, 0.35 + progress * 0.6);
          this.channelRing.strokeCircle(this.player.x, this.player.y, 58 - progress * 38);
          if (time >= this.channelToneAt) {
            AUDIO.tone(110 + progress * 330, 0.12, "sine", 0.025 + progress * 0.045, 35);
            this.channelToneAt = time + Math.max(90, 260 - progress * 150);
            this.blue.explode(2, this.player.x + Phaser.Math.Between(-42, 42), this.player.y + Phaser.Math.Between(-34, 34));
          }
          // Disolución del Ego completada: disuelve la conciencia. Marcamos la
          // muerte como suicidio (isSuicide=true) para que die() aplique la
          // penalización de fragmentos de forma segura.
          if (progress >= 1) { this.hp = 0; this.die(true); return; }
        } else {
          if (controls.interactReleased && this.actionHoldStartedAt && time - this.actionHoldStartedAt < 420 && this.levelInfo.key === "volcano" && !contextual) {
            this.destructiveImpulse(time);
          }
          this.actionHoldStartedAt = 0;
          this.channelToneAt = 0;
          this.channelRing.clear();
        }
      }

      surrenderToAstral(reason) {
        if (this.ending) return;
        this.preserveEtherealGold();
        this.ending = true;
        this.stopForAstral();
        this.startAstral(false, reason);
      }

      updateProximity() {
        // Requerimiento #2: si el juego ya está acabando, ocultá el prompt de
        // proximidad al instante y NO evalúes distancias contra un jugador muerto.
        if (this.ending) {
          this.promptText?.setText("").setVisible(false);
          return;
        }
        this.nearSymbolic = (this.symbolicEntities || []).filter(entity => entity.state === "active" &&
          Math.hypot(this.player.x - entity.x, this.player.y - entity.y) < 76)
          .sort((a, b) => Math.hypot(this.player.x - a.x, this.player.y - a.y) - Math.hypot(this.player.x - b.x, this.player.y - b.y))[0] || null;
        this.nearStunned = (this.symbolicEntities || []).filter(entity => entity.state === "active" && entity.stunnedUntil > this.time.now &&
          Math.hypot(this.player.x - entity.x, this.player.y - entity.y) < 65)
          .sort((a, b) => Math.hypot(this.player.x - a.x, this.player.y - a.y) - Math.hypot(this.player.x - b.x, this.player.y - b.y))[0] || null;
        this.nearPortable = this.nearStunned ? { type: "symbolic", target: this.nearStunned, distance: Math.hypot(this.player.x - this.nearStunned.x, this.player.y - this.nearStunned.y) } : this.nearbyPortable(false);
        this.portableHalo?.clear();
        if (this.nearPortable) {
          const object = this.nearPortable.target;
          this.portableHalo?.lineStyle(1.5, 0x8af0b0, 0.38);
          this.portableHalo?.strokeCircle(object.x, object.y, 26 + Math.sin(this.time.now * 0.008) * 3);
        }
        this.nearExit = this.physics.overlap(this.player, this.exitDoor);
        this.nearMerchant = Boolean(this.generated.merchant &&
          Math.hypot(this.player.x - this.generated.merchant.x, this.player.y - this.generated.merchant.y) < 92);
        this.nearSpecial = this.generated.specialRooms.find(room =>
          Math.hypot(this.player.x - room.x, this.player.y - room.y) < 92) || null;
        this.nearAltar = null;
        this.altarsGroup.children.iterate(altar => {
          if (!altar || !altar.active) return;
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, altar.x, altar.y) < 80) this.nearAltar = altar;
        });
        // La fuente de salud mana un flujo sutil de agua mientras el Alma está cerca
        if (this.altarWater) {
          if (this.nearAltar) {
            this.altarWater.x = this.nearAltar.x;
            this.altarWater.y = this.nearAltar.y - 8;
            this.altarWater.emitting = true;
          } else {
            this.altarWater.emitting = false;
          }
        }
        this.nearGod = Boolean(this.godZone && this.physics.overlap(this.player, this.godZone));
        this.nearDramatic = this.generated.dramaticRoutes.find(r =>
          !r.collected && Math.abs(this.player.x - r.x) < 110 && Math.abs(this.player.y - r.y) < 80) || null;
        if (this.nearDramatic && !this.nearDramatic.unlocked && this.warnedDramaticId !== this.nearDramatic.id) {
          this.warnedDramaticId = this.nearDramatic.id;
          this.showMessage("RUTA DRAMÁTICA: el salto común no alcanza. E: ofrecer tu oro (o 1 vida).", 3800);
        }
      }

      absorbSymbolic(entity, time) {
        if (entity.state !== "active" || Math.hypot(this.player.x - entity.x, this.player.y - entity.y) >= 76) return false;
        if (!entity.vulnerable(time)) {
          this.showMessage(`${entity.names[entity.kind]} está alerta. Esperá el halo verde o acercate por detrás.`, 2000);
          return false;
        }
        if (this.coins < 3 && this.hp <= 1) {
          this.showMessage("Absorber exige 3 monedas o una vida que puedas entregar.", 2000);
          AUDIO.reject();
          return false;
        }
        const price = this.coins >= 3 ? "3 monedas" : "1 vida";
        if (!entity.dissipate(time, true)) return false;
        if (this.coins >= 3) this.coins -= 3;
        else this.hp -= 1;
        this.absorptionUntil = time + 8000;
        this.doubtUntil = 0;
        this.perceptionTimer = 0;
        this.inverted = false;
        this.riskFog = false;
        this.localGravityUntil = 0;
        this.nearSymbolic = null;
        AUDIO.fragment();
        this.showMessage(`Certidumbre absorbida: -${price}. Velocidad y salto aumentados durante 8 s.`, 2600);
        return true;
      }

      cycleMerchant() {
        this.merchantSelection = (this.merchantSelection + 1) % this.merchantOffers().length;
        AUDIO.tone(330 + this.merchantSelection * 55, 0.06, "square", 0.035);
        this.showMessage(`Mercader: ${this.merchantOffers()[this.merchantSelection].label}`, 1400);
      }

      merchantOffers() {
        const price = inflatedPrice(this.worldNumber);
        return [
          { key: "feather", label: `Botas Pluma · ${price} oro` },
          { key: "mirror", label: `Espejo Guardián · ${price} oro` },
          { key: "bag", label: `Bolsa del Abismo · ${price} oro` },
          { key: "anchor", label: `Ancla de la Certeza · ${price} oro` },
          { key: "pyre", label: `Pira Embotellada · ${price} oro` },
          { key: "bombs", label: `Paquete de 3 bombas · ${price} oro` },
          { key: "heal", label: `Curación +1 HP · ${price} oro` },
          { key: "dagger", label: `Daga · 1 vida → ${daggerReward(this.worldNumber)} oro` },
          { key: "credit", label: `Pacto de Crédito · +${Math.round(100 * inflationMultiplier(this.worldNumber))} oro` }
        ];
      }

      buyMerchantItem(time) {
        const offer = this.merchantOffers()[this.merchantSelection];
        const price = inflatedPrice(this.worldNumber);
        if (offer.key === "feather") {
          if (this.featherBoots) return this.showMessage("Las Botas Pluma ya niegan el peso de este nivel.", 1600);
          if (this.coins < price) return this.rejectPurchase(`Las Botas Pluma cuestan ${price} monedas.`);
          this.coins -= price; this.featherBoots = true;
          this.showMessage("Botas Pluma: el oro deja de pesar durante este nivel.", 2100);
        } else if (offer.key === "mirror") {
          if (this.guardianMirror) return this.showMessage("El Espejo Guardián ya espera un impacto.", 1600);
          if (this.coins < price) return this.rejectPurchase(`El Espejo Guardián cuesta ${price} monedas.`);
          this.coins -= price; this.guardianMirror = true;
          this.showMessage("Espejo Guardián: el próximo daño será reflejado al vacío.", 2100);
        } else if (offer.key === "bag") {
          if (this.abyssBagCharges > 0) return this.showMessage("La Bolsa todavía recoge ecos de monedas.", 1500);
          if (this.coins < price) return this.rejectPurchase(`La Bolsa del Abismo cuesta ${price} monedas.`);
          this.coins -= price; this.abyssBagCharges = 15;
          this.showMessage("Bolsa del Abismo: duplica las próximas 15 monedas.", 2000);
        } else if (offer.key === "anchor") {
          if (this.certaintyAnchor) return this.showMessage("El Ancla ya fija tu certeza en este nivel.", 1500);
          if (this.coins < price) return this.rejectPurchase(`El Ancla de la Certeza cuesta ${price} monedas.`);
          this.coins -= price; this.certaintyAnchor = true;
          this.inverted = false; this.doubtUntil = 0;
          this.showMessage("Ancla de la Certeza: las inversiones ya no te gobiernan.", 2100);
        } else if (offer.key === "pyre") {
          if (this.bottledPyre) return this.showMessage("Ya llevás una Pira Embotellada.", 1500);
          if (this.coins < price) return this.rejectPurchase(`La Pira Embotellada cuesta ${price} monedas.`);
          this.coins -= price; this.bottledPyre = true;
          this.godPowerTimer = Math.max(this.godPowerTimer, 10000);
          this.showMessage("Pira Embotellada: diez segundos de impulso abrasador.", 2100);
        } else if (offer.key === "bombs") {
          if (this.coins < price) return this.rejectPurchase(`Tres bombas cuestan ${price} monedas.`);
          this.coins -= price; this.bombs += 3;
          this.showMessage("El Mercader entrega tres promesas con mecha.", 1900);
        } else if (offer.key === "heal") {
          if (this.hp >= this.maxHp) return this.rejectPurchase("Tu vida ya está completa.");
          if (this.coins < price) return this.rejectPurchase(`Curarse cuesta ${price} monedas.`);
          this.coins -= price; this.hp = Math.min(this.maxHp, this.hp + 1);
          this.showMessage(`Curación: ${price} monedas por 1 HP.`, 1700);
        } else if (offer.key === "dagger") {
          if (this.sacrificeDaggerUsed) return this.showMessage("La Daga ya cobró su única herida.", 1600);
          if (this.hp <= 1) return this.rejectPurchase("La Daga no toma la última vida.");
          const reward = daggerReward(this.worldNumber);
          this.hp -= 1; this.coins += reward; this.sacrificeDaggerUsed = true;
          this.showMessage(`Daga de Sacrificio: una vida se convierte en ${reward} monedas.`, 2100);
        } else if (offer.key === "credit") {
          if (this.creditPact) return this.showMessage("La deuda ya conoce tu nombre.", 1700);
          const credit = Math.round(100 * inflationMultiplier(this.worldNumber));
          this.creditPact = true;
          this.debtMass = 1.1;
          this.maxHp = Math.max(1, this.maxHp - 1);
          this.hp = Math.min(this.hp, this.maxHp);
          this.coins += credit;
          this.physics.world.gravity.y = Math.round(BASE_GRAVITY * gravityMultiplier(this.meta) * this.debtMass);
          this.spawnDebtCreditor();
          this.showMessage(`Pacto firmado: +${credit} oro, -1 HP máximo y +10% peso de deuda.`, 3000);
        }
        this.blue.explode(18, this.generated.merchant.x, this.generated.merchant.y);
        AUDIO.buy();
      }

      rejectPurchase(message) {
        this.showMessage(message, 1600); AUDIO.reject();
      }

      useSpecialRoom(room, time) {
        if (room.used) return this.showMessage("La sala ya pronunció su única respuesta.", 1600);
        if (room.type === "barter") {
          if (this.coins >= 8 && this.hp < this.maxHp) {
            this.coins -= 8; this.hp = Math.min(this.maxHp, this.hp + 2);
            this.showMessage("Trueque: 8 monedas por 2 vidas.", 2000);
          } else if (this.hp > 2) {
            this.hp -= 2; this.runFragments += 3; setRunFragmentBank(this.runFragments);
            this.showMessage("Trueque: 2 vidas por 3 fragmentos de conciencia.", 2200);
          } else return this.rejectPurchase("El altar pide 8 monedas y una herida abierta, o más de 2 vidas.");
        } else {
          if (this.rng() < 0.5) {
            this.invulnUntil = Math.max(this.invulnUntil, time + 8000);
            this.riskInvulnerableUntil = time + 8000;
            this.showMessage("El Pozo concede 8 s de invulnerabilidad y toma la mitad de tu visión.", 2400);
          } else {
            this.riskJumpUntil = time + 12000;
            this.showMessage("El Pozo potencia tu salto durante 12 s y toma la mitad de tu visión.", 2400);
          }
          this.riskFog = true;
          this.doubtUntil = Math.max(this.doubtUntil, time + 3500);
        }
        room.used = true;
        this.blue.explode(28, room.x, room.y);
        AUDIO.altar();
      }

      sacrificeForRoute(route, useLife = false) {
        if (route.unlocked) {
          this.showMessage("Acceso abierto. Saltá desde la flecha y mantené el salto para alcanzar el fragmento.", 2800);
          return;
        }
        let price;
        if (!useLife && this.coins > 0) {
          price = `${this.coins} monedas`;
          this.coins = 0;
        } else if (this.hp > 1) {
          this.hp -= 1;
          price = "1 vida";
        } else {
          this.showMessage("Falta una ofrenda: oro o más de una vida. La ruta principal sigue abierta.", 2600);
          AUDIO.reject();
          return;
        }
        route.unlocked = true;
        this.destructiblesGroup.children.iterate(wall => {
          if (wall?.active && wall.dramaticId === route.id) this.breakWall(wall);
        });
        const entry = this.dramaticLabels.find(item => item.route.id === route.id);
        if (entry) entry.label.setText("RUTA DRAMÁTICA\nSALTO DE RENUNCIA").setColor("#8af0b0");
        this.blue.explode(20, route.x, route.y);
        AUDIO.altar();
        this.showMessage(`Ofrenda: ${price}. Acceso abierto; mantené el salto desde la flecha.`, 3400);
      }

      deployBomb(time) {
        if (this.ending) return;
        if (this.bombs <= 0) {
          this.showMessage("No quedan bombas.", 1200); AUDIO.reject(); return;
        }
        this.bombs -= 1;
        const dir = this.player.facing || 1;
        const bomb = this.bombsGroup.create(this.player.x + dir * 22, this.player.y - 4, "bomb");
        bomb.body.setCircle(10, 2, 3).setMaxVelocity(230, 520);
        bomb.setVelocity(dir * 135 + this.player.body.velocity.x * 0.35, -105);
        bomb.setBounce(0.38).setDragX(180);
        bomb.detonatesAt = time + 2000;
        bomb.pickupType = "bomb";
        AUDIO.tone(105, 0.08, "square", 0.06, 35);
      }

      detonateBomb(bomb) {
        if (this.ending || !bomb?.active) return;
        const x = bomb.x, y = bomb.y, radius = TILE * 2.65;
        if (this.carried?.target === bomb) this.carried = null;
        bomb.disableBody(true, true);
        const removed = this.destroyTerrainCircle(x, y, 2.65);
        this.cratesGroup.children.iterate(crate => {
          if (crate?.active && Math.hypot(crate.x - x, crate.y - y) <= radius) this.breakCrate(crate);
        });
        this.destructiblesGroup.children.iterate(wall => {
          if (wall?.active && Math.hypot(wall.x - x, wall.y - y) <= radius) this.breakWall(wall, true);
        });
        for (const entity of this.symbolicEntities || []) {
          if (entity.state === "active" && Math.hypot(entity.x - x, entity.y - y) <= radius) entity.dissipate(this.time.now);
        }
        if (Math.hypot(this.player.x - x, this.player.y - y) <= radius) this.takeDamage(2, "explosion");
        if (this.ending) return;
        this.rubble.explode(Math.min(42, 12 + removed * 2), x, y);
        this.spark.explode(28, x, y);
        this.cameras.main.shake(250, 0.012);
        AUDIO.demolition();
      }

      destroyTerrainCircle(worldX, worldY, radiusTiles = 2.5) {
        if (this.ending || !this.terrain) return 0;
        const centerX = Math.floor(worldX / TILE), centerY = Math.floor(worldY / TILE);
        const limit = Math.ceil(radiusTiles);
        let removed = 0;
        for (let oy = -limit; oy <= limit; oy += 1) for (let ox = -limit; ox <= limit; ox += 1) {
          if (ox * ox + oy * oy > radiusTiles * radiusTiles) continue;
          const tx = centerX + ox, ty = centerY + oy;
          if (ty < 0 || ty >= this.generated.rows || tx < 0 || tx >= this.generated.cols) continue;
          if (this.generated.data[ty][tx] !== 1) continue;
          this.terrain.removeTileAt(tx, ty, true, true);
          this.generated.data[ty][tx] = -1;
          const veinMark = this.veinMarks?.get(`${tx},${ty}`);
          if (veinMark) { veinMark.destroy(); this.veinMarks.delete(`${tx},${ty}`); }
          removed += 1;
          if (this.rubble && removed <= 30) this.rubble.explode(1, tx * TILE + TILE / 2, ty * TILE + TILE / 2);
        }
        return removed;
      }

      breakCrate(crate) {
        if (!crate?.active) return false;
        if (this.carried?.target === crate) this.carried = null;
        const x = crate.x, y = crate.y;
        crate.disableBody(true, true);
        this.rubble.explode(8, x, y);
        if (this.rng() < 0.35) {
          this.bombs += 1;
          this.showMessage("La caja escondía una bomba.", 1400);
        }
        return true;
      }

      updateWorldDynamics(time, dt) {
        if (this.ending) return;
        this.bombsGroup?.children.iterate(bomb => {
          if (!bomb?.active) return;
          const remaining = bomb.detonatesAt - time;
          bomb.setTint(remaining < 500 && Math.floor(time / 70) % 2 ? 0xffffff : remaining < 1100 && Math.floor(time / 150) % 2 ? 0xff6b55 : 0xffffff);
          bomb.angle += bomb.body.velocity.x * 0.05;
          if (remaining <= 0) this.detonateBomb(bomb);
        });
        this.coinsGroup.children.iterate(coin => {
          if (!coin || !coin.active) return;
          coin.y += Math.sin(time * 0.004 + coin.phase) * 0.08;
          coin.angle += 1.5;
        });
        this.fragmentsGroup.children.iterate(shard => {
          if (!shard || !shard.active) return;
          shard.y += Math.sin(time * 0.003 + shard.phase) * 0.1;
          shard.angle += 0.8;
        });
        this.sporesGroup.children.iterate(spore => {
          if (!spore || !spore.active) return;
          spore.y += Math.sin(time * 0.0035 + spore.phase) * 0.06;
        });
        this.bouldersGroup.children.iterate(rock => {
          if (!rock || !rock.active) return;
          if (rock.sleepingStone && Math.abs(rock.x - this.player.x) < 76 && this.player.y > rock.y && this.player.y - rock.y < 390) {
            rock.sleepingStone = false;
            rock.body.allowGravity = true;
            rock.setVelocity(Phaser.Math.Between(-45, 45), 40);
            this.showMessage("El argumento rueda cuesta abajo.", 1600);
            this.cameras.main.shake(80, 0.003);
          }
          rock.angle += rock.body.velocity.x * 0.035;
          rock.impactSpeed = Math.max(rock.impactSpeed || 0, Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y));
        });

        if (this.levelInfo.key === "jungle" && this.perceptionTimer > 0) {
          this.perceptionTimer = Math.max(0, this.perceptionTimer - dt);
          this.inverted = this.perceptionTimer > 0 && Math.floor(time / 950) % 2 === 0;
        } else {
          this.inverted = false;
        }

        if (this.levelInfo.key === "volcano") {
          let inLava = false;
          for (const zone of this.lavaZones) {
            if (this.physics.overlap(this.player, zone)) inLava = true;
          }
          const onMainRoute = this.generated.mainCorridors.some(r => rectsOverlap(this.player.body, r, 8));
          this.heat = clamp(this.heat + dt * (inLava ? 0.09 : onMainRoute ? -0.015 : 0.007), 0, 120);
          if (this.ending) return;
          if (inLava && time - this.lastDamageAt > 460) {
            this.takeDamage(2, "lava");
            if (this.ending) return;
          }
          if (this.heat >= 100 && time - this.lastDamageAt > 900) {
            if (this.ending) return;
            this.takeDamage(1, "heat");
            if (this.ending) return;
            this.heat = 55;
          }
          this.drawLava(time);
        }

        if (this.godPowerTimer > 0) {
          this.godPowerTimer = Math.max(0, this.godPowerTimer - dt);
          if (time % 120 < 20) this.blue.explode(1, this.player.x, this.player.y + 2);
          if (this.godPowerTimer === 0) this.bottledPyre = false;
        }
      }

      drawLava(time) {
        if (!this.lavaGraphics) return;
        this.lavaGraphics.clear();
        for (const lava of this.generated.lava) {
          this.lavaGraphics.fillStyle(0xff3f2e, 0.82);
          this.lavaGraphics.fillRoundedRect(lava.x, lava.y, lava.width, lava.height, 4);
          this.lavaGraphics.fillStyle(0xffd464, 0.72);
          for (let x = lava.x; x < lava.x + lava.width; x += 18) {
            const y = lava.y + 4 + Math.sin(time * 0.008 + x * 0.08) * 3;
            this.lavaGraphics.fillCircle(x + 8, y, 4);
          }
        }
      }

      updateHud(time, dt) {
        const coinBurden = this.featherBoots ? 0 : effectiveCoinBurden(this.coins, this.meta);
        const effectiveGravity = Math.round(this.physics.world.gravity.y + coinBurden * (this.debtMass || 1));
        const speed = Math.round((playerMoveSpeed(this.featherBoots ? 0 : this.coins, this.meta, this.godPowerTimer) + (time < this.absorptionUntil ? 28 : 0)) * (this.carried ? 0.9 : 1));
        const filledHearts = Math.max(0, Math.min(this.hp || 0, this.maxHp || 0));
        const hearts = "♥".repeat(filledHearts) + "♡".repeat(Math.max(0, (this.maxHp || 0) - filledHearts));
        const perception = time < this.doubtUntil ? `invertida ${Math.ceil((this.doubtUntil - time) / 1000)}s` : this.levelInfo.key === "jungle"
          ? (this.perceptionTimer > 0 ? (this.inverted ? "invertida" : "expandida") : "clara")
          : "clara";
        const heat = this.levelInfo.key === "volcano" ? ` · Calor ${Math.round(this.heat)}%` : "";
        const power = this.godPowerTimer > 0 ? ` · Fuego divino ${Math.ceil(this.godPowerTimer / 1000)}s` : "";
        const absorption = time < this.absorptionUntil ? `\nAbsorción ${Math.ceil((this.absorptionUntil - time) / 1000)}s · Vel. +28 · Salto +48` : "";
        const items = [this.featherBoots ? "🪶 Botas Pluma" : "", this.guardianMirror ? "🪞 Espejo Guardián" : "",
          this.abyssBagCharges ? `🫙 Bolsa ${this.abyssBagCharges}` : "", this.certaintyAnchor ? "⚓ Ancla" : "", this.bottledPyre ? "🔥 Pira" : "",
          time < this.riskJumpUntil ? `🌊 Salto del Pozo ${Math.ceil((this.riskJumpUntil - time) / 1000)}s` : "",
          time < this.riskInvulnerableUntil ? `🛡️ Invulnerable ${Math.ceil((this.riskInvulnerableUntil - time) / 1000)}s` : "",
          this.riskFog ? "🌫️ Visión -50%" : ""].filter(Boolean);
        this.hudText.setText([
          `Nivel ${this.worldNumber}-${this.substage} · ${this.levelInfo.name}`,
          `${this.levelInfo.concept}`,
          `Vida ${hearts} (${this.hp}/${this.maxHp}) · 🪙 Oro ${this.coins} · 💣 Bombas ${this.bombs} · 🧩 Fragmentos ${this.runFragments}`,
          `Peso +${coinBurden}${this.creditPact ? " · Deuda +10%" : ""} · Vel. ${speed} · Gravedad ${effectiveGravity}`,
          `Percepción: ${perception}${heat}${power}${absorption}${items.length ? `\nÍtems: ${items.join(" · ")}` : ""}`
        ]);
        this.hudBg.setSize(this.hudBg.width, this.hudText.height + 18);
        this.lawText.setText(`INFLACIÓN M${this.worldNumber}: ${inflationMultiplier(this.worldNumber).toFixed(1)}x\n` +
          LAW_DEFS.map(law => `${law.short} ${this.meta[law.key] ? (lawActive(this.meta, law.key) ? "●" : "○") : "·"}`).join("\n"));

        this.nearPrompt = "";
        if (this.graceAvailable) this.nearPrompt = "El camino se ha cerrado. E: Desvanecerse";
        else if (this.carried) this.nearPrompt = `${this.carried.type === "symbolic" ? "Pensamiento" : "Objeto"} sostenido · »: lanzar · Abajo+»: depositar · E: soltar`;
        else if (this.actionHoldStartedAt) this.nearPrompt = `Disolución del Ego ${Math.min(100, Math.round((time - this.actionHoldStartedAt) / 25))}%`;
        else if (this.nearPortable) this.nearPrompt = "E: Levantar objeto";
        else if (this.nearExit) this.nearPrompt = this.levelNumber === TOTAL_STAGES ? "E: trascender" : "E: seguir descendiendo";
        else if (this.nearMerchant) {
          this.nearPrompt = `MERCADER · ${this.merchantOffers()[this.merchantSelection].label} · E/Acción: comprar · »/Mayús: cambiar`;
        }
        else if (this.nearSpecial) this.nearPrompt = this.nearSpecial.used ? "La sala especial está en silencio." : this.nearSpecial.type === "barter"
          ? "ALTAR DEL TRUEQUE · E: 8 oro → 2 vida, o 2 vida → 3 fragmentos"
          : "POZO DEL RIESGO · E: poder temporal por visión y certeza";
        else if (this.nearDramatic) {
          this.nearPrompt = this.nearDramatic.unlocked
            ? "Salto de renuncia: entrá y mantené el salto desde la flecha."
            : `RUTA DRAMÁTICA · E: ${this.coins ? `ofrecer ${this.coins} monedas` : "ofrecer 1 vida"}${this.levelInfo.key === "volcano" ? " · » / Mayús: romper por 1 vida" : ""}`;
        }
        else if (this.nearAltar) {
          const price = inflatedPrice(this.worldNumber);
          this.nearPrompt = this.hp >= this.maxHp ? "El altar no puede curar una vida completa." :
            this.coins >= price ? `E: curar 1 HP por ${price} monedas` : `El altar pide ${price} monedas por 1 HP.`;
        }
        else if (this.nearGod) this.nearPrompt = "E: negociar · » / Mayús: absorber poder arriesgado";
        else if (this.nearSymbolic) this.nearPrompt = this.nearSymbolic.vulnerable(time)
          ? `${this.nearSymbolic.names[this.nearSymbolic.kind]} · E: absorber (${this.coins >= 3 ? "3 monedas" : "1 vida"})`
          : `${this.nearSymbolic.names[this.nearSymbolic.kind]} · » / Mayús: disipar`;
        else if (this.levelInfo.key === "volcano") this.nearPrompt = "E: gastar 1 vida para romper muros cercanos";
        else this.nearPrompt = "RUTA PRINCIPAL · El peso no cierra la salida.";
        if (this.messageTimer > 0) {
          this.messageTimer -= dt;
          this.promptText.setText(this.currentMessage);
        } else {
          this.promptText.setText(this.nearPrompt);
        }
        this.promptText.setVisible(Boolean(this.promptText.text));
      }

      updateLighting(time) {
        const sw = screenW(this);
        const sh = screenH(this);
        const baseRadius = 215 + this.meta.lightBonus * 34;
        const levelPenalty = this.levelInfo.darkness * 120;
        const sporePenalty = this.perceptionTimer > 0 ? 78 : 0;
        const normalRadius = clamp(baseRadius - levelPenalty - sporePenalty + (this.godPowerTimer > 0 ? 82 : 0), 120, 380);
        const radius = this.riskFog ? normalRadius * 0.5 : normalRadius;
        const cam = this.cameras.main;
        const px = this.player.x - cam.scrollX;
        const py = this.player.y - cam.scrollY;
        this.darkness.clear();
        this.darkness.fillStyle(0x020309, this.levelInfo.darkness + (this.perceptionTimer > 0 ? 0.15 : 0));
        this.darkness.fillRect(0, 0, sw, sh);
        this.lightGlow.clear();
        this.lightGlow.fillStyle(this.levelInfo.accent, 0.08);
        this.lightGlow.fillCircle(px, py, radius);
        this.lightGlow.fillStyle(0xffffff, 0.04);
        this.lightGlow.fillCircle(px, py, radius * 0.58 + Math.sin(time * 0.003) * 8);
      }

      collectCoin(player, coin) {
        if (this.ending) return;
        coin.disableBody(true, true);
        this.coins += this.abyssBagCharges > 0 ? 2 : 1;
        if (this.abyssBagCharges > 0) this.abyssBagCharges -= 1;
        this.spark.explode(8, coin.x, coin.y);
        AUDIO.coin();
        if (this.levelInfo.key === "desert" && this.coins % 5 === 0) {
          this.showMessage("La riqueza se instala en tus huesos.", 1600);
        }
      }

      collectFragment(player, shard) {
        if (this.ending) return;
        if (!shard.active) return;
        if (shard.dramaticId) {
          const route = this.generated.dramaticRoutes.find(r => r.id === shard.dramaticId);
          if (!route?.unlocked) return;
          route.collected = true;
          const entry = this.dramaticLabels.find(item => item.route.id === route.id);
          if (entry) entry.label.setText("RUTA DRAMÁTICA\nOFRENDA RECORDADA");
        }
        shard.disableBody(true, true);
        this.runFragments += 1;
        setRunFragmentBank(this.runFragments);
        this.blue.explode(16, shard.x, shard.y);
        AUDIO.fragment();
        this.showMessage("Un pensamiento sobrevive al cuerpo.", 1500);
      }

      touchSpore(player, spore) {
        if (this.ending) return;
        spore.disableBody(true, true);
        this.perceptionTimer = 7600;
        this.sporeMist.explode(28, spore.x, spore.y);
        AUDIO.tone(220, 0.18, "triangle", 0.09, 220);
        this.showMessage("La selva toma prestada tu certeza.", 2100);
      }

      onPushCrate(player, crate) {
        if (this.ending) return;
        const pushPower = this.featherBoots ? 1.05 : clamp(1.05 - effectiveCoinBurden(this.coins, this.meta) * 0.0022, 0.55, 1.05);
        crate.body.velocity.x *= pushPower;
      }

      onBoulderHit(player, rock) {
        if (this.ending) return;
        const force = Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y);
        if (force > 145) this.takeDamage(2, "boulder");
        if (this.ending) return;
      }

      onBoulderTerrainHit(rock, tile) {
        if (this.ending || !rock?.active || !tile) return;
        const force = Math.max(rock.impactSpeed || 0, Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y));
        if (force < 260 || this.time.now < (rock.terrainBreakReadyAt || 0)) return;
        rock.terrainBreakReadyAt = this.time.now + 240;
        rock.impactSpeed = 0;
        this.destroyTerrainCircle(tile.pixelX + TILE / 2, tile.pixelY + TILE / 2, 0.85);
        this.rubble.explode(8, tile.pixelX + TILE / 2, tile.pixelY + TILE / 2);
        AUDIO.demolition();
      }

      onBoulderCrateHit(rock, crate) {
        if (this.ending || !crate?.active) return;
        const force = Math.max(rock.impactSpeed || 0, Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y));
        if (force >= 210) this.breakCrate(crate);
      }

      crackWall(rock, wall) {
        if (this.ending) return;
        if (!wall.active) return;
        if (Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y) > 180 || this.godPowerTimer > 0) {
          this.breakWall(wall);
        }
      }

      breakWall(wall, force = false) {
        if (!wall || !wall.active) return false;
        if (!force && wall.dramaticId && !this.generated.dramaticRoutes.find(r => r.id === wall.dramaticId)?.unlocked) return false;
        this.spark.explode(18, wall.x, wall.y);
        wall.disableBody(true, true);
        AUDIO.noise(0.12, 0.12, 650);
        return true;
      }

      destructiveImpulse(time) {
        if (this.hp <= 1) {
          this.showMessage("Solo queda una vida. El ego no encuentra crédito.", 1700);
          AUDIO.reject();
          return;
        }
        this.hp -= 1;
        let broken = 0;
        this.destructiblesGroup.children.iterate(wall => {
          if (wall && wall.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, wall.x, wall.y) < 135) {
            if (this.breakWall(wall)) broken += 1;
          }
        });
        this.cameras.main.shake(170, 0.008);
        this.spark.explode(36, this.player.x, this.player.y);
        this.destroyTerrainCircle(this.player.x, this.player.y, 2.1);
        AUDIO.dash();
        this.showMessage(broken ? "Entregás algo de vos y el mundo se abre." : "El poder florece sin un objeto.", 1900);
      }

      useAltar() {
        const price = inflatedPrice(this.worldNumber);
        if (this.hp >= this.maxHp) {
          this.showMessage("El altar no encuentra una herida que cerrar.", 1500);
          AUDIO.reject();
          return;
        }
        if (this.coins < price) {
          this.showMessage(`El altar exige ${price} monedas por 1 HP.`, 1500);
          AUDIO.reject();
          return;
        }
        this.coins -= price;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.blue.explode(22, this.nearAltar.x, this.nearAltar.y);
        AUDIO.altar();
        this.showMessage(`El altar devuelve 1 HP por ${price} monedas.`, 2000);
      }

      negotiateWithGod() {
        if (this.runFragments >= 3) {
          this.completeRun();
          return;
        }
        if (this.coins >= 10) {
          this.coins -= 10;
          this.runFragments += 2;
          setRunFragmentBank(this.runFragments);
          this.blue.explode(44, this.player.x, this.player.y);
          AUDIO.altar();
          this.showMessage("Dios acepta la broma de la propiedad.", 2200);
          return;
        }
        this.showMessage("Dios no dice nada. Quizá esa sea la respuesta.", 2200);
        AUDIO.tone(55, 0.4, "sine", 0.09, 0);
      }

      absorbGodPower(time) {
        if (this.runFragments < 1) {
          this.showMessage("No queda conciencia para quemar.", 1600);
          AUDIO.reject();
          return;
        }
        this.runFragments -= 1;
        setRunFragmentBank(this.runFragments);
        this.godPowerTimer = 8000;
        this.invulnUntil = time + 500;
        this.cameras.main.flash(220, 145, 247, 255);
        this.cameras.main.shake(220, 0.006);
        this.blue.explode(55, this.player.x, this.player.y);
        this.destroyTerrainCircle(this.player.x, this.player.y, 2.35);
        AUDIO.fragment();
        if (this.hp > 1 && this.rng() < 0.35) {
          this.hp -= 1;
          this.showMessage("El poder de Dios no cabe bien en un cuerpo en blanco.", 2100);
        } else {
          this.showMessage("Durante ocho segundos, se filtra la autoría.", 2100);
        }
      }

      takeDamage(amount, source) {
        // Requerimiento #1: primerísima línea. Blinda contra daño letal duplicado
        // y contra colisiones que se evalúan justo al morir (fix al Crash on Death).
        if (this.ending || this.hp <= 0) return false;
        const time = this.time.now;
        if (source !== "abyss" && time < this.invulnUntil) return;
        if (source !== "abyss" && this.guardianMirror) {
          this.guardianMirror = false;
          this.invulnUntil = time + 650;
          this.blue.explode(22, this.player.x, this.player.y);
          AUDIO.fragment();
          this.showMessage("El Espejo Guardián absorbió el impacto.", 1700);
          return;
        }
        if (source !== "abyss" && this.amnesiaReady) {
          this.amnesiaReady = false;
          const zoneFragments = Math.max(0, this.runFragments - this.stageFragmentBase);
          this.runFragments = this.stageFragmentBase + Math.floor(zoneFragments * 0.5);
          setRunFragmentBank(this.runFragments);
          this.invulnUntil = time + 650;
          this.blue.explode(22, this.player.x, this.player.y);
          AUDIO.fragment();
          this.showMessage("Amnesia Selectiva: el golpe se olvida junto a la mitad de los fragmentos de zona.", 2300);
          return;
        }
        const scaled = source === "abyss" ? this.hp : source === "heat" ? amount : Math.max(1, Math.round(amount * trapMultiplier(this.meta)));
        this.hp = Math.max(0, this.hp - scaled);
        this.lastDamageAt = time;
        if (this.hp <= 0) {
          this.die();
          return;
        }
        if (this.ending) return;
        this.invulnUntil = time + 900;
        this.player.setTint(0xff5b67);
        this.time.delayedCall(120, () => {
          if (this.ending) return;
          if (this.player?.active) this.player.clearTint();
        });
        this.cameras.main.shake(100, 0.005);
        this.dust.explode(16, this.player.x, this.player.y);
        AUDIO.hurt();
        this.showMessage(source === "spikes" ? "El sentido tiene filos." : source === "lava" ? "El poder quema aquello que lo sostiene." : "El mundo responde con fuerza.", 1300);
        if (this.ending) return;
      }

      checkDeathPlane() {
        if (this.ending) return;
        if (this.hp <= 0 || !this.player?.body) return;
        if (this.player.y > this.generated.rows * TILE + 120) {
          this.player.body.stop();
          this.player.body.enable = false;
          if (this.ending) return;
          this.hp = 0;
          this.preserveEtherealGold();
          this.ending = true;
          this.stopForAstral();
          if (!this.ending) return;
          this.startAstral(false, "death");
        }
      }

      descend() {
        if (this.ending) return;
        if (this.usedExit) return;
        this.usedExit = true;
        this.runFragments += 1;
        setRunFragmentBank(this.runFragments);
        this.blue.explode(30, this.exitDoor.x, this.exitDoor.y);
        AUDIO.fragment();
        if (this.levelNumber >= TOTAL_STAGES) {
          this.completeRun();
          return;
        }
        this.cameras.main.fadeOut(300, 4, 6, 10);
        this.time.delayedCall(320, () => {
          if (this.ending) return;
          this.scene.start("Game", {
            level: this.levelNumber + 1,
            seed: this.seed,
            runId: this.runId,
            isCustomSeed: this.isCustomSeed,
            coins: this.coins,
            fragments: this.runFragments,
            hp: this.hp,
            maxHp: this.maxHp,
            creditPact: this.creditPact,
            bombs: this.bombs
          });
        });
      }

      stopForAstral() {
        // Freeze before scene.start: shutdown may destroy objects synchronously.
        if (this.player?.body) {
          this.player.body.stop();
          this.player.body.enable = false;
        }
        const world = this.physics.world;
        for (const body of [...(world?.bodies?.entries || []), ...(world?.staticBodies?.entries || [])]) body.enable = false;
        for (const collider of world?.colliders?.getActive?.() || []) collider.active = false;
        this.physics.pause();
        this.controls.releaseAll();
        this.cameras.main.stopFollow();
        this.cameras.main.resetFX();
        this.tweens.pauseAll();
        this.time.removeAllEvents();
        for (const emitter of [this.dust, this.footDust, this.spark, this.blue, this.sporeMist, this.rubble]) {
          if (emitter) emitter.setActive(false);
        }
        this.channelRing?.clear();
        for (const attack of this.symbolicAttacks || []) attack.graphics?.destroy();
        this.symbolicAttacks = [];
        AUDIO.stopDrone();
      }

      completeRun() {
        if (this.ending) return;
        this.ending = true;
        this.stopForAstral();
        const meta = loadMeta();
        meta.ascensions += 1;
        saveMeta(meta);
        this.startAstral(true, "transcendence", 4);
      }

      startAstral(victory, reason, bonusFragments = 0) {
        if (!this.ending) return;
        this.scene.start("Astral", {
          victory,
          runId: this.runId,
          isCustomSeed: this.isCustomSeed,
          runFragments: this.runFragments + bonusFragments,
          reachedLevel: this.levelNumber,
          reason
        });
      }

      die(isSuicide = false) {
        // Guard: ya estamos muriendo o ya empezamos a transicionar al Astral.
        if (this.ending) return;

        // Requerimiento #1: marcar el estado de muerte antes de cualquier otra cosa
        // para que update(), colisiones y otros handlers no-actúen sobre un jugador moribundo.
        this.ending = true;

        // Preservar oro etéreo (igual que antes) — debe ocurrir antes del freeze total.
        this.preserveEtherealGold();

        // PENALIZACIÓN DE LA "DISOLUCIÓN DEL EGO" (suicidio):
        // Al disolver el ego se disipa la conciencia recolectada (fragmentos).
        // Este bloque manipula EXCLUSIVAMENTE variables (lógica pura): la reducción
        // de fragmentos se aplica siempre, pero cualquier actualización visual del
        // HUD o sonido relacionado con fragmentos queda detrás de una guarda estricta
        // (`if (!this.ending)`) Y de un try/catch, para que un fallo aquí jamás
        // detenga el ciclo de Phaser ni congele el juego.
        if (isSuicide && (this.runFragments || 0) > 0) {
          try {
            // Reset a nivel de variables + sin-cronización con el banco de la run.
            this.runFragments = 0;
            setRunFragmentBank(0);

            // Guardas estrictas: con this.ending === true (como ocurre al llegar
            // aquí) NO tocamos HUD ni sonido; el loop de update() ya no pinta el HUD.
            if (!this.ending) this.updateHud?.(this.time.now, 0);
            if (!this.ending && AUDIO?.unlocked) AUDIO.reject?.();
          } catch (err) {
            if (window.console) {
              console.error("[Alma en Blanco] penalización de fragmentos (Disolución del Ego) falló: no se interrumpe la muerte.", err);
            }
          }
        }

        // Snapshot de la posición del jugador en el momento exacto de la muerte,
        // porque stopForAstral() viene después y la escena se reinicia.
        const deathX = this.player?.x ?? 0;
        const deathY = this.player?.y ?? 0;

        // Requerimiento #2: pausar las físicas del jugador manualmente.
        // (stopForAstral() también lo hace, pero lo aplicamos YA para que el sprite
        // quede quieto durante la animación de 1.5s. Ojo: NO llamamos stopForAstral()
        // todavía porque hace this.time.removeAllEvents() y mataría nuestro delayedCall.)
        // Requerimiento #3: desvincular al jugador de la escalera y restaurar la
        // gravedad normal para que un cuerpo pausado no reciba gravedad especial.
        this.onLadder = false;
        if (this.player?.body) {
          this.player.body.allowGravity = true;
          this.player.body.stop();
          this.player.body.enable = false;
        }

        // Requerimiento #3: ocultar el sprite del jugador. El cuerpo físico ya está
        // desactivado, así que no hay riesgo de quedar atrapado en colisiones.
        if (this.player) {
          this.player.setVisible(false);
        }

        // Requerimiento #4: explosión de partículas en la posición exacta del jugador.
        // Patrón idéntico al de this.rubble (línea ~1692): emitter pre-creado,
        // emitting:false por defecto, y luego .explode(N, x, y) para detonar.
        // Usamos "particle-blue" + "particle-white" mezcladas en dos passes para
        // un efecto más dramático que el rubble de color único del nivel.
        if (!this.deathBurst) {
          this.deathBurst = this.add.particles(0, 0, "particle-blue", {
            lifespan: { min: 520, max: 1100 },
            speed: { min: 90, max: 260 },
            angle: { min: 0, max: 360 },
            gravityY: 380,
            scale: { start: 0.9, end: 0 },
            alpha: { start: 1, end: 0 },
            maxParticles: 60,
            emitting: false
          }).setDepth(20);
        }
        // Detonamos 24 partículas azules en todas direcciones.
        this.deathBurst.explode(24, deathX, deathY);

        // Segundo pass con partículas blancas para dar destello interior.
        if (!this.deathSpark) {
          this.deathSpark = this.add.particles(0, 0, "particle-white", {
            lifespan: { min: 280, max: 540 },
            speed: { min: 60, max: 180 },
            angle: { min: 0, max: 360 },
            gravityY: 220,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            maxParticles: 40,
            emitting: false
          }).setDepth(21);
        }
        this.deathSpark.explode(18, deathX, deathY);

        // Un pequeño flash en la cámara para anclar el momento dramático.
        this.cameras.main.flash(180, 220, 240, 255);

        // Requerimiento #5: sonido de muerte sintético.
        // No modificamos el AudioEngine (fuera del alcance). Construimos un
        // acorde descendente con AUDIO.tone() — onda sine grave + glide negativo.
        if (AUDIO?.unlocked) {
          AUDIO.tone(110, 0.9, "sine", 0.16, -90);   // bajo que desciende al abismo
          AUDIO.tone(165, 0.7, "triangle", 0.08, -130); // quinta que cae más rápido
          AUDIO.noise(0.35, 0.05, 320);              // ruido sutil = "alma dispersándose"
        }

        // Requerimiento #6: temporizador de 1500ms antes de cambiar de escena.
        // Recién acá invocamos stopForAstral() (que hace removeAllEvents() pero ya
        // está nuestro delayedCall en cola y se ejecutará antes de que eso importe).
        // Guardamos el runId y los fragmentos en locales porque después del
        // stopForAstral() el contexto del scene puede limpiar referencias.
        const payload = {
          victory: false,
          runId: this.runId,
          isCustomSeed: this.isCustomSeed,
          runFragments: this.runFragments,
          reachedLevel: this.levelNumber,
          reason: "death"
        };
        const self = this;
        this.time.delayedCall(1500, function() {
          self.stopForAstral();
          self.scene.start("Astral", payload);
        });
      }

      preserveEtherealGold() {
        if (this.etherealGoldPreserved) return;
        this.etherealGoldPreserved = true;
        if (lawActive(this.meta, "etherealBond") && this.coins > 0) {
          const preserved = Math.floor(this.coins * 0.15);
          if (preserved > 0) {
            this.runFragments = clamp(this.runFragments + preserved, 0, 999);
            setRunFragmentBank(this.runFragments);
          }
        }
      }

      showMessage(text, duration = 1600) {
        this.currentMessage = text;
        this.messageTimer = duration;
      }
    }

    class AstralScene extends Phaser.Scene {
      constructor() {
        super("Astral");
      }

      init(data) {
        this.dataIn = data || {};
      }

      create() {
        AUDIO.unlock();
        AUDIO.stopDrone();
        const sw = screenW(this);
        const sh = screenH(this);
        const narrow = sw < 620 || sh < 460;
        const short = sh < 460;
        this.meta = loadMeta();
        this.runId = this.dataIn.runId || "legacy-run";
        this.isCustomSeed = Boolean(this.dataIn.isCustomSeed);
        const bankKey = `${SAVE_KEY}:banked:${this.runId}`;
        const alreadyBanked = sessionStorage.getItem(bankKey) === "1";
        this.bankedThisVisit = alreadyBanked ? (this.dataIn.shownBanked || 0) : clamp(this.dataIn.runFragments || 0, 0, 999);
        // Anti-trampas: en Semilla Personalizada no se suman fragmentos al meta-progreso permanente.
        if (!alreadyBanked && !this.isCustomSeed) {
          this.meta.fragments += this.bankedThisVisit;
          saveMeta(this.meta);
          sessionStorage.setItem(bankKey, "1");
        }
        resetRunFragmentBank();
        this.selected = clamp(this.dataIn.selected || 0, 0, LAW_DEFS.length - 1);
        this.cameras.main.setBackgroundColor("#020309");
        this.drawAstral();
        const title = this.dataIn.victory ? "TRASCENDENCIA" : "LA NEGOCIACIÓN ASTRAL";
        this.add.text(sw / 2, short ? 34 : (narrow ? 48 : 58), title, {
          fontFamily: "monospace",
          fontSize: `${short ? 19 : (narrow ? 22 : 33)}px`,
          color: "#f7fbff",
          align: "center"
        }).setOrigin(0.5).setShadow(0, 0, "#9dfcff", 12);
        this.add.text(sw / 2, short ? 62 : (narrow ? 86 : 106), this.dataIn.victory ? "El Alma en Blanco alcanza al autor y sigue inconclusa." : "La muerte es una frontera, no una conclusión.", {
          fontFamily: "monospace",
          fontSize: `${short ? 10 : (narrow ? 12 : 15)}px`,
          color: "#b7c5ce",
          align: "center",
          wordWrap: { width: Math.min(740, sw - 36) }
        }).setOrigin(0.5);
        this.fragmentText = this.add.text(sw / 2, short ? 91 : (narrow ? 126 : 145), "", {
          fontFamily: "monospace",
          fontSize: `${short ? 12 : (narrow ? 14 : 18)}px`,
          color: "#9dfcff",
          align: "center"
        }).setOrigin(0.5);
        this.optionRows = [];
        this.buildOptions();
        this.restartText = this.add.text(sw / 2, sh - (short ? 34 : (narrow ? 42 : 44)), "VOLVER A LAS RUINAS", {
          fontFamily: "monospace",
          fontSize: `${short ? 12 : (narrow ? 14 : 16)}px`,
          color: "#061014",
          align: "center",
          backgroundColor: "#a7f7ff",
          padding: { left: 18, right: 18, top: 9, bottom: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.restartText.on("pointerdown", () => {
          AUDIO.unlock();
          this.restartRun();
        });
        this.add.text(sw / 2, sh - (short ? 10 : 16), "Espacio/E: comprar o activar · C: borrar leyes.", {
          fontFamily: "monospace",
          fontSize: `${short ? 8 : 10}px`,
          color: "#8898a4",
          align: "center"
        }).setOrigin(0.5);
        this.input.keyboard.on("keydown-UP", () => this.moveSelect(-1));
        this.input.keyboard.on("keydown-W", () => this.moveSelect(-1));
        this.input.keyboard.on("keydown-DOWN", () => this.moveSelect(1));
        this.input.keyboard.on("keydown-S", () => this.moveSelect(1));
        this.input.keyboard.on("keydown-ENTER", () => this.restartRun());
        this.input.keyboard.on("keydown-SPACE", () => this.buySelected());
        this.input.keyboard.on("keydown-E", () => this.buySelected());
        this.input.keyboard.on("keydown-C", () => {
          saveMeta({ ...DEFAULT_META });
          resetRunFragmentBank();
          this.scene.start("Menu");
        });
        this.input.on("pointerdown", () => AUDIO.unlock());
        this.refresh();
        this.scale.on("resize", this.onAstralResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.onAstralResize, this));
      }

      onAstralResize() {
        this.scene.restart({ ...this.dataIn, selected: this.selected, shownBanked: this.bankedThisVisit });
      }

      drawAstral() {
        const sw = screenW(this);
        const sh = screenH(this);
        const g = this.add.graphics();
        g.fillStyle(0x020309, 1);
        g.fillRect(0, 0, sw, sh);
        for (let i = 0; i < 130; i += 1) {
          g.fillStyle(i % 9 === 0 ? 0x9dfcff : 0xf7fbff, Phaser.Math.FloatBetween(0.12, 0.65));
          g.fillRect(Between(0, sw), Between(0, sh), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
        }
        g.fillStyle(0xece8db, 0.09);
        g.fillCircle(sw / 2, sh * 0.55, Math.min(230, sw * 0.58));
        g.fillStyle(0xece8db, 0.88);
        g.fillRoundedRect(sw / 2 - 75, Math.max(150, sh * 0.34), 150, 130, 20);
        g.fillStyle(0x03050a, 1);
        g.fillCircle(sw / 2, Math.max(211, sh * 0.34 + 61), 36);
        g.fillStyle(0xf7fbff, 1);
        g.fillCircle(sw / 2, Math.max(211, sh * 0.34 + 61), 23);
        g.fillStyle(0x03050a, 1);
        g.fillCircle(sw / 2, Math.max(211, sh * 0.34 + 61), 8);
      }

      buildOptions() {
        const sw = screenW(this);
        const sh = screenH(this);
        const narrow = sw < 620 || sh < 460;
        const short = sh < 460;
        const columns = sw >= 520 ? 2 : 1;
        const rowW = columns === 2 ? (sw - 44) / 2 : Math.min(narrow ? sw - 28 : 680, sw - 28);
        const rows = Math.ceil(LAW_DEFS.length / columns);
        const startY = short ? 128 : (narrow ? 160 : 190);
        const bottomY = sh - (short ? 90 : 105);
        const gapY = rows > 1 ? (bottomY - startY) / (rows - 1) : 0;
        const rowH = Math.min(short ? 48 : 58, gapY - 5);
        const gapX = rowW + 16;
        LAW_DEFS.forEach((law, index) => {
          const col = columns === 2 ? index % 2 : 0;
          const row = columns === 2 ? Math.floor(index / 2) : index;
          const centerX = columns === 2 ? 14 + col * gapX + rowW / 2 : sw / 2;
          const y = startY + row * gapY;
          const left = centerX - rowW / 2 + 12;
          const bg = this.add.rectangle(centerX, y, rowW, rowH, 0x050910, 0.74)
            .setStrokeStyle(1, 0x9dfcff, 0.18)
            .setInteractive({ useHandCursor: true });
          const text = this.add.text(left, y - (short ? 20 : 23), "", {
            fontFamily: "monospace",
            fontSize: `${short ? 9 : (narrow ? 10 : 12)}px`,
            color: "#f1fbff",
            wordWrap: { width: rowW - 24 }
          });
          const desc = this.add.text(left, y + (short ? 2 : 4), "", {
            fontFamily: "monospace",
            fontSize: `${short ? 8 : (narrow ? 9 : 12)}px`,
            color: "#98a8b2",
            wordWrap: { width: rowW - 24 }
          });
          bg.on("pointerdown", () => {
            AUDIO.unlock();
            this.selected = index;
            this.buySelected();
          });
          this.optionRows.push({ bg, text, desc, law });
        });
      }

      moveSelect(dir) {
        this.selected = Phaser.Math.Wrap(this.selected + dir, 0, LAW_DEFS.length);
        AUDIO.tone(260, 0.05, "square", 0.04, 60);
        this.refresh();
      }

      buySelected() {
        const law = LAW_DEFS[this.selected];
        const owned = this.meta[law.key];
        if (owned) {
          const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
          this.meta[activeKey] = this.meta[activeKey] ? 0 : 1;
          saveMeta(this.meta);
          AUDIO.tone(this.meta[activeKey] ? 440 : 180, 0.12, "square", 0.06, this.meta[activeKey] ? 120 : -80);
          this.refresh();
          return;
        }
        if (!lawUnlocked(this.meta, law)) {
          AUDIO.reject();
          return;
        }
        if (this.meta.fragments < law.cost) {
          AUDIO.reject();
          return;
        }
        this.meta.fragments -= law.cost;
        this.meta[law.key] = 1;
        this.meta[`active${law.key[0].toUpperCase()}${law.key.slice(1)}`] = 1;
        saveMeta(this.meta);
        AUDIO.buy();
        this.refresh();
      }

      refresh() {
        this.fragmentText.setText(`Fragmentos: ${this.meta.fragments}   Obtenidos: ${this.bankedThisVisit}`);
        this.optionRows.forEach((row, index) => {
          const owned = Boolean(this.meta[row.law.key]);
          const unlocked = lawUnlocked(this.meta, row.law);
          const active = lawActive(this.meta, row.law.key);
          const state = owned ? (active ? "[ACTIVA]" : "[INACTIVA]") : unlocked ? `Costo ${row.law.cost}` : `BLOQ. T${row.law.tier - 1}`;
          row.text.setText(`T${row.law.tier} · ${row.law.title} · ${state}`);
          row.desc.setText(`${row.law.body}  ${row.law.value(owned)}`);
          const selectedColor = active ? 0x15372e : 0x2a2e34;
          row.bg.setFillStyle(index === this.selected ? (owned ? selectedColor : 0x102029) : (owned && !active ? 0x11151a : 0x050910), index === this.selected ? 0.92 : 0.74);
          row.bg.setStrokeStyle(1, active ? 0x75f1b4 : index === this.selected ? 0x9dfcff : 0x68727a, active ? 0.78 : index === this.selected ? 0.75 : 0.28);
          row.text.setColor(owned ? (active ? "#8af0b0" : "#929aa1") : unlocked ? "#f1fbff" : "#67737d");
        });
      }

      restartRun() {
        AUDIO.unlock();
        resetRunFragmentBank();
        this.scene.start("Game", { level: 1, seed: `blank-${Date.now()}`, runId: newRunId(), coins: 0, fragments: 0, hp: 5, isCustomSeed: false });
      }
    }

class PauseScene extends Phaser.Scene {
      constructor() {
        super("Pause");
      }

      create(data) {
        const sw = screenW(this);
        const sh = screenH(this);
        const narrow = sw < 520;
        this.resumed = false;
        this.overlay = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.75).setOrigin(0);
        this.title = this.add.text(sw / 2, sh / 2 - 30, "PAUSADO", {
          fontFamily: "monospace",
          fontSize: `${narrow ? 34 : 46}px`,
          color: "#f7fbff",
          align: "center"
        }).setOrigin(0.5).setShadow(0, 0, "#99f7ff", 12);
        this.resumeText = this.add.text(sw / 2, sh / 2 + 40, "Tocar para Reanudar", {
          fontFamily: "monospace",
          fontSize: `${narrow ? 16 : 20}px`,
          color: "#a7f7ff",
          align: "center",
          backgroundColor: "rgba(4, 8, 16, 0.72)",
          padding: { left: 18, right: 18, top: 10, bottom: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.resumeText.on("pointerdown", () => this.resumeGame());
        this.resumeText.on("pointerover", () => this.resumeText.setColor("#f7fbff"));
        this.resumeText.on("pointerout", () => this.resumeText.setColor("#a7f7ff"));
        const seedNumber = Number.isFinite(Number(data?.seed)) ? Number(data.seed) : null;
        const seedValue = seedNumber == null ? "" : String(seedNumber);
        this.seedText = this.add.text(sw / 2, sh - (narrow ? 18 : 26), seedNumber == null ? "Semilla: —" : `Semilla: ${seedNumber} · toca para copiar`, {
          fontFamily: "monospace",
          fontSize: `${narrow ? 11 : 13}px`,
          color: "#92a4ad",
          align: "center"
        }).setOrigin(0.5).setAlpha(0.85).setInteractive({ useHandCursor: true });
        if (seedNumber != null) {
          this.seedText.on("pointerover", () => this.seedText.setColor("#cfe3ec"));
          this.seedText.on("pointerout", () => this.seedText.setColor("#92a4ad"));
          this.seedText.on("pointerdown", () => this.copySeedToClipboard(seedValue));
        }
        this.input.on("pointerdown", () => AUDIO.unlock());
        this.input.keyboard.on("keydown-ESC", this.resumeGame, this);
        this.input.keyboard.on("keydown-P", this.resumeGame, this);
        this.scale.on("resize", this.layout, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.layout, this));
      }

      layout() {
        const sw = screenW(this);
        const sh = screenH(this);
        this.overlay.setSize(sw, sh);
        this.overlay.displayWidth = sw;
        this.overlay.displayHeight = sh;
        this.title.setPosition(sw / 2, sh / 2 - 30);
        this.resumeText.setPosition(sw / 2, sh / 2 + 40);
        if (this.seedText) {
          this.seedText.setPosition(sw / 2, sh - (sw < 520 ? 18 : 26));
          this.seedText.setFontSize(`${sw < 520 ? 11 : 13}px`);
        }
      }

      copySeedToClipboard(value) {
        AUDIO.unlock();
        const label = `Semilla: ${value} · toca para copiar`;
        const restore = () => {
          if (this.seedText) {
            this.seedText.setText(label);
            this.seedText.setColor("#92a4ad");
          }
        };
        const showFeedback = () => {
          if (!this.seedText) return;
          this.seedText.setText(`¡Copiado! Semilla: ${value}`);
          this.seedText.setColor("#a7f7ff");
          this.time.delayedCall(1000, restore);
        };
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(value)
            .then(showFeedback)
            .catch(() => { this.fallbackCopyText(value); showFeedback(); });
        } else {
          this.fallbackCopyText(value);
          showFeedback();
        }
      }

      fallbackCopyText(value) {
        try {
          const ta = document.createElement("textarea");
          ta.value = value;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, ta.value.length);
          document.execCommand("copy");
          document.body.removeChild(ta);
        } catch (error) {
          // Portapapeles no disponible: la semilla queda visible para copiarse manualmente.
        }
      }

      resumeGame() {
        if (this.resumed) return;
        this.resumed = true;
        AUDIO.unlock();
        this.scene.stop();
        this.scene.resume("Game");
      }
    }
    function installSelfTests() {
      window.__BLANK_SOUL_SELF_TEST__ = function runSelfTest(seedBase = "test-seed") {
        const metaCases = [
          { ...DEFAULT_META },
          { ...DEFAULT_META, economyGrace: 1, willInertia: 1, doubleJump: 1, etherealBond: 1, selectiveAmnesia: 1, greedTransmutation: 1 }
        ];
        const results = [];
        const failures = [];
        for (const meta of metaCases) {
          LEVELS.forEach(level => {
            for (let i = 0; i < 6; i += 1) {
              const map = new ProceduralMap(`${seedBase}-${i}`, level, meta).generate();
              const result = map.selfTest();
              results.push({ level: level.key, seed: i, ...result });
              if (!result.ok) failures.push({ level: level.key, seed: i, failures: result.failures });
            }
          });
        }
        const normalized = normalizeMeta({ fragments: 12, economyGrace: 4, willInertia: -2, doubleJump: "3" });
        if (normalized.economyGrace !== 1 || normalized.doubleJump !== 1) failures.push({ system: "meta clamp", failures: ["laws not clamped"] });
        if (normalized.willInertia !== 0) failures.push({ system: "meta clamp", failures: ["negative law not clamped"] });
        if (Math.round(BASE_GRAVITY * gravityMultiplier({ gravityRelief: 0 })) !== 800) failures.push({ system: "physics", failures: ["base gravity drifted"] });
        if (economyMultiplier({ economyGrace: 1 }) !== 0.72) failures.push({ system: "economy", failures: ["gold burden law drifted"] });
        if (inflatedPrice(4) !== 44 || daggerReward(4) !== 80) failures.push({ system: "economy", failures: ["world inflation drifted"] });
        return {
          ok: failures.length === 0,
          failures,
          mapsChecked: results.length,
          averageCoins: Math.round(results.reduce((sum, r) => sum + r.coins, 0) / results.length),
          averageHazards: Math.round(results.reduce((sum, r) => sum + r.hazards, 0) / results.length),
          controls: {
            coyoteMs: 110,
            jumpBufferMs: 125,
            variableJumpCutoff: -120,
            touchButtons: 8
          }
        };
      };
    }

    function installNativeTouchGuards(game) {
      const canvas = game && game.canvas;
      if (!canvas || canvas.__blankSoulTouchGuardsInstalled) return;
      const preventNativeGesture = event => {
        if (event.cancelable) event.preventDefault();
      };
      ["touchstart", "touchmove", "touchend", "touchcancel", "gesturestart"].forEach(type => {
        canvas.addEventListener(type, preventNativeGesture, { passive: false });
      });
      canvas.style.touchAction = "none";
      canvas.style.webkitUserSelect = "none";
      canvas.__blankSoulTouchGuardsInstalled = true;
    }

    installSelfTests();

    const config = {
      type: Phaser.AUTO,
      parent: "game-root",
      width: window.innerWidth || VIEW_W,
      height: window.innerHeight || VIEW_H,
      backgroundColor: "#05060a",
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: BASE_GRAVITY },
          debug: false,
          fps: 60,
          fixedStep: true
        }
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: "game-root"
      },
      scene: [BootScene, MenuScene, GameScene, AstralScene, PauseScene]
    };

    window.__BLANK_SOUL_CONFIG__ = {
      title: "Alma en Blanco V5: Interactividad Física",
      levels: LEVELS.map(l => ({ id: l.id, key: l.key, name: l.name, concept: l.concept })),
      physics: {
        baseGravity: BASE_GRAVITY,
        maxVelocity: 300,
        frictionTarget: 0.8,
        coyoteMs: 110,
        jumpBufferMs: 125
      },
      storageKey: SAVE_KEY
    };

    window.addEventListener("load", () => {
      if (!window.Phaser) {
        document.querySelector(".fallback").textContent = "No se pudo cargar Phaser. Revisá la conexión a Internet y recargá la página.";
        return;
      }
      window.__BLANK_SOUL_GAME__ = new Phaser.Game(config);
      installNativeTouchGuards(window.__BLANK_SOUL_GAME__);
    });


// ===== Exports (Fase 1) =====
// Exponen los bloques que la Fase 2 va a extraer a archivos propios.
// Todavia nada los importa; es intencional y no cambia el comportamiento.
export {
  VIEW_W, VIEW_H, TILE, BASE_GRAVITY, JUMP_SPEED, SACRIFICE_JUMP_SPEED,
  ROUTE_MAIN, ROUTE_DRAMATIC, TOTAL_STAGES, MAX_LAW_TIER,
  SAVE_KEY, RUN_FRAGMENT_KEY, LEVELS, LAW_DEFS, DEFAULT_META,
  screenW, screenH, hashSeed, mulberry32, randInt, choice,
  toSaveShape, fromSaveShape, loadMeta, saveMeta, normalizeMeta,
  gravityMultiplier, trapMultiplier, economyMultiplier, inflationMultiplier,
  inflatedPrice, daggerReward, lawUnlocked, lawActive,
  runFragmentBank, setRunFragmentBank, resetRunFragmentBank, newRunId,
  effectiveCoinBurden, playerMoveSpeed, rectsOverlap, makeRect,
  AudioEngine, AUDIO, BootScene, MenuScene, ProceduralMap, SymbolicEntity,
  ControlRig, GameScene, AstralScene, PauseScene,
  installSelfTests, installNativeTouchGuards, config
};
