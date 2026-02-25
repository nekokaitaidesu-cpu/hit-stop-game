import Phaser from 'phaser';

export class DamagePopup {
  static show(scene: Phaser.Scene, x: number, y: number, damage: number) {
    const text = scene.add.text(x, y, `-${damage}`, {
      fontSize: '20px',
      color: '#ff6600',
      stroke: '#000',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setDepth(100).setOrigin(0.5);

    scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
