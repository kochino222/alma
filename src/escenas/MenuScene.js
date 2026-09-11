// MenuScene - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { screenW, screenH } from "../core/utils.js";
import { LEVELS, LAW_DEFS, SAVE_KEY, DEFAULT_META } from "../core/constantes.js";
import { loadMeta, saveMeta, resetRunFragmentBank, newRunId } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export class MenuScene extends Phaser.Scene {
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
      const x = Phaser.Math.Between(0, sw);
      const y = Phaser.Math.Between(0, sh);
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