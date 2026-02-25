import Phaser from 'phaser';

export class ScreenShake {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  shake(intensity: number = 0.01, duration: number = 100) {
    this.scene.cameras.main.shake(duration, intensity);
  }
}
