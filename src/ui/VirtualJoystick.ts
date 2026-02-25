import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// 左下の固定スティックエリア
const STICK_ZONE_W = 200;
const STICK_ZONE_H = 230;
const STICK_ZONE_X = 0;
const STICK_ZONE_Y = GAME_HEIGHT - STICK_ZONE_H;

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private zoneBg!: Phaser.GameObjects.Graphics;
  private base!: Phaser.GameObjects.Graphics;
  private thumb!: Phaser.GameObjects.Graphics;

  // スティックの固定中心座標
  private readonly baseX = 90;
  private readonly baseY = GAME_HEIGHT - 125;
  private readonly radius = 55;
  private readonly thumbRadius = 25;

  private activePointerId: number | null = null;
  private dx = 0;
  private dy = 0;

  private shootCallback?: (x: number, y: number) => void;
  private shootPointerId: number | null = null;

  constructor(scene: Phaser.Scene, onShoot?: (worldX: number, worldY: number) => void) {
    this.scene = scene;
    this.shootCallback = onShoot;
    this.create();
  }

  private isInStickZone(x: number, y: number): boolean {
    return x >= STICK_ZONE_X && x < STICK_ZONE_X + STICK_ZONE_W &&
           y >= STICK_ZONE_Y && y <= GAME_HEIGHT;
  }

  private create() {
    // スティックエリアの薄い背景表示
    this.zoneBg = this.scene.add.graphics().setDepth(59).setScrollFactor(0);
    this.zoneBg.fillStyle(0xffffff, 0.04);
    this.zoneBg.fillRect(STICK_ZONE_X, STICK_ZONE_Y, STICK_ZONE_W, STICK_ZONE_H);
    this.zoneBg.lineStyle(1, 0xffffff, 0.12);
    this.zoneBg.strokeRect(STICK_ZONE_X, STICK_ZONE_Y, STICK_ZONE_W, STICK_ZONE_H);

    this.base  = this.scene.add.graphics().setDepth(60).setScrollFactor(0);
    this.thumb = this.scene.add.graphics().setDepth(61).setScrollFactor(0);
    this.drawBase();

    const input = this.scene.input;
    input.addPointer(2);

    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isInStickZone(p.x, p.y)) {
        // スティックエリア → 移動
        if (this.activePointerId === null) {
          this.activePointerId = p.id;
          this.updateThumb(p.x, p.y);
        }
      } else {
        // それ以外 → 射撃
        if (this.shootPointerId === null) {
          this.shootPointerId = p.id;
          this.shootCallback?.(p.worldX, p.worldY);
        }
      }
    });

    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.activePointerId) {
        this.updateThumb(p.x, p.y);
      }
    });

    input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.activePointerId) {
        this.activePointerId = null;
        this.dx = 0;
        this.dy = 0;
        this.drawThumb();
      }
      if (p.id === this.shootPointerId) {
        this.shootPointerId = null;
      }
    });
  }

  private updateThumb(px: number, py: number) {
    const ddx = px - this.baseX;
    const ddy = py - this.baseY;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist > this.radius) {
      this.dx = (ddx / dist) * this.radius;
      this.dy = (ddy / dist) * this.radius;
    } else {
      this.dx = ddx;
      this.dy = ddy;
    }
    this.drawThumb();
  }

  private drawBase() {
    this.base.clear();
    this.base.lineStyle(2, 0xffffff, 0.3);
    this.base.strokeCircle(this.baseX, this.baseY, this.radius);
    this.base.fillStyle(0xffffff, 0.1);
    this.base.fillCircle(this.baseX, this.baseY, this.radius);
    this.drawThumb();
  }

  private drawThumb() {
    this.thumb.clear();
    this.thumb.fillStyle(0xffffff, 0.5);
    this.thumb.fillCircle(this.baseX + this.dx, this.baseY + this.dy, this.thumbRadius);
  }

  getAxis(): { x: number; y: number } {
    const len = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: this.dx / this.radius, y: this.dy / this.radius };
  }

  setVisible(v: boolean) {
    this.zoneBg.setVisible(v);
    this.base.setVisible(v);
    this.thumb.setVisible(v);
  }

  destroy() {
    this.zoneBg.destroy();
    this.base.destroy();
    this.thumb.destroy();
  }
}
