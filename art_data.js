window.ArtData = (() => {
  "use strict";

  return {
    // Función orquestadora para cargar todos los sprites estáticos al inicio
    generateBootTextures: function(scene) {
      this.makeTile(scene, "tile-desert", [0x9c6b3f, 0xd7a24d, 0x5a3328, 0xffcf73]);
      this.makeTile(scene, "tile-jungle", [0x214d31, 0x4f9b55, 0x112619, 0x8af0b0]);
      this.makeTile(scene, "tile-volcano", [0x3f1e24, 0x7a3330, 0x160a0b, 0xff7438]);
      this.makeTile(scene, "tile-void", [0xb8b8c6, 0xf6f3e7, 0x383a47, 0x7df7ff]);
      
      this.makePlayer(scene, "player", {}); // Sprite base sin accesorios

      // Variantes de pose del jugador (sistema de animación procedural).
      // Todas comparten el MISMO tamaño de lienzo (32x46) para no romper el body físico.
      const PLAYER_POSES = [
        "idle-0", "idle-1",
        "run-0", "run-1", "run-2", "run-3",
        "jump", "fall", "dash", "land", "hurt"
      ];
      for (const p of PLAYER_POSES) {
        this.generateCharacterFrame(scene, `player-${p}`, p, {});
      }

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

    // Generador dinámico de jugador con soporte de capas (Composite Sprite).
    // Delega en generateCharacterFrame con la pose neutra para conservar
    // la textura "player" exactamente igual que antes.
    makePlayer: function(scene, key = "player", layers = {}) {
      this.generateCharacterFrame(scene, key, "idle-0", layers);
    },

    // Dibuja el cuerpo base del personaje (silueta blanca, ojos, visor cian,
    // contorno) reutilizando el diseño original pero parametrizable para cada pose.
    _drawCharacter: function(g, opts) {
      const o = opts || {};
      const dy = o.bodyDy || 0;
      g.fillStyle(0xf7fbff, 1);
      (o.legs || []).forEach((l) => g.fillRect(l.x, l.y, l.w, l.h));
      (o.arms || []).forEach((a) => g.fillRect(a.x, a.y, a.w, a.h));
      g.fillRoundedRect(8, 16 + dy, 16, 19, 3);
      g.fillRoundedRect(7, 2 + dy, 18, 14, 3);
      g.fillStyle(0x0a0d15, 1);
      g.fillRect(12, 8 + dy, 3, 3);
      g.fillRect(19, 8 + dy, 3, 3);
      g.fillStyle(0x98e8ff, 0.9);
      const vDy = o.visorDy != null ? o.visorDy : dy;
      g.fillRect(12, 24 + vDy, 10, 2);
      g.lineStyle(2, 0x8ba0ad, 1);
      g.strokeRoundedRect(7, 2 + dy, 18, 33, 3);
    },

    // Geometría específica de cada pose. Mantiene todas las poses en el mismo
    // lienzo (32x46) y cada una es reconocible como el mismo personaje.
    _drawPose: function(g, pose) {
      const leg = (x, y, h) => ({ x: x, y: y, w: 5, h: h });
      const arm = (x, y, h) => ({ x: x, y: y, w: 5, h: h });
      let opts;

      switch (pose) {
        case "idle-0": // Pie neutro (idéntico a la textura base original)
          opts = { legs: [leg(10, 34, 10), leg(18, 34, 10)], arms: [arm(4, 18, 12), arm(23, 18, 12)], bodyDy: 0 };
          break;

        case "idle-1": // Respiración sutil: el torso/cabeza suben 1px
          opts = { legs: [leg(10, 34, 10), leg(18, 34, 10)], arms: [arm(4, 17, 12), arm(23, 17, 12)], bodyDy: 1 };
          break;

        case "run-0": // Paso neutro, piernas juntas, brazos recogidos
          opts = { legs: [leg(11, 34, 10), leg(17, 34, 10)], arms: [arm(4, 18, 8), arm(23, 18, 8)], bodyDy: 0 };
          break;

        case "run-1": // Zancada: pierna izda atrás apoyada, derecha al frente; brazos en contra-paso
          opts = { legs: [leg(8, 34, 10), leg(20, 34, 10)], arms: [arm(6, 18, 8), arm(21, 18, 8)], bodyDy: 0 };
          break;

        case "run-2": // Paso neutro alargado, brazos a mitad de péndulo
          opts = { legs: [leg(10, 34, 10), leg(18, 34, 10)], arms: [arm(5, 18, 10), arm(22, 18, 10)], bodyDy: 0 };
          break;

        case "run-3": // Zancada opuesta: pierna izda al frente, derecha recogida (elevada)
          opts = { legs: [leg(20, 34, 10), leg(22, 31, 7)], arms: [arm(21, 18, 8), arm(6, 18, 8)], bodyDy: 0 };
          break;

        case "jump": // Salto: piernas recogidas, brazos arriba
          opts = { legs: [leg(9, 29, 8), leg(17, 29, 8)], arms: [arm(4, 12, 12), arm(23, 12, 12)], bodyDy: 0 };
          break;

        case "fall": // Caída: piernas colgando alargadas, brazos extendidos arriba
          opts = { legs: [leg(11, 32, 12), leg(17, 32, 12)], arms: [arm(5, 13, 12), arm(22, 13, 12)], bodyDy: 0 };
          break;

        case "dash": // Embate: cuerpo inclinado al frente, piernas juntas, brazos atrás + líneas de movimiento
          g.lineStyle(2, 0x98e8ff, 0.7);
          g.beginPath();
          g.moveTo(1, 15); g.lineTo(8, 15);
          g.moveTo(1, 23); g.lineTo(8, 23);
          g.moveTo(1, 31); g.lineTo(8, 31);
          g.strokePath();
          opts = { legs: [leg(6, 34, 10), leg(13, 34, 10)], arms: [arm(2, 17, 9), arm(2, 28, 9)], bodyDy: 0 };
          break;

        case "land": // Aterrizaje: cuclillas, torso compactado hacia abajo, piernas anchas
          opts = { legs: [leg(6, 37, 7), leg(19, 37, 7)], arms: [arm(4, 22, 9), arm(23, 22, 9)], bodyDy: 5 };
          break;

        case "hurt": // Retroceso: cuerpo echado hacia atrás, brazos arriba en sobresalto
          opts = { legs: [leg(11, 34, 10), leg(21, 34, 10)], arms: [arm(4, 12, 12), arm(24, 12, 12)], bodyDy: 0 };
          break;

        default: // Pose neutra por defecto
          opts = { legs: [leg(10, 34, 10), leg(18, 34, 10)], arms: [arm(4, 18, 12), arm(23, 18, 12)], bodyDy: 0 };
          break;
      }

      this._drawCharacter(g, opts);
    },

    // Generador general de un frame del personaje según "pose".
    // Todas las poses usan un lienzo del MISMO tamaño (32x46; 42x46 si layers.tool)
    // para no alterar el body físico del sprite.
    generateCharacterFrame: function(scene, key, pose, layers = {}) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });

      this._drawPose(g, pose);

      // Accesorios de cabeza / Sombreros (misma capa que el diseño original)
      if (layers.hat === "miner") {
        g.fillStyle(0xd39b52, 1);
        g.fillRect(6, 0, 20, 6);
        g.fillStyle(0x9dfcff, 1);
        g.fillRect(14, 2, 4, 3);
      }

      // Herramientas / Armas (misma capa que el diseño original)
      if (layers.tool === "pickaxe") {
        g.lineStyle(3, 0x5a3328, 1);
        g.beginPath(); g.moveTo(24, 20); g.lineTo(36, 8); g.strokePath();
        g.lineStyle(2, 0xc9d7df, 1);
        g.beginPath(); g.moveTo(28, 6); g.lineTo(40, 14); g.strokePath();
      }

      const textureWidth = layers.tool ? 42 : 32;
      g.generateTexture(key, textureWidth, 46);
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