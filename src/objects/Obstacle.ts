import Phaser from 'phaser';

export interface ObstacleDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ObstacleGroup {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  staticGroup: Phaser.Physics.Arcade.StaticGroup;
  defs: ObstacleDef[] = [];

  constructor(scene: Phaser.Scene, defs: ObstacleDef[]) {
    this.scene = scene;
    this.defs = defs;
    this.staticGroup = scene.physics.add.staticGroup();
    this.graphics = scene.add.graphics().setDepth(5);

    for (const d of defs) {
      // Physics body: invisible rectangle (staticGroup handles body creation)
      const rect = scene.add.rectangle(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
      this.staticGroup.add(rect);
      // 明示的にボディ位置をリセット（描画グラフィックと一致させる）
      const body = rect.body as Phaser.Physics.Arcade.StaticBody;
      body.reset(d.x + d.w / 2, d.y + d.h / 2);

      // Visual
      this.graphics.fillStyle(0x334466, 1);
      this.graphics.fillRect(d.x, d.y, d.w, d.h);
      this.graphics.lineStyle(2, 0x6688aa, 0.8);
      this.graphics.strokeRect(d.x, d.y, d.w, d.h);

      // Inner highlight
      this.graphics.lineStyle(1, 0x88aacc, 0.3);
      this.graphics.strokeRect(d.x + 3, d.y + 3, d.w - 6, d.h - 6);
    }
  }

  /** レーザー/ビームが障害物に当たるか（AABB vs 点） */
  containsPoint(x: number, y: number): boolean {
    for (const d of this.defs) {
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return true;
    }
    return false;
  }

  /** ペレット（円）が障害物に当たるか */
  circleOverlaps(cx: number, cy: number, r: number): boolean {
    for (const d of this.defs) {
      const nearX = Math.max(d.x, Math.min(cx, d.x + d.w));
      const nearY = Math.max(d.y, Math.min(cy, d.y + d.h));
      const dx = cx - nearX, dy = cy - nearY;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  addCollider(target: Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.Group) {
    this.scene.physics.add.collider(target as unknown as Phaser.Physics.Arcade.Body, this.staticGroup);
  }

  destroy() {
    this.graphics.destroy();
  }
}
