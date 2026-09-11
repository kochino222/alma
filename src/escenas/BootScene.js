// BootScene - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { installNativeTouchGuards } from "../controles/touchGuards.js";

export class BootScene extends Phaser.Scene {
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