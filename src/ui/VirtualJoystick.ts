import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private base!: Phaser.GameObjects.Graphics;
  private thumb!: Phaser.GameObjects.Graphics;
  private baseX = 100;
  private baseY = GAME_HEIGHT - 140;
  private radius = 55;
  private thumbRadius = 25;
  private activePointerId: number | null = null;
  private dx = 0;
  private dy = 0;
  private _visible = true;

  // Right side for aiming/shoot
  private shootCallback?: (x: number, y: number) => void;
  private shootPointerId: number | null = null;

  constructor(scene: Phaser.Scene, onShoot?: (worldX: number, worldY: number) => void) {
    this.scene = scene;
    this.shootCallback = onShoot;
    this.create();
  }

  private create() {
    this.base = this.scene.add.graphics().setDepth(60).setScrollFactor(0);
    this.thumb = this.scene.add.graphics().setDepth(61).setScrollFactor(0);
    this.drawBase();

    const input = this.scene.input;
    input.addPointer(2);

    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < GAME_WIDTH / 2) {
        if (this.activePointerId === null) {
          this.activePointerId = p.id;
          this.baseX = p.x;
          this.baseY = p.y;
          this.drawBase();
        }
      } else {
        // Right side → shoot
        if (this.shootPointerId === null) {
          this.shootPointerId = p.id;
          this.shootCallback?.(p.worldX, p.worldY);
        }
      }
    });

    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.activePointerId) {
        const ddx = p.x - this.baseX;
        const ddy = p.y - this.baseY;
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
    this._visible = v;
    this.base.setVisible(v);
    this.thumb.setVisible(v);
  }

  destroy() {
    this.base.destroy();
    this.thumb.destroy();
  }
}
