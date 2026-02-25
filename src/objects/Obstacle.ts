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
      // ③ origin(0,0) + 左上座標で配置 → グラフィックと完全一致
      const rect = scene.add.rectangle(d.x, d.y, d.w, d.h).setOrigin(0, 0);
      this.staticGroup.add(rect);

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

  /**
   * ② 線分 (x1,y1)→(x2,y2) が障害物を通過するか（Liang-Barsky法）
   * 通過する場合 true → 命中判定を無効化するために使用
   */
  lineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const d of this.defs) {
      if (this.segmentHitsRect(x1, y1, x2, y2, d.x, d.y, d.x + d.w, d.y + d.h)) {
        return true;
      }
    }
    return false;
  }

  private segmentHitsRect(
    x1: number, y1: number, x2: number, y2: number,
    minX: number, minY: number, maxX: number, maxY: number,
  ): boolean {
    const dx = x2 - x1, dy = y2 - y1;
    let tMin = 0, tMax = 1;
    const checks: [number, number][] = [
      [-dx, x1 - minX],
      [dx,  maxX - x1],
      [-dy, y1 - minY],
      [dy,  maxY - y1],
    ];
    for (const [p, q] of checks) {
      if (p === 0) {
        if (q < 0) return false;
      } else {
        const t = q / p;
        if (p < 0) tMin = Math.max(tMin, t);
        else       tMax = Math.min(tMax, t);
        if (tMin > tMax) return false;
      }
    }
    return true;
  }

  addCollider(target: Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.Group) {
    this.scene.physics.add.collider(target as unknown as Phaser.Physics.Arcade.Body, this.staticGroup);
  }

  destroy() {
    this.graphics.destroy();
  }
}
