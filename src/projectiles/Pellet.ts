import Phaser from 'phaser';

export class Pellet extends Phaser.Physics.Arcade.Sprite {
  damage: number;
  ownerTag: string;
  private lifespan: number;

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number, damage: number, ownerTag: string) {
    super(scene, x, y, 'pellet');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this.ownerTag = ownerTag;
    this.lifespan = 60;
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // テクスチャsize=14, 中心=7, hitbox radius=4 → offset = 7-4 = 3
    body.setCircle(4, 3, 3);
    this.setCollideWorldBounds(false);
    body.setVelocity(vx, vy);
  }

  update() {
    this.lifespan--;
    if (this.lifespan <= 0) {
      this.destroy();
    }
  }
}
