import Phaser from 'phaser';

const LASER_SPREAD = Math.PI / 6;
const LASER_DRAW_LENGTH = 160;

export interface LaserSpawn {
  x: number;
  y: number;
  angle: number;
  generation: number;
}

export class LaserBolt {
  scene: Phaser.Scene;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  damage: number;
  ownerTag: string;
  radius = 6;
  generation: number;
  private graphics: Phaser.GameObjects.Graphics;
  private lifespan: number;
  dead = false;
  hasHit = false;
  /** 壁反射時にここへ子レーザーの情報を追記。呼び出し側が処理する */
  pendingSpawn: LaserSpawn[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    angle: number, speed: number,
    damage: number, ownerTag: string,
    generation = 0
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.ownerTag = ownerTag;
    this.generation = generation;
    this.lifespan = 100;

    this.graphics = scene.add.graphics().setDepth(10);
    this.draw();
  }

  private draw() {
    this.graphics.clear();
    const alpha = this.generation === 0 ? 1 : 0.75;
    // Glow
    this.graphics.fillStyle(0x44ffff, 0.2 * alpha);
    this.graphics.fillCircle(this.x, this.y, 16);
    // Tail line
    const tailX = this.x - Math.cos(this.angle) * LASER_DRAW_LENGTH;
    const tailY = this.y - Math.sin(this.angle) * LASER_DRAW_LENGTH;
    this.graphics.lineStyle(4, 0x44ffff, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(this.x, this.y);
    this.graphics.lineTo(tailX, tailY);
    this.graphics.strokePath();
    // Core
    this.graphics.fillStyle(0xaaffff, alpha);
    this.graphics.fillCircle(this.x, this.y, 5);
  }

  update(dt: number) {
    if (this.dead) return;

    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;
    const { width, height } = this.scene.scale;

    let hitWall = false;
    let clampedX = nextX;
    let clampedY = nextY;
    let horizontal = false; // true = 左右壁, false = 上下壁

    if (nextX > width) {
      clampedX = width; hitWall = true; horizontal = true;
    } else if (nextX < 0) {
      clampedX = 0; hitWall = true; horizontal = true;
    }
    if (nextY > height) {
      clampedY = height; hitWall = true; horizontal = false;
    } else if (nextY < 0) {
      clampedY = 0; hitWall = true; horizontal = false;
    }

    if (hitWall) {
      this.dead = true;
      this.graphics.destroy();

      // 世代0のみ反射・3分裂
      if (this.generation < 1) {
        const reflectAngle = horizontal
          ? Math.PI - this.angle   // 左右壁: x成分反転
          : -this.angle;           // 上下壁: y成分反転

        this.pendingSpawn.push(
          { x: clampedX, y: clampedY, angle: reflectAngle,               generation: 1 },
          { x: clampedX, y: clampedY, angle: reflectAngle + LASER_SPREAD, generation: 1 },
          { x: clampedX, y: clampedY, angle: reflectAngle - LASER_SPREAD, generation: 1 },
        );
      }
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.lifespan--;
    if (this.lifespan <= 0) {
      this.destroy();
      return;
    }
    this.draw();
  }

  /** 線分(tail→head) vs 円のヒット判定（元コードと同ロジック） */
  hits(cx: number, cy: number, cr: number): boolean {
    if (this.hasHit) return false;
    const tailX = this.x - Math.cos(this.angle) * LASER_DRAW_LENGTH;
    const tailY = this.y - Math.sin(this.angle) * LASER_DRAW_LENGTH;
    const dx = this.x - tailX;
    const dy = this.y - tailY;
    const lenSq = dx * dx + dy * dy;
    const t = ((cx - tailX) * dx + (cy - tailY) * dy) / lenSq;
    const ct = Math.max(0, Math.min(1, t));
    const closestX = tailX + ct * dx;
    const closestY = tailY + ct * dy;
    const distSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
    return distSq < (cr + 5) * (cr + 5);
  }

  destroy() {
    this.dead = true;
    if (this.graphics.scene) this.graphics.destroy();
  }
}
