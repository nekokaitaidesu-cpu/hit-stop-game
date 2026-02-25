import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Create player texture
    this.createCircleTexture('player', 22, 0x4488ff, 0x88bbff);
    // Enemy texture
    this.createCircleTexture('enemy', 22, 0xff4444, 0xff8888);
    // Pellet texture
    this.createCircleTexture('pellet', 5, 0xffdd44, 0xffff88);
    // Training dummy texture
    this.createCircleTexture('dummy', 30, 0x888888, 0xaaaaaa);

    this.scene.start('MenuScene');
  }

  private createCircleTexture(key: string, radius: number, fillColor: number, highlightColor: number) {
    const size = radius * 2 + 4;
    const g = this.add.graphics();

    g.fillStyle(fillColor, 1);
    g.fillCircle(size / 2, size / 2, radius);
    g.fillStyle(highlightColor, 0.5);
    g.fillCircle(size / 2 - radius * 0.25, size / 2 - radius * 0.25, radius * 0.4);

    g.generateTexture(key, size, size);
    g.destroy();
  }
}
