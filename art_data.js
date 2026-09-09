window.ArtData = (() => {
  "use strict";

  return {
    // Función orquestadora para cargar todos los sprites estáticos al inicio
    generateBootTextures: function(scene) {
      this.makeTile(scene, "tile-desert", [0x9c6b3f, 0xd7a24d, 0x5a3328, 0xffcf73]);
      this.makeTile(scene, "tile-jungle", [0x214d31, 0x4f9b55, 0x112619, 0x8af0b0]);
      this.makeTile(scene, "tile-volcano", [0x3f1e24, 0x7a3330, 0x160a0b, 0xff7438]);
      this.makeTile(scene, "tile-void", [0xb8b8c6, 0xf6f3e7, 0x383a47, 0x7df7ff]);

      this.makePlayer(scene, "player", {}); // Textura base: collider físico invisible

      // === Sistema de Animación Esquelética (Paper-Doll Rig) — ETAPA 1 ===
      // Generamos texturas individuales por parte del cuerpo. En juego.js
      // (ETAPA 2) se compondrán/posarán por separado con transform/rotation.
      this.makePlayerTorso(scene, "player-torso");   // 16x20
      this.makePlayerHead(scene, "player-head", {}); // 18x16
      this.makePlayerLimb(scene, "player-limb");     // 6x14 (brazos/piernas frontales)
      // Miembros traseros con gris muy sutil para distinguirlos del frente;
      // alternativamente se pueden tintar en juego.js con setTint().
      this.makePlayerLimb(scene, "player-limb-back", 0xe5e8ed);

      this.makeCoin(scene);
      this.makeFragment(scene);
      this.makeSpike(scene);
      this.makeBoulder(scene);
      this.makeCrate(scene);
      this.makeBomb(scene);
      this.makePot(scene);
      this.makeExit(scene);
      this.makeAltar(scene);
      this.makeSpore(scene);
      this.makeLadder(scene);
      this.makeWall(scene);
      this.makeParticles(scene);
    },

    makeTile: function(scene, key, colors) {
      const TILE = 32;
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(colors[0], 1);
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle(colors[1], 0.5);
      g.fillRect(0, 0, TILE, 7);
      g.fillStyle(colors[2], 0.35);
      g.fillRect(0, 25, TILE, 7);
      g.lineStyle(1, colors[3], 0.35);
      for (let i = 0; i < 4; i += 1) {
        const x = (i * 9 + colors[0]) % TILE;
        const y = (i * 13 + colors[1]) % TILE;
        g.strokeRect(x, y, 7, 4);
      }
      if (key === "tile-void") {
        g.lineStyle(2, 0x353542, 0.45);
        g.beginPath();
        g.moveTo(2, 27);
        g.lineTo(13, 12);
        g.lineTo(29, 7);
        g.strokePath();
      }
      g.generateTexture(key, TILE, TILE);
      g.destroy();
    },

    // Textura base "player": marco invisible (transparente) de 32x46 que actúa
    // como collider físico. GameScene lo usa con body.setSize(20,35).setOffset(6,10);
    // al ser transparente no se ve, pero conserva exactamente las físicas originales.
    // Las partes visibles se generan por separado (Torso / Head / Limb).
    makePlayer: function(scene, key = "player", layers = {}) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      // Marco casi imperceptible del tamaño del lienzo original (no altera el body).
      g.fillStyle(0x000000, 0.001);
      g.fillRect(6, 10, 20, 35);
      g.generateTexture(key, 32, 46);
      g.destroy();
    },

    // Torso estilizado y redondeado (16x20), blanco con contorno suave para
    // integrarse con el resto del cuerpo.
    makePlayerTorso: function(scene, key = "player-torso") {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xf7fbff, 1);
      g.fillRoundedRect(0, 0, 16, 20, 4);
      g.lineStyle(2, 0x8ba0ad, 1);
      g.strokeRoundedRect(1, 1, 14, 18, 3);
      // Leve acento cian en el pecho del diseño original
      g.fillStyle(0x98e8ff, 0.12);
      g.fillRoundedRect(2, 2, 12, 4, 2);
      g.generateTexture(key, 16, 20);
      g.destroy();
    },

    // Cabeza cuadrada característica (18x16) con visor cian y ojos del diseño original.
    makePlayerHead: function(scene, key = "player-head", layers = {}) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xf7fbff, 1);
      g.fillRoundedRect(0, 0, 18, 16, 3);
      g.lineStyle(2, 0x8ba0ad, 1);
      g.strokeRoundedRect(1, 1, 16, 14, 2);
      // Ojos
      g.fillStyle(0x0a0d15, 1);
      g.fillRect(4, 5, 3, 3);
      g.fillRect(12, 5, 3, 3);
      // Visor cian característico
      g.fillStyle(0x98e8ff, 0.9);
      g.fillRect(6, 9, 7, 2);
      g.generateTexture(key, 18, 16);
      g.destroy();
    },

    // Miembro genérico alargado y redondeado (6x14). Sirve tanto para brazos como
    // para piernas. El parámetro `color` (opcional) permite crear una variante
    // "trasera" con gris muy sutil; si no se pasa, queda blanco para poder
    // tintearse en juego.js con setTint().
    makePlayerLimb: function(scene, key = "player-limb", color = 0xf7fbff) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 1);
      g.fillRoundedRect(0, 0, 6, 14, 3);
      g.lineStyle(1, 0x8ba0ad, 0.45);
      g.strokeRoundedRect(1, 1, 4, 12, 2);
      g.generateTexture(key, 6, 14);
      g.destroy();
    },

    makeCoin: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffc247, 1);
      g.fillCircle(12, 12, 10);
      g.fillStyle(0xfff0a5, 1);
      g.fillCircle(9, 8, 3);
      g.lineStyle(2, 0x8f5d20, 1);
      g.strokeCircle(12, 12, 10);
      g.lineStyle(1, 0x8f5d20, 0.55);
      g.strokeCircle(12, 12, 5);
      g.generateTexture("coin", 24, 24);
      g.destroy();
    },

    makeFragment: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x8ffff2, 1);
      g.beginPath();
      g.moveTo(12, 0); g.lineTo(24, 12); g.lineTo(12, 28); g.lineTo(0, 12);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.75);
      g.beginPath();
      g.moveTo(12, 3); g.lineTo(18, 12); g.lineTo(12, 23); g.lineTo(8, 12);
      g.closePath();
      g.fillPath();
      g.generateTexture("fragment", 24, 28);
      g.destroy();
    },

    makeSpike: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x1e2028, 0);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xe8eef2, 1);
      g.beginPath();
      g.moveTo(1, 31); g.lineTo(10, 6); g.lineTo(17, 31);
      g.closePath();
      g.fillPath();
      g.beginPath();
      g.moveTo(13, 31); g.lineTo(22, 2); g.lineTo(31, 31);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xff4766, 0.75);
      g.fillRect(2, 28, 28, 3);
      g.generateTexture("spike", 32, 32);
      g.destroy();
    },

    makeBoulder: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x545864, 1);
      g.fillCircle(18, 18, 17);
      g.fillStyle(0x858a96, 0.8);
      g.fillCircle(11, 10, 5);
      g.lineStyle(2, 0x262933, 1);
      g.strokeCircle(18, 18, 17);
      g.lineStyle(2, 0x343842, 0.8);
      g.beginPath();
      g.moveTo(4, 20); g.lineTo(16, 16); g.lineTo(28, 23);
      g.strokePath();
      g.generateTexture("boulder", 36, 36);
      g.destroy();
    },

    makeCrate: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x7a513a, 1);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(3, 0xd19a58, 1);
      g.strokeRect(3, 3, 26, 26);
      g.lineStyle(2, 0x3e241b, 1);
      g.beginPath();
      g.moveTo(5, 5); g.lineTo(27, 27);
      g.moveTo(27, 5); g.lineTo(5, 27);
      g.strokePath();
      g.generateTexture("crate", 32, 32);
      g.destroy();
    },

    makeBomb: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x151820, 1);
      g.fillCircle(12, 14, 10);
      g.lineStyle(2, 0x6d7480, 1);
      g.strokeCircle(12, 14, 10);
      g.lineStyle(3, 0xd39b52, 1);
      g.beginPath();
      g.moveTo(16, 6); g.lineTo(20, 1);
      g.strokePath();
      g.fillStyle(0xffd45e, 1);
      g.fillCircle(21, 1, 2);
      g.generateTexture("bomb", 24, 26);
      g.destroy();
    },

    makePot: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xb76d47, 1);
      g.fillRoundedRect(5, 7, 22, 23, 6);
      g.fillStyle(0xe09a69, 0.75);
      g.fillRect(3, 4, 26, 6);
      g.lineStyle(2, 0x663526, 1);
      g.strokeRoundedRect(5, 7, 22, 23, 6);
      g.lineStyle(1, 0xf5c08a, 0.6);
      g.lineBetween(9, 12, 22, 25);
      g.generateTexture("pot", 32, 32);
      g.destroy();
    },

    makeExit: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x05070e, 1);
      g.fillRoundedRect(4, 4, 40, 56, 8);
      g.lineStyle(3, 0x93f6ff, 0.9);
      g.strokeRoundedRect(5, 5, 38, 54, 8);
      g.fillStyle(0x93f6ff, 0.18);
      g.fillRoundedRect(12, 12, 24, 42, 6);
      g.generateTexture("exit", 48, 64);
      g.destroy();
    },

    makeAltar: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });

      // Peana / base de piedra
      g.fillStyle(0x4c4f5c, 1);
      g.fillRoundedRect(2, 43, 60, 11, 5);
      g.fillStyle(0x363a46, 1);
      g.fillRoundedRect(8, 39, 48, 6, 3);

      // Pilón central de la fuente (columna de piedra)
      g.fillStyle(0x6b7080, 1);
      g.fillRoundedRect(24, 22, 16, 17, 4);
      g.fillStyle(0x3f4350, 0.7);
      g.fillRoundedRect(27, 24, 4, 14, 2);

      // Cuenco superior (borde pétreo)
      g.fillStyle(0x757a8c, 1);
      g.fillEllipse(32, 32, 56, 16);
      g.fillStyle(0x424650, 1);
      g.fillEllipse(32, 35, 46, 11);
      g.fillStyle(0x5d6270, 1);
      g.fillEllipse(32, 32, 44, 9);

      // Estanque de agua del cuenco
      g.fillStyle(0x9ef9ff, 0.5);
      g.fillEllipse(32, 32, 38, 6);

      // Chorro de agua central
      g.fillStyle(0x0a0d13, 1);
      g.fillRect(29, 12, 6, 22);
      g.fillStyle(0xaefbff, 0.9);
      g.fillRoundedRect(30, 7, 4, 8, 2);
      g.fillCircle(32, 5, 4);
      g.fillStyle(0xd7feff, 0.55);
      g.fillCircle(32, 2.5, 2.2);

      g.generateTexture("altar", 64, 54);
      g.destroy();
    },

    makeSpore: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xc587ff, 0.9);
      g.fillCircle(14, 14, 12);
      g.fillStyle(0xfcfbff, 0.9);
      g.fillCircle(9, 10, 3);
      g.fillCircle(17, 7, 2);
      g.fillCircle(19, 16, 3);
      g.lineStyle(2, 0x612d85, 1);
      g.strokeCircle(14, 14, 12);
      g.generateTexture("spore", 28, 28);
      g.destroy();
    },

    makeLadder: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.lineStyle(4, 0xcba46d, 1);
      g.beginPath();
      g.moveTo(8, 0); g.lineTo(8, 32);
      g.moveTo(24, 0); g.lineTo(24, 32);
      for (let y = 5; y < 32; y += 9) {
        g.moveTo(8, y);
        g.lineTo(24, y);
      }
      g.strokePath();
      g.generateTexture("ladder", 32, 32);
      g.destroy();
    },

    makeWall: function(scene) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x47343a, 1);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(2, 0xff804a, 0.8);
      g.strokeRect(2, 2, 28, 28);
      g.lineStyle(1, 0xffc06a, 0.6);
      g.beginPath();
      g.moveTo(4, 20); g.lineTo(15, 8); g.lineTo(25, 24);
      g.strokePath();
      g.generateTexture("break-wall", 32, 32);
      g.destroy();
    },

    makeParticles: function(scene) {
      const dot = scene.make.graphics({ x: 0, y: 0, add: false });
      dot.fillStyle(0xffffff, 1);
      dot.fillCircle(3, 3, 3);
      dot.generateTexture("particle-white", 6, 6);
      dot.clear();
      dot.fillStyle(0xffb14a, 1);
      dot.fillCircle(4, 4, 4);
      dot.generateTexture("particle-fire", 8, 8);
      dot.clear();
      dot.fillStyle(0x9dfcff, 1);
      dot.fillCircle(3, 3, 3);
      dot.generateTexture("particle-blue", 6, 6);
      dot.clear();
      dot.fillStyle(0xb987ff, 1);
      dot.fillCircle(4, 4, 4);
      dot.generateTexture("particle-spore", 8, 8);
      dot.destroy();
    },

    // Generador procedimental de Enemigos / Modelos Simbólicos
    makeSymbolicEntity: function(scene, kind, accentColor) {
      const key = `symbolic-${kind}`;
      
      // Retorna rápido si la textura ya fue generada previamente
      if (scene.textures.exists(key)) return;

      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.lineStyle(2, accentColor, 1);
      g.fillStyle(accentColor, 0.22);
      
      if (kind === "creditor" || kind === "inflation") {
        g.fillRect(9, 10, 22, 22); g.strokeRect(9, 10, 22, 22);
        g.strokeCircle(20, 9, 6); g.lineBetween(13, 33, 10, 39); g.lineBetween(27, 33, 30, 39);
      } else if (kind === "doubt" || kind === "bias") {
        g.fillCircle(20, 21, 13); g.strokeCircle(20, 21, 13);
        g.lineBetween(12, 34, 9, 39); g.lineBetween(28, 34, 31, 39);
      } else if (kind === "impulse" || kind === "guilt") {
        g.fillTriangle(5, 34, 17, 5, 35, 25); g.strokeTriangle(5, 34, 17, 5, 35, 25);
      } else {
        g.fillRect(10, 4, 20, 34); g.strokeRect(10, 4, 20, 34);
        g.strokeCircle(20, 20, 17);
      }
      
      g.fillStyle(0xffffff, 1); 
      g.fillRect(17, 17, 4, 4); 
      g.fillRect(25, 17, 3, 4);
      
      g.generateTexture(key, 40, 42); 
      g.destroy();
    }
  };
})();