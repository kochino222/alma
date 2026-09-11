// PauseScene - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { screenW, screenH } from "../core/utils.js";
import { AUDIO } from "../audio/AudioEngine.js";

export class PauseScene extends Phaser.Scene {
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