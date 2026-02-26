import Phaser from 'phaser';
import { PLAYER_CONFIG, WEAPON_CONFIG, HIT_STOP_FRAMES, COLORS } from '../config';
import type { WeaponType } from '../config';
import { Pellet } from '../projectiles/Pellet';
import { LaserBolt } from '../projectiles/LaserBolt';
import { BeamProjectile } from '../projectiles/BeamProjectile';
import { HitStop } from '../effects/HitStop';
import { ScreenShake } from '../effects/ScreenShake';
import { DamagePopup } from '../ui/DamagePopup';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  weapon: WeaponType;
  tag: string;
  color: number;
  protected cooldownTimer = 0;
  protected cooldownMultiplier = 1.0; // Enemy が上書きしてリロード速度を変える
  protected hitStop: HitStop;
  protected screenShake: ScreenShake;
  protected pellets: Pellet[] = [];
  protected laserBolts: LaserBolt[] = [];
  protected beams: BeamProjectile[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    weapon: WeaponType,
    tag: string,
    color: number,
    hitStop: HitStop,
    screenShake: ScreenShake,
  ) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hp = PLAYER_CONFIG.maxHp;
    this.maxHp = PLAYER_CONFIG.maxHp;
    this.weapon = weapon;
    this.tag = tag;
    this.color = color;
    this.hitStop = hitStop;
    this.screenShake = screenShake;

    this.setTint(color);
    this.setDepth(20);
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // テクスチャサイズ = radius*2+4 なので、中心オフセット = (radius*2+4)/2 - radius = 2
    body.setCircle(PLAYER_CONFIG.radius, 2, 2);
  }

  get cooldownRatio(): number {
    const maxCd = WEAPON_CONFIG[this.weapon].cooldown;
    return Math.min(1, (maxCd - this.cooldownTimer) / maxCd);
  }

  moveWithVector(dx: number, dy: number) {
    const len = Math.sqrt(dx * dx + dy * dy);
    const speed = PLAYER_CONFIG.speed * (this.weapon === 'shotgun' ? 1.1 : 1.0);
    if (len > 0.01) {
      this.setVelocity((dx / len) * speed, (dy / len) * speed);
    } else {
      this.setVelocity(0, 0);
    }
  }

  fire(targetX: number, targetY: number, allProjectiles: { pellets: Pellet[]; lasers: LaserBolt[]; beams: BeamProjectile[] }) {
    if (this.cooldownTimer > 0) return;

    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.cooldownTimer = Math.max(1, Math.round(WEAPON_CONFIG[this.weapon].cooldown * this.cooldownMultiplier));

    if (this.weapon === 'shotgun') {
      this.fireShotgun(angle, allProjectiles.pellets);
    } else if (this.weapon === 'laser') {
      this.fireLaser(angle, allProjectiles.lasers);
    } else if (this.weapon === 'beam') {
      this.fireBeam(angle, allProjectiles.beams);
    }
  }

  private fireShotgun(baseAngle: number, pellets: Pellet[]) {
    const cfg = WEAPON_CONFIG.shotgun;
    for (let i = 0; i < cfg.pellets; i++) {
      const spread = (Math.random() - 0.5) * cfg.spread;
      const a = baseAngle + spread;
      const p = new Pellet(this.scene, this.x, this.y, Math.cos(a) * cfg.speed, Math.sin(a) * cfg.speed, cfg.damage, this.tag);
      pellets.push(p);
    }
  }

  private fireLaser(angle: number, lasers: LaserBolt[]) {
    const cfg = WEAPON_CONFIG.laser;
    const bolt = new LaserBolt(this.scene, this.x, this.y, angle, cfg.speed, cfg.damage, this.tag);
    lasers.push(bolt);
  }

  private fireBeam(angle: number, beams: BeamProjectile[]) {
    const cfg = WEAPON_CONFIG.beam;
    const beam = new BeamProjectile(this.scene, this.x, this.y, angle, cfg.speed, cfg.width, cfg.height, cfg.damage, cfg.maxHits, this.tag);
    beams.push(beam);
  }

  takeDamage(amount: number, weapon: WeaponType) {
    this.hp = Math.max(0, this.hp - amount);
    DamagePopup.show(this.scene, this.x, this.y - 30, amount);

    if (this.hp <= 0) {
      this.hitStop.trigger(HIT_STOP_FRAMES.ko, [this]);
      this.screenShake.shake(0.015, 400);
    } else {
      this.hitStop.trigger(HIT_STOP_FRAMES[weapon], [this]);
      this.screenShake.shake(0.005, 80);
    }
  }

  update(dt: number) {
    if (this.cooldownTimer > 0) this.cooldownTimer--;

    // Update manual projectiles
    for (let i = this.laserBolts.length - 1; i >= 0; i--) {
      this.laserBolts[i].update(dt);
      if (this.laserBolts[i].dead) this.laserBolts.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].update(dt);
      if (this.beams[i].dead) this.beams.splice(i, 1);
    }
  }

  get isAlive() { return this.hp > 0; }

  getPellets() { return this.pellets; }
  getLasers() { return this.laserBolts; }
  getBeams() { return this.beams; }
}
