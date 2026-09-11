// SymbolicEntity - Entidades simbólicas (enemigos) - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { TILE } from "../core/constantes.js";
import { clamp, rectsOverlap } from "../core/utils.js";
import { playerMoveSpeed } from "../core/guardado.js";

export class SymbolicEntity {
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