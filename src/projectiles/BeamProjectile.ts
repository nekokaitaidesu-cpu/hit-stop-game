import Phaser from 'phaser';

export class BeamProjectile {
  scene: Phaser.Scene;
  x: number;
  y: number;
  angle: number; // radians
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  ownerTag: string;
  private graphics: Phaser.GameObjects.Graphics;
  private lifespan: number;
  dead = false;
  hitTargets: Set<object> = new Set();
  maxHits: number;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    angle: number, speed: number,
    width: number, height: number,
    damage: number, maxHits: number,
    ownerTag: string
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.width = width;
    this.height = height;
    this.damage = damage;
    this.maxHits = maxHits;
    this.ownerTag = ownerTag;
    this.lifespan = 120;

    this.graphics = scene.add.graphics().setDepth(10);
    this.draw();
  }

  private draw() {
    this.graphics.clear();
    // Draw oriented rectangle
    const hw = this.width / 2;
    const hh = this.height / 2;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    // Glow
    this.graphics.fillStyle(0xff44ff, 0.25);
    this.drawOBB(cos, sin, hw + 20, hh + 20);

    // Main beam
    this.graphics.fillStyle(0xff44ff, 0.8);
    this.drawOBB(cos, sin, hw, hh);

    // Core highlight
    this.graphics.fillStyle(0xffffff, 0.6);
    this.drawOBB(cos, sin, hw * 0.5, hh * 0.3);
  }

  private drawOBB(cos: number, sin: number, hw: number, hh: number) {
    const corners = [
      { x: this.x + cos * hw - sin * hh, y: this.y + sin * hw + cos * hh },
      { x: this.x - cos * hw - sin * hh, y: this.y - sin * hw + cos * hh },
      { x: this.x - cos * hw + sin * hh, y: this.y - sin * hw - cos * hh },
      { x: this.x + cos * hw + sin * hh, y: this.y + sin * hw - cos * hh },
    ];
    this.graphics.beginPath();
    this.graphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) this.graphics.lineTo(corners[i].x, corners[i].y);
    this.graphics.closePath();
    this.graphics.fillPath();
  }

  // OBB vs circle collision using local coordinate transform
  hits(cx: number, cy: number, cr: number): boolean {
    const dx = cx - this.x;
    const dy = cy - this.y;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    // Local coords
    const lx = Math.abs(dx * cos + dy * sin);
    const ly = Math.abs(-dx * sin + dy * cos);

    const hw = this.width / 2;
    const hh = this.height / 2;

    // Nearest point on OBB to circle center
    const nx = Math.max(0, lx - hw);
    const ny = Math.max(0, ly - hh);
    return nx * nx + ny * ny < cr * cr;
  }

  update(dt: number) {
    if (this.dead) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifespan--;

    const sw = this.scene.scale.width + this.width;
    const sh = this.scene.scale.height + this.height;
    if (this.x < -sw || this.x > sw || this.y < -sh || this.y > sh || this.lifespan <= 0) {
      this.destroy();
      return;
    }
    this.draw();
  }

  destroy() {
    this.dead = true;
    this.graphics.destroy();
  }
}
