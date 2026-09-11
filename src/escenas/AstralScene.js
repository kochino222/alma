// AstralScene - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { screenW, screenH, clamp } from "../core/utils.js";
import { LEVELS, LAW_DEFS, SAVE_KEY, DEFAULT_META } from "../core/constantes.js";
import { loadMeta, saveMeta, resetRunFragmentBank, newRunId, lawUnlocked, lawActive } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export class AstralScene extends Phaser.Scene {
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
      g.fillRect(Phaser.Math.Between(0, sw), Phaser.Math.Between(0, sh), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
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