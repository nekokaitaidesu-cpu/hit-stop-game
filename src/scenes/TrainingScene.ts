import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_CONFIG, COLORS } from '../config';
import type { WeaponType } from '../config';
import { Player } from '../objects/Player';
import { HitStop } from '../effects/HitStop';
import { ScreenShake } from '../effects/ScreenShake';
import { HUDDisplay } from '../ui/HUDDisplay';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { Pellet } from '../projectiles/Pellet';
import { LaserBolt } from '../projectiles/LaserBolt';
import { BeamProjectile } from '../projectiles/BeamProjectile';
import { DamagePopup } from '../ui/DamagePopup';

// Simple dummy that doesn't shoot back
class TrainingDummy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  private hpBar: Phaser.GameObjects.Graphics;
  private flashTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'dummy');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.hp = 200;
    this.maxHp = 200;
    this.setDepth(20);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    // dummyテクスチャsize=64, 中心=32, hitbox radius=30 → offset = 32-30 = 2
    body.setCircle(PLAYER_CONFIG.radius + 8, 2, 2);
    this.hpBar = scene.add.graphics().setDepth(25);
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    this.setTint(0xffffff);
    this.flashTimer = 6;
  }

  updateDummy() {
    if (this.flashTimer > 0) {
      this.flashTimer--;
      if (this.flashTimer === 0) this.clearTint();
    }

    if (this.hp <= 0) {
      // Respawn
      this.hp = this.maxHp;
      this.setTint(0x888888);
      this.flashTimer = 30;
    }

    // Draw HP bar
    this.hpBar.clear();
    const bw = 60;
    this.hpBar.fillStyle(0x333333);
    this.hpBar.fillRect(this.x - bw / 2, this.y - 45, bw, 8);
    this.hpBar.fillStyle(0x44aa44);
    this.hpBar.fillRect(this.x - bw / 2, this.y - 45, bw * (this.hp / this.maxHp), 8);
  }

  destroy(fromScene?: boolean) {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}

export class TrainingScene extends Phaser.Scene {
  private player!: Player;
  private dummy!: TrainingDummy;
  private hitStop!: HitStop;
  private screenShake!: ScreenShake;
  private hud!: HUDDisplay;
  private joystick: VirtualJoystick | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private weapon: WeaponType = 'shotgun';
  private allPellets: Pellet[] = [];
  private allLasers: LaserBolt[] = [];
  private allBeams: BeamProjectile[] = [];
  private isDesktop = true;
  private pelletGroup!: Phaser.Physics.Arcade.Group;

  constructor() {
    super({ key: 'TrainingScene' });
  }

  init(data: { weapon: WeaponType }) {
    this.weapon = data.weapon || 'shotgun';
  }

  create() {
    this.isDesktop = this.sys.game.device.os.desktop;

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d1117, 0x0d1117, 0x161b22, 0x161b22, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.drawGrid(bg);

    this.hitStop = new HitStop(this);
    this.screenShake = new ScreenShake(this);

    // Player
    this.player = new Player(
      this, GAME_WIDTH / 2, GAME_HEIGHT - 150,
      this.weapon, 'player', COLORS.player,
      this.hitStop, this.screenShake
    );

    // Training dummy
    this.dummy = new TrainingDummy(this, GAME_WIDTH / 2, GAME_HEIGHT / 3);

    // Physics group for pellets
    this.pelletGroup = this.physics.add.group();

    // Setup input
    if (this.isDesktop) {
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.wasd = {
        up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.firePlayer(p.worldX, p.worldY);
      });
    } else {
      this.joystick = new VirtualJoystick(this, (wx, wy) => {
        this.firePlayer(wx, wy);
      });
    }

    this.hud = new HUDDisplay(this);

    // Back to menu button
    const backBtn = this.add.text(10, 30, '← Menu', {
      fontSize: '16px', color: '#aaaaaa', backgroundColor: '#222222', padding: { x: 8, y: 4 },
    }).setDepth(60).setScrollFactor(0).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.cleanup();
      this.scene.start('MenuScene');
    });

    // Mode label
    this.add.text(GAME_WIDTH - 10, 30, 'TRAINING', {
      fontSize: '14px', color: '#44ffaa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(60);
  }

  private drawGrid(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(1, 0x1a2030, 0.5);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  private firePlayer(tx: number, ty: number) {
    const proj = { pellets: this.allPellets, lasers: this.allLasers, beams: this.allBeams };
    this.player.fire(tx, ty, proj);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    this.hitStop.update();

    // Movement
    if (!this.hitStop.active) {
      let dx = 0, dy = 0;
      if (this.isDesktop) {
        if (this.wasd.left.isDown || this.cursors.left.isDown) dx -= 1;
        if (this.wasd.right.isDown || this.cursors.right.isDown) dx += 1;
        if (this.wasd.up.isDown || this.cursors.up.isDown) dy -= 1;
        if (this.wasd.down.isDown || this.cursors.down.isDown) dy += 1;
        this.player.moveWithVector(dx, dy);
      } else if (this.joystick) {
        const axis = this.joystick.getAxis();
        this.player.moveWithVector(axis.x, axis.y);
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    this.player.update(dt);
    this.dummy.updateDummy();

    // Update pellets
    for (let i = this.allPellets.length - 1; i >= 0; i--) {
      const p = this.allPellets[i];
      if (!p.active) { this.allPellets.splice(i, 1); continue; }
      p.update();
      // Check hit vs dummy
      if (p.ownerTag === 'player' && this.checkCircleHit(p.x, p.y, 4, this.dummy.x, this.dummy.y, 30)) {
        this.dummy.takeDamage(p.damage);
        DamagePopup.show(this, this.dummy.x, this.dummy.y - 30, p.damage);
        this.hitStop.trigger(2, []);
        this.screenShake.shake(0.003, 50);
        p.destroy();
        this.allPellets.splice(i, 1);
      }
    }

    // Update lasers
    for (let i = this.allLasers.length - 1; i >= 0; i--) {
      const lb = this.allLasers[i];
      lb.update(dt);

      // 反射で生まれた子レーザーを配列に追加
      if (lb.pendingSpawn.length > 0) {
        for (const sp of lb.pendingSpawn) {
          this.allLasers.push(new LaserBolt(
            this, sp.x, sp.y, sp.angle, lb.speed,
            lb.damage, lb.ownerTag, sp.generation,
          ));
        }
        lb.pendingSpawn = [];
      }

      if (lb.dead) { this.allLasers.splice(i, 1); continue; }

      // 障害物反射（TrainingSceneに障害物はないが念のためチェック）
      // TrainingSceneには障害物なし - スキップ

      if (lb.ownerTag === 'player' && lb.hits(this.dummy.x, this.dummy.y, 30)) {
        lb.hasHit = true;
        this.dummy.takeDamage(lb.damage);
        DamagePopup.show(this, this.dummy.x, this.dummy.y - 30, lb.damage);
        this.hitStop.trigger(4, []);
        this.screenShake.shake(0.005, 80);
        lb.destroy();
        this.allLasers.splice(i, 1);
      }
    }

    // Update beams
    for (let i = this.allBeams.length - 1; i >= 0; i--) {
      const beam = this.allBeams[i];
      beam.update(dt);
      if (beam.dead) { this.allBeams.splice(i, 1); continue; }
      if (beam.ownerTag === 'player' && !beam.hitTargets.has(this.dummy) && beam.hits(this.dummy.x, this.dummy.y, 30)) {
        beam.hitTargets.add(this.dummy);
        this.dummy.takeDamage(beam.damage);
        DamagePopup.show(this, this.dummy.x, this.dummy.y - 30, beam.damage);
        this.hitStop.trigger(6, []);
        this.screenShake.shake(0.008, 120);
      }
    }

    // HUD
    this.hud.update(
      this.player.hp, this.player.maxHp,
      null, null,
      this.weapon,
      this.player.cooldownRatio
    );
  }

  private checkCircleHit(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
  }

  private cleanup() {
    this.allLasers.forEach(l => l.destroy());
    this.allBeams.forEach(b => b.destroy());
    this.joystick?.destroy();
    this.hud.destroy();
  }

  shutdown() {
    this.cleanup();
  }
}
