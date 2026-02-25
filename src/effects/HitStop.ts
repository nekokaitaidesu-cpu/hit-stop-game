import Phaser from 'phaser';

export class HitStop {
  private scene: Phaser.Scene;
  private stopFrames = 0;
  private frozenObjects: Set<Phaser.Physics.Arcade.Body> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  trigger(frames: number, targets: Phaser.GameObjects.GameObject[]) {
    this.stopFrames = Math.max(this.stopFrames, frames);
    for (const obj of targets) {
      const body = (obj as Phaser.Types.Physics.Arcade.GameObjectWithBody).body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.enable = false;
        this.frozenObjects.add(body);
        const sprite = obj as Phaser.GameObjects.Sprite;
        if (sprite.setTint) sprite.setTint(0xffffff);
      }
    }
  }

  update() {
    if (this.stopFrames > 0) {
      this.stopFrames--;
      if (this.stopFrames === 0) {
        for (const body of this.frozenObjects) {
          body.enable = true;
          const go = body.gameObject as Phaser.GameObjects.Sprite;
          if (go && go.clearTint) go.clearTint();
        }
        this.frozenObjects.clear();
      }
    }
  }

  get active() {
    return this.stopFrames > 0;
  }
}
