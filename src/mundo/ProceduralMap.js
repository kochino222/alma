// ProceduralMap - Generador de niveles procedurales - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { TILE, LEVELS, ROUTE_MAIN, ROUTE_DRAMATIC, TOTAL_STAGES, BASE_GRAVITY, JUMP_SPEED, SACRIFICE_JUMP_SPEED } from "../core/constantes.js";
import { clamp, rectsOverlap, makeRect, hashSeed, mulberry32, randInt, choice, screenW, screenH } from "../core/utils.js";
import { gravityMultiplier, effectiveCoinBurden, playerMoveSpeed, loadMeta, saveMeta, runFragmentBank, lawActive, lawUnlocked } from "../core/guardado.js";

export class ProceduralMap {
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
    const bestNormalJump = JUMP_SPEED ** 2 / (2 * BASE_GRAVITY * gravityMultiplier({ gravityRelief: 1 }));
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