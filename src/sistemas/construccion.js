// Sistema de construccion del mundo - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { TILE, TOTAL_STAGES } from "../core/constantes.js";
import { screenW, screenH } from "../core/utils.js";
import { SymbolicEntity } from "../entidades/SymbolicEntity.js";

const Between = Phaser.Math.Between;

export function configureCamera(scene) {
  const sw = screenW(scene);
  const sh = screenH(scene);
  const portrait = sh > sw;
  scene.cameras.main.deadzone = new Phaser.Geom.Rectangle(0, 0, Math.min(120, sw * 0.25), portrait ? 100 : 80);
  scene.cameras.main.setFollowOffset(0, portrait ? -40 : -30);
  // Keep the existing scroll on rotation; following converges without recentering.
  scene.cameraPortrait = portrait;
  scene.cameraSettleMs = 700;
}

export function createBackground(scene) {
  const width = 78 * TILE;
  const height = 72 * TILE;
  const g = scene.add.graphics().setScrollFactor(0.25).setDepth(-30);
  g.fillStyle(scene.levelInfo.bgTop, 1);
  g.fillRect(-200, -100, width + 400, height + 200);
  g.fillStyle(scene.levelInfo.bgMid, 0.68);
  g.fillRect(-200, height * 0.24, width + 400, height * 0.38);
  g.fillStyle(scene.levelInfo.bgLow, 0.32);
  g.fillRect(-200, height * 0.58, width + 400, height * 0.52);

  if (scene.levelInfo.key === "desert") {
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

  if (scene.levelInfo.key === "jungle") {
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

  if (scene.levelInfo.key === "volcano") {
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

  if (scene.levelInfo.key === "void" && scene.stageNumber === TOTAL_STAGES) {
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

export function createWorld(scene) {
  const map = scene.make.tilemap({ data: scene.generated.data, tileWidth: TILE, tileHeight: TILE });
  const tileset = map.addTilesetImage(scene.levelInfo.tile, scene.levelInfo.tile, TILE, TILE, 0, 0, 1);
  scene.terrain = map.createLayer(0, tileset, 0, 0);
  scene.terrain.setCollision(1);
  scene.terrain.setDepth(1);
  scene.map = map;
  scene.veinMarks = new Map();
  for (const vein of scene.generated.veinCells) {
    const mark = scene.add.graphics().setDepth(2);
    const x = vein.tx * TILE, y = vein.ty * TILE;
    mark.lineStyle(2, scene.levelInfo.accent, 0.72);
    mark.beginPath(); mark.moveTo(x + 5, y + 3); mark.lineTo(x + 17, y + 13);
    mark.lineTo(x + 10, y + 21); mark.lineTo(x + 27, y + 29); mark.strokePath();
    scene.veinMarks.set(`${vein.tx},${vein.ty}`, mark);
  }
  scene.routeGraphics = scene.add.graphics().setDepth(3);
  scene.routeGraphics.lineStyle(2, 0x8af0b0, 0.65);
  for (const p of scene.generated.path) {
    scene.routeGraphics.lineBetween(p.rect.x + 4, p.y + 2, p.rect.x + p.rect.width - 4, p.y + 2);
    if (p.exitDirection) {
      const x = p.departureX - p.exitDirection * 24;
      scene.routeGraphics.lineBetween(x - p.exitDirection * 15, p.y - 15, x, p.y - 15);
      scene.routeGraphics.lineBetween(x, p.y - 15, x - p.exitDirection * 6, p.y - 21);
      scene.routeGraphics.lineBetween(x, p.y - 15, x - p.exitDirection * 6, p.y - 9);
    }
  }
  scene.dramaticLabels = [];
  for (const route of scene.generated.dramaticRoutes) {
    scene.routeGraphics.lineStyle(2, 0xffb14a, 0.65);
    scene.routeGraphics.lineBetween(route.launchX, route.floorY - 12, route.launchX, route.floorY - 62);
    scene.routeGraphics.lineBetween(route.launchX, route.floorY - 62, route.launchX - 8, route.floorY - 52);
    scene.routeGraphics.lineBetween(route.launchX, route.floorY - 62, route.launchX + 8, route.floorY - 52);
    const label = scene.add.text(route.x, route.floorY - 90, "RUTA DRAMÁTICA\nOFRENDA", {
      fontFamily: "monospace", fontSize: "11px", color: "#ffcf83", align: "center",
      backgroundColor: "#171015", padding: { x: 5, y: 4 }
    }).setOrigin(0.5).setDepth(4);
    scene.dramaticLabels.push({ route, label });
  }

  scene.slopeGraphics = scene.add.graphics().setDepth(0);
  scene.slopeGraphics.fillStyle(scene.levelInfo.accent, 0.18);
  scene.slopeGraphics.lineStyle(2, scene.levelInfo.accent, 0.28);
  for (const slope of scene.generated.slopes) {
    scene.slopeGraphics.beginPath();
    if (slope.dir > 0) {
      scene.slopeGraphics.moveTo(slope.x, slope.y + slope.height);
      scene.slopeGraphics.lineTo(slope.x + slope.width, slope.y);
      scene.slopeGraphics.lineTo(slope.x + slope.width, slope.y + slope.height);
    } else {
      scene.slopeGraphics.moveTo(slope.x, slope.y);
      scene.slopeGraphics.lineTo(slope.x + slope.width, slope.y + slope.height);
      scene.slopeGraphics.lineTo(slope.x, slope.y + slope.height);
    }
    scene.slopeGraphics.closePath();
    scene.slopeGraphics.fillPath();
    scene.slopeGraphics.strokePath();
  }

  scene.ladderZones = [];
  scene.ladderGroup = scene.add.group();
  for (const ladder of scene.generated.ladders) {
    for (let y = ladder.y; y < ladder.y + ladder.height; y += TILE) {
      const tile = scene.add.image(ladder.x + 16, y + 16, "ladder").setDepth(0);
      scene.ladderGroup.add(tile);
    }
    const zone = scene.add.zone(ladder.x + 16, ladder.y + ladder.height / 2, TILE, ladder.height);
    scene.physics.add.existing(zone, true);
    scene.ladderZones.push(zone);
  }
}

export function createEntities(scene) {
  scene.coinsGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
  for (const c of scene.generated.coins) {
    const coin = scene.coinsGroup.create(c.x, c.y, "coin");
    coin.body.setCircle(10, 2, 2);
    coin.phase = scene.rng() * Math.PI * 2;
  }

  scene.fragmentsGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
  for (const f of scene.generated.fragments) {
    const shard = scene.fragmentsGroup.create(f.x, f.y, "fragment");
    shard.body.setSize(18, 22).setOffset(3, 4);
    shard.phase = scene.rng() * Math.PI * 2;
    shard.dramaticId = f.dramaticId || null;
  }

  scene.spikesGroup = scene.physics.add.staticGroup();
  for (const s of scene.generated.spikes) scene.spikesGroup.create(s.x, s.y + 7, "spike").refreshBody();

  scene.cratesGroup = scene.physics.add.group({
    bounceX: 0.02,
    bounceY: 0,
    dragX: 780,
    maxVelocityX: 140
  });
  for (const c of scene.generated.crates) {
    const crate = scene.cratesGroup.create(c.x, c.y, "crate");
    crate.body.setSize(30, 30);
    crate.pickupType = "crate";
  }

  scene.bouldersGroup = scene.physics.add.group({ bounceX: 0.25, bounceY: 0.2, dragX: 12 });
  for (const b of scene.generated.boulders) {
    const rock = scene.bouldersGroup.create(b.x, b.y, "boulder");
    rock.body.setCircle(17, 1, 1);
    rock.body.allowGravity = false;
    rock.body.setMaxVelocity(240, 420);
    rock.sleepingStone = true;
    rock.pickupType = "boulder";
  }

  scene.altarsGroup = scene.physics.add.staticGroup();
  for (const a of scene.generated.altars) {
    const altar = scene.altarsGroup.create(a.x, a.y, "altar").refreshBody();
    altar.body.setSize(62, 50).setOffset(1, 2);
  }

  scene.sporesGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
  for (const s of scene.generated.spores) {
    const spore = scene.sporesGroup.create(s.x, s.y, "spore");
    spore.body.setCircle(12, 2, 2);
    spore.phase = scene.rng() * Math.PI * 2;
  }

  scene.lavaZones = [];
  scene.lavaGraphics = scene.add.graphics().setDepth(2);
  for (const lava of scene.generated.lava) {
    const zone = scene.add.zone(lava.x + lava.width / 2, lava.y + lava.height / 2, lava.width, lava.height);
    scene.physics.add.existing(zone, true);
    scene.lavaZones.push(zone);
  }
  scene.drawLava(0);

  scene.destructiblesGroup = scene.physics.add.staticGroup();
  for (const d of scene.generated.destructibles) {
    const wall = scene.destructiblesGroup.create(d.x, d.y, "break-wall").refreshBody();
    wall.hp = 1;
    wall.dramaticId = d.dramaticId || null;
  }

  scene.exitDoor = scene.physics.add.staticImage(scene.generated.exit.x, scene.generated.exit.y + 6, "exit");
  scene.exitDoor.refreshBody();

  scene.bombsGroup = scene.physics.add.group({ bounceX: 0.42, bounceY: 0.32, dragX: 180 });
  scene.potsGroup = scene.physics.add.group({ bounceX: 0.28, bounceY: 0.18, dragX: 420 });
  for (const p of scene.generated.pots) {
    const pot = scene.potsGroup.create(p.x, p.y, "pot");
    pot.body.setSize(26, 29).setOffset(3, 2);
    pot.pickupType = "pot";
  }

  if (scene.generated.god) scene.createGod();
  scene.createSpecialSites();
}

export function createSpecialSites(scene) {
  scene.specialSites = [];
  for (const room of scene.generated.specialRooms) {
    const g = scene.add.graphics().setDepth(4);
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
    const label = scene.add.text(room.x, room.y + 35, room.type === "barter" ? "ALTAR DEL TRUEQUE" : "POZO DEL RIESGO", {
      fontFamily: "monospace", fontSize: "11px", color: `#${color.toString(16).padStart(6, "0")}`, align: "center"
    }).setOrigin(0.5).setDepth(5);
    scene.specialSites.push({ room, graphics: g, label });
  }
  const merchant = scene.generated.merchant;
  if (!merchant) return;
  const caveW = merchant.widthTiles * TILE, caveH = merchant.heightTiles * TILE;
  scene.merchantGraphics = scene.add.graphics().setDepth(6);
  scene.merchantGraphics.fillStyle(0x020308, 0.96).fillRect(merchant.x - caveW / 2, merchant.y - caveH + 28, caveW, caveH);
  const biomeArch = { desert: 0xd7a85c, jungle: 0x62c98e, volcano: 0xe76842, void: 0xc9c5da }[scene.levelInfo.key];
  scene.merchantGraphics.lineStyle(4, biomeArch, 0.8).beginPath();
  scene.merchantGraphics.arc(merchant.x, merchant.y - caveH + 28 + caveW / 2, caveW / 2 - 4, Math.PI, Math.PI * 2);
  scene.merchantGraphics.lineTo(merchant.x + caveW / 2 - 4, merchant.y + 28);
  scene.merchantGraphics.moveTo(merchant.x - caveW / 2 + 4, merchant.y + 28);
  scene.merchantGraphics.lineTo(merchant.x - caveW / 2 + 4, merchant.y - caveH / 2);
  scene.merchantGraphics.strokePath();
  scene.merchantGraphics.lineStyle(2, biomeArch, 0.35);
  for (let i = -2; i <= 2; i += 1) scene.merchantGraphics.strokeCircle(merchant.x + i * 32, merchant.y - 54, 17);

  // --- Evolución narrativa del Mercader según el mundo actual ---
  const floorY = merchant.y + 30;            // nivel del suelo de la cueva
  const machineW = 58, machineH = 76;        // tamaño de la máquina expendedora
  const cx = merchant.x;
  const W = scene.worldNumber;

  if (W === 1 || W === 2) {
    // Máquina expendedora rectangular: fría, puramente transaccional
    scene.merchantGraphics.fillStyle(0x20242c, 1);
    scene.merchantGraphics.fillRoundedRect(cx - machineW / 2, floorY - machineH, machineW, machineH, 5);
    scene.merchantGraphics.lineStyle(2, 0x9dfcff, 0.85);
    scene.merchantGraphics.strokeRoundedRect(cx - machineW / 2, floorY - machineH, machineW, machineH, 5);
    // Vitrina con mercancías
    scene.merchantGraphics.fillStyle(0x0b1119, 0.92);
    scene.merchantGraphics.fillRoundedRect(cx - machineW / 2 + 6, floorY - machineH + 6, machineW - 12, 30, 3);
    scene.merchantGraphics.fillStyle(0x9dfcff, 0.16);
    scene.merchantGraphics.fillRect(cx - machineW / 2 + 8, floorY - machineH + 8, machineW - 16, 26);
    // Mesa selector / botones luminosos
    const btnColors = [0xff596e, 0x75f1b4, 0x9ef9ff, 0xffb14a];
    scene.merchantGraphics.fillStyle(0x10141d, 1);
    scene.merchantGraphics.fillRect(cx - machineW / 2 + 6, floorY - machineH + 41, machineW - 12, 18);
    for (let i = 0; i < 4; i += 1) {
      scene.merchantGraphics.fillStyle(btnColors[i], 0.9);
      scene.merchantGraphics.fillCircle(cx - machineW / 2 + 14 + i * 12, floorY - machineH + 50, 3);
    }
    // Rejilla + ranura de entrega inferior
    scene.merchantGraphics.fillStyle(0x151b26, 1);
    scene.merchantGraphics.fillRect(cx - machineW / 2 + 10, floorY - 22, machineW - 20, 12);
    scene.merchantGraphics.fillStyle(0x0c0f16, 1);
    scene.merchantGraphics.fillRoundedRect(cx - 18, floorY - 7, 36, 7, 2);
    scene.merchantGraphics.lineStyle(1, 0xbfd9e6, 0.35);
    scene.merchantGraphics.strokeRect(cx - 18, floorY - 7, 36, 7);
  } else if (W === 3) {
    // Máquina rota / ladeada + entidad reparándola + chispas
    const tilt = 0.17;
    scene.merchantGraphics.save();
    scene.merchantGraphics.translateCanvas(cx, floorY);
    scene.merchantGraphics.rotateCanvas(tilt);
    scene.merchantGraphics.fillStyle(0x2a2f3a, 1);
    scene.merchantGraphics.fillRoundedRect(-machineW / 2, -machineH, machineW, machineH, 5);
    scene.merchantGraphics.lineStyle(2, 0x5d6470, 0.9);
    scene.merchantGraphics.strokeRoundedRect(-machineW / 2, -machineH, machineW, machineH, 5);
    // Vitrina agrietada
    scene.merchantGraphics.fillStyle(0x0b1119, 0.92);
    scene.merchantGraphics.fillRoundedRect(-machineW / 2 + 6, -machineH + 6, machineW - 12, 30, 3);
    scene.merchantGraphics.lineStyle(1, 0x9dfcff, 0.55);
    scene.merchantGraphics.beginPath();
    scene.merchantGraphics.moveTo(0, -machineH + 10);
    scene.merchantGraphics.lineTo(-12, -machineH + 24);
    scene.merchantGraphics.lineTo(6, -machineH + 34);
    scene.merchantGraphics.strokePath();
    // Botones apagados / en cortocircuito
    for (let i = 0; i < 4; i += 1) {
      scene.merchantGraphics.fillStyle(i % 2 ? 0xff596e : 0x3a4150, 0.6);
      scene.merchantGraphics.fillCircle(-machineW / 2 + 14 + i * 12, -machineH + 50, 3);
    }
    scene.merchantGraphics.restore();
    // Silueta de la entidad al lado, "arreglando" la máquina
    const sideX = cx + machineW / 2 + 18, sideY = floorY - 4;
    scene.merchantGraphics.fillStyle(0x232a33, 0.92);
    scene.merchantGraphics.fillRoundedRect(sideX - 9, sideY - 54, 17, 32, 6);   // torso
    scene.merchantGraphics.fillCircle(sideX, sideY - 62, 9);                      // cabeza
    scene.merchantGraphics.fillRect(sideX + 4, sideY - 46, 28, 4);                // brazo hacia la máquina
    scene.merchantGraphics.fillRect(sideX - 6, sideY - 20, 3, 22);                // piernas
    scene.merchantGraphics.fillRect(sideX + 4, sideY - 20, 3, 22);
    scene.merchantGraphics.lineStyle(2, 0xffb14a, 0.9);
    scene.merchantGraphics.strokeCircle(sideX, sideY - 62, 9);
    // Chispas (particle-fire) saliendo del panel abierto
    scene.merchantSparks = scene.add.particles(cx + machineW / 4, floorY - machineH + 22, "particle-fire", {
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
    scene.merchantGraphics.fillStyle(0x3a4150, 1);
    scene.merchantGraphics.fillRoundedRect(cx - machineW / 2 - 4, floorY - 8, machineW + 8, 8, 3); // plinto
    scene.merchantGraphics.lineStyle(2, 0x9ef9ff, 1);
    scene.merchantGraphics.fillStyle(0x9ef9ff, 0.16);
    scene.merchantGraphics.fillRoundedRect(cx - 13, floorY - 66, 26, 34, 6);
    scene.merchantGraphics.strokeRoundedRect(cx - 13, floorY - 66, 26, 34, 6);
    scene.merchantGraphics.fillCircle(cx, floorY - 76, 12);
    scene.merchantGraphics.strokeCircle(cx, floorY - 76, 12);
    // Brazos de la entidad
    scene.merchantGraphics.lineBetween(cx - 10, floorY - 34, cx - 14, floorY - 6);
    scene.merchantGraphics.lineBetween(cx + 10, floorY - 34, cx + 14, floorY - 6);
    // Halo/emblema del linaje
    scene.merchantGraphics.lineStyle(2, 0xffb14a, 0.9);
    scene.merchantGraphics.strokeCircle(cx, floorY - 76, 15);
    // Caja dispensadora abierta a sus pies con mercancías
    scene.merchantGraphics.fillStyle(0x20242c, 1);
    scene.merchantGraphics.fillRect(cx - 30, floorY - 12, 24, 12);
    scene.merchantGraphics.fillStyle(0xffb14a, 1).fillCircle(cx - 24, floorY - 17, 3);
    scene.merchantGraphics.fillStyle(0x75f1b4, 1).fillCircle(cx - 17, floorY - 17, 3);
    scene.merchantGraphics.fillStyle(0x9ef9ff, 1).fillCircle(cx - 10, floorY - 17, 3);
  }
  scene.merchantLabel = scene.add.text(merchant.x, merchant.y + 39, "MERCADER TURBIO", {
    fontFamily: "monospace", fontSize: "11px", color: "#9dfcff"
  }).setOrigin(0.5).setDepth(7);
}

export function createGod(scene) {
  const g = scene.add.graphics().setDepth(0);
  const god = scene.generated.god;
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
  scene.godZone = scene.add.zone(god.zone.x + god.zone.width / 2, god.zone.y + god.zone.height / 2, god.zone.width, god.zone.height);
  scene.physics.add.existing(scene.godZone, true);
}

export function spawnDebtCreditor(scene) {
  if ((scene.symbolicEntities || []).some(entity => entity.kind === "creditor")) return;
  const p = scene.generated.path[Math.min(4, scene.generated.path.length - 1)];
  const entity = new SymbolicEntity(scene, { kind: "creditor", x: p.centerX, y: p.y - 19,
    left: p.rect.x + 30, right: p.rect.x + p.rect.width - 30,
    phase: scene.rng() * Math.PI * 2, direction: -1 });
  entity.debtCollector = true;
  scene.symbolicEntities.push(entity);
  scene.blue.explode(18, entity.x, entity.y);
}

export function createPlayer(scene) {
  scene.player = scene.physics.add.sprite(scene.generated.spawn.x, scene.generated.spawn.y, "player");
  scene.player.setDepth(8);
  scene.player.body.setSize(20, 35).setOffset(6, 10);
  scene.player.body.setCollideWorldBounds(true);
  scene.player.body.setMaxVelocity(300, 620);
  scene.player.body.setDragX(0);
  scene.player.facing = 1;
  scene.player.wasGrounded = true;

  // === RIG ESQUELÉTICO (Paper-Doll) — ETAPA 2 ===
  // El sprite físico pasa a ser un collider Arcade invisible. Toda la fisica
  // (setSize/setOffset/setCollideWorldBounds, etc.) se conserva intacta arriba;
  // la representación visual ahora la lleva el contenedor scene.playerRig.
  scene.player.setVisible(false);

  // Contenedor visual anclado a la posicion del collider. Se mueve con el
  // jugador en handleMovement() (ETAPA 2: solo pose neutra, aun sin animar).
  scene.playerRig = scene.add.container(scene.player.x, scene.player.y).setDepth(8);

  // Piezas del cuerpo. Los miembros pivotan desde el hombro/cadera (en lugar del
  // centro) gracias a setOrigin(0.5, 0); sus coordenadas x/y son relativas al
  // contenedor y arman una figura humanoide en pose neutra.
  // Orden estricto (atras -> adelante):
  //   backArm -> backLeg -> torso -> head -> frontLeg -> frontArm
  const rigBackArm = scene.add.sprite(-9, -8, "player-limb-back").setOrigin(0.5, 0);
  const rigBackLeg = scene.add.sprite(-4, 7, "player-limb-back").setOrigin(0.5, 0);
  const rigTorso = scene.add.sprite(0, -1, "player-torso");
  const rigHead = scene.add.sprite(0, -14, "player-head");
  const rigFrontLeg = scene.add.sprite(4, 7, "player-limb").setOrigin(0.5, 0);
  const rigFrontArm = scene.add.sprite(9, -8, "player-limb").setOrigin(0.5, 0);

  // Referencias guardadas para animar (trigonometria) en la ETAPA 3.
  scene.rigParts = {
    head: rigHead,
    torso: rigTorso,
    backArm: rigBackArm,
    backLeg: rigBackLeg,
    frontArm: rigFrontArm,
    frontLeg: rigFrontLeg
  };
  scene.playerRig.add([rigBackArm, rigBackLeg, rigTorso, rigHead, rigFrontLeg, rigFrontArm]);
}

export function createEffects(scene) {
  scene.dust = scene.add.particles(0, 0, "particle-white", {
    lifespan: { min: 220, max: 430 },
    speed: { min: 20, max: 115 },
    scale: { start: 0.9, end: 0 },
    alpha: { start: 0.45, end: 0 },
    emitting: false
  }).setDepth(20);
  scene.spark = scene.add.particles(0, 0, "particle-fire", {
    lifespan: { min: 240, max: 520 },
    speed: { min: 35, max: 190 },
    gravityY: 320,
    scale: { start: 0.9, end: 0 },
    alpha: { start: 0.9, end: 0 },
    emitting: false
  }).setDepth(20);
  scene.blue = scene.add.particles(0, 0, "particle-blue", {
    lifespan: { min: 360, max: 760 },
    speed: { min: 25, max: 130 },
    scale: { start: 1.1, end: 0 },
    alpha: { start: 0.85, end: 0 },
    emitting: false
  }).setDepth(20);
  // Fuente de salud: flujo sutil de motas que ascienden desde el cuenco
  scene.altarWater = scene.add.particles(0, 0, "particle-blue", {
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
  scene.sporeMist = scene.add.particles(0, 0, "particle-spore", {
    lifespan: { min: 550, max: 1150 },
    speed: { min: 8, max: 48 },
    gravityY: -25,
    scale: { start: 0.9, end: 0 },
    alpha: { start: 0.42, end: 0 },
    emitting: false
  }).setDepth(20);
  scene.footDust = scene.add.particles(0, 0, "particle-white", {
    lifespan: { min: 150, max: 300 },
    speedX: { min: -20, max: 20 }, speedY: { min: -18, max: -7 },
    gravityY: 35, tint: scene.levelInfo.accent,
    scale: { start: 0.45, end: 0 }, alpha: { start: 0.36, end: 0 },
    maxParticles: 24, emitting: false
  }).setDepth(7);
  scene.channelRing = scene.add.graphics().setDepth(21);
  scene.portableHalo = scene.add.graphics().setDepth(18);
}
