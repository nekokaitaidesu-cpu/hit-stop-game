import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

export class HUDDisplay {
  private scene: Phaser.Scene;
  private playerHPBar!: Phaser.GameObjects.Graphics;
  private enemyHPBar!: Phaser.GameObjects.Graphics;
  private playerHPText!: Phaser.GameObjects.Text;
  private enemyHPText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private cooldownBar!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create() {
    const depth = 50;
    // Player HP (bottom) - 40px上げてスマホ下部ブラウザUIの見切れ対策
    this.playerHPBar = this.scene.add.graphics().setDepth(depth);
    this.playerHPText = this.scene.add.text(10, 760, 'Player HP', {
      fontSize: '14px', color: '#fff', stroke: '#000', strokeThickness: 2,
    }).setDepth(depth);

    // Enemy HP (top)
    this.enemyHPBar = this.scene.add.graphics().setDepth(depth);
    this.enemyHPText = this.scene.add.text(10, 30, 'Enemy HP', {
      fontSize: '14px', color: '#fff', stroke: '#000', strokeThickness: 2,
    }).setDepth(depth);

    // Weapon label
    this.weaponText = this.scene.add.text(GAME_WIDTH / 2, 780, '', {
      fontSize: '16px', color: '#ffdd44', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth);

    // Cooldown bar
    this.cooldownBar = this.scene.add.graphics().setDepth(depth);
  }

  update(playerHp: number, playerMaxHp: number, enemyHp: number | null, enemyMaxHp: number | null, weapon: string, cooldownRatio: number) {
    const barW = GAME_WIDTH - 20;

    // Player HP
    this.playerHPBar.clear();
    this.playerHPBar.fillStyle(0x333333);
    this.playerHPBar.fillRect(10, 780, barW, 12);
    this.playerHPBar.fillStyle(0x44ff44);
    this.playerHPBar.fillRect(10, 780, barW * Math.max(0, playerHp / playerMaxHp), 12);

    this.playerHPText.setText(`YOU  ${playerHp}/${playerMaxHp}`);

    // Enemy HP
    this.enemyHPBar.clear();
    if (enemyHp !== null && enemyMaxHp !== null) {
      this.enemyHPBar.fillStyle(0x333333);
      this.enemyHPBar.fillRect(10, 10, barW, 12);
      this.enemyHPBar.fillStyle(0xff4444);
      this.enemyHPBar.fillRect(10, 10, barW * Math.max(0, enemyHp / enemyMaxHp), 12);
      this.enemyHPText.setText(`CPU  ${enemyHp}/${enemyMaxHp}`).setVisible(true);
    } else {
      this.enemyHPText.setVisible(false);
    }

    // Weapon
    this.weaponText.setText(`[${weapon.toUpperCase()}]  ${cooldownRatio >= 1 ? 'READY' : 'reloading...'}`);

    // Cooldown bar
    this.cooldownBar.clear();
    this.cooldownBar.fillStyle(0x888888);
    this.cooldownBar.fillRect(GAME_WIDTH / 2 - 80, 798, 160, 6);
    this.cooldownBar.fillStyle(0xffdd44);
    this.cooldownBar.fillRect(GAME_WIDTH / 2 - 80, 798, 160 * Math.min(1, cooldownRatio), 6);
  }

  destroy() {
    this.playerHPBar.destroy();
    this.enemyHPBar.destroy();
    this.playerHPText.destroy();
    this.enemyHPText.destroy();
    this.weaponText.destroy();
    this.cooldownBar.destroy();
  }
}
