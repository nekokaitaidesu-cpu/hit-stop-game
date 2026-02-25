import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_CONFIG, COLORS } from '../config';
import type { WeaponType, CpuLevel } from '../config';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { ObstacleGroup } from '../objects/Obstacle';
import { HitStop } from '../effects/HitStop';
import { ScreenShake } from '../effects/ScreenShake';
import { HUDDisplay } from '../ui/HUDDisplay';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { Pellet } from '../projectiles/Pellet';
import { LaserBolt } from '../projectiles/LaserBolt';
import { BeamProjectile } from '../projectiles/BeamProjectile';

export class BattleScene extends Phaser.Scene {
  private player!: Player;
  private enemy!: Enemy;
  private obstacles!: ObstacleGroup;
  private hitStop!: HitStop;
  private screenShake!: ScreenShake;
  private hud!: HUDDisplay;
  private joystick: VirtualJoystick | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private weapon: WeaponType = 'shotgun';
  private cpuLevel: CpuLevel = 1;
  private playerPellets: Pellet[] = [];
  private playerLasers: LaserBolt[] = [];
  private playerBeams: BeamProjectile[] = [];
  private enemyPellets: Pellet[] = [];
  private enemyLasers: LaserBolt[] = [];
  private enemyBeams: BeamProjectile[] = [];
  private isDesktop = true;
  private gameOver = false;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { weapon: WeaponType; level?: CpuLevel }) {
    this.weapon = data.weapon || 'shotgun';
    this.cpuLevel = data.level ?? 1;
    this.gameOver = false;
  }

  create() {
    this.isDesktop = this.sys.game.device.os.desktop;

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0022, 0x1a0022, 0x0d1117, 0x0d1117, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.drawArena(bg);

    this.hitStop = new HitStop(this);
    this.screenShake = new ScreenShake(this);

    // Obstacles (before players so collision is set up)
    this.obstacles = new ObstacleGroup(this, [
      { x: 80,  y: 300, w: 120, h: 28 },  // 左中段
      { x: 280, y: 220, w: 28,  h: 120 }, // 中央縦
      { x: 80,  y: 520, w: 120, h: 28 },  // 左下段
      { x: 280, y: 500, w: 28,  h: 120 }, // 中央縦下
    ]);

    // Player (bottom)
    this.player = new Player(
      this, GAME_WIDTH / 2, GAME_HEIGHT - 150,
      this.weapon, 'player', COLORS.player,
      this.hitStop, this.screenShake,
    );

    // Enemy (top), random weapon
    const enemyWeapons: WeaponType[] = ['shotgun', 'laser', 'beam'];
    const enemyWeapon = enemyWeapons[Math.floor(Math.random() * enemyWeapons.length)];
    this.enemy = new Enemy(
      this, GAME_WIDTH / 2, 150,
      enemyWeapon,
      this.hitStop, this.screenShake,
      this.cpuLevel,
    );
    this.enemy.setTarget(this.player);
    this.enemy.setObstacles(this.obstacles.defs);

    // Obstacle colliders
    this.obstacles.addCollider(this.player);
    this.obstacles.addCollider(this.enemy);

    // Input
    if (this.isDesktop) {
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.wasd = {
        up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.gameOver) this.firePlayer(p.worldX, p.worldY);
      });
    } else {
      this.joystick = new VirtualJoystick(this, (wx, wy) => {
        if (!this.gameOver) this.firePlayer(wx, wy);
      });
    }

    this.hud = new HUDDisplay(this);

    // Back button
    const backBtn = this.add.text(10, 30, '← Menu', {
      fontSize: '16px', color: '#aaaaaa', backgroundColor: '#222222', padding: { x: 8, y: 4 },
    }).setDepth(60).setScrollFactor(0).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => { this.cleanup(); this.scene.start('MenuScene'); });

    const lvColors: Record<CpuLevel, string> = { 1: '#44ffaa', 2: '#ffdd44', 3: '#ff4444' };
    this.add.text(GAME_WIDTH - 10, 30, `CPU  Lv.${this.cpuLevel}`, {
      fontSize: '14px', color: lvColors[this.cpuLevel], stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(60);
  }

  private drawArena(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(2, 0x334466, 0.6);
    g.strokeRect(5, 5, GAME_WIDTH - 10, GAME_HEIGHT - 10);
    g.lineStyle(1, 0x334466, 0.3);
    g.lineBetween(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2);
    g.lineStyle(1, 0x1a2030, 0.3);
    for (let x = 0; x < GAME_WIDTH; x += 40) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y < GAME_HEIGHT; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);
  }

  private firePlayer(tx: number, ty: number) {
    this.player.fire(tx, ty, {
      pellets: this.playerPellets,
      lasers:  this.playerLasers,
      beams:   this.playerBeams,
    });
  }

  update(_time: number, delta: number) {
    if (this.gameOver) return;

    const dt = delta / 1000;
    this.hitStop.update();

    // --- Player movement ---
    if (!this.hitStop.active) {
      if (this.isDesktop) {
        let dx = 0, dy = 0;
        if (this.wasd.left.isDown  || this.cursors.left.isDown)  dx -= 1;
        if (this.wasd.right.isDown || this.cursors.right.isDown) dx += 1;
        if (this.wasd.up.isDown    || this.cursors.up.isDown)    dy -= 1;
        if (this.wasd.down.isDown  || this.cursors.down.isDown)  dy += 1;
        this.player.moveWithVector(dx, dy);
      } else if (this.joystick) {
        const axis = this.joystick.getAxis();
        this.player.moveWithVector(axis.x, axis.y);
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    this.player.update(dt);

    // --- Enemy AI ---
    this.enemy.updateAI(dt, {
      pellets: this.enemyPellets,
      lasers:  this.enemyLasers,
      beams:   this.enemyBeams,
    });

    // --- Update & check all projectiles ---
    this.updateProjectiles(dt);

    // --- Win/loss check ---
    if (!this.player.isAlive) this.endGame(false);
    else if (!this.enemy.isAlive)  this.endGame(true);

    // --- HUD ---
    this.hud.update(
      this.player.hp, this.player.maxHp,
      this.enemy.hp,  this.enemy.maxHp,
      this.weapon,
      this.player.cooldownRatio,
    );
  }

  // ─── projectile update (①の修正: update()を確実に呼ぶ) ───────────────────
  private updateProjectiles(dt: number) {
    this.updatePelletArray(this.playerPellets, this.enemy);
    this.updatePelletArray(this.enemyPellets,  this.player);
    this.updateLaserArray(this.playerLasers, this.enemy,  dt);
    this.updateLaserArray(this.enemyLasers,  this.player, dt);
    this.updateBeamArray(this.playerBeams, this.enemy,  dt);
    this.updateBeamArray(this.enemyBeams,  this.player, dt);
  }

  private updatePelletArray(pellets: Pellet[], target: Player | Enemy) {
    const tr = PLAYER_CONFIG.radius;
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (!p.active) { pellets.splice(i, 1); continue; }
      p.update();

      // Obstacle: ペレットは障害物に当たったら消える
      if (this.obstacles.circleOverlaps(p.x, p.y, 4)) {
        p.destroy();
        pellets.splice(i, 1);
        continue;
      }

      if (target.isAlive &&
          this.circleOverlap(p.x, p.y, 4, target.x, target.y, tr) &&
          !this.obstacles.lineBlocked(p.x, p.y, target.x, target.y)) {
        target.takeDamage(p.damage, 'shotgun');
        p.destroy();
        pellets.splice(i, 1);
      }
    }
  }

  private updateLaserArray(lasers: LaserBolt[], target: Player | Enemy, dt: number) {
    const tr = PLAYER_CONFIG.radius;
    for (let i = lasers.length - 1; i >= 0; i--) {
      const lb = lasers[i];
      lb.update(dt);   // ← ①の核心: 必ずupdate()を呼ぶ

      // 反射で生まれた子レーザーを配列に追加 (③)
      if (lb.pendingSpawn.length > 0) {
        for (const sp of lb.pendingSpawn) {
          lasers.push(new LaserBolt(
            this, sp.x, sp.y, sp.angle, lb.speed,
            lb.damage, lb.ownerTag, sp.generation,
          ));
        }
        lb.pendingSpawn = [];
      }

      if (lb.dead) { lasers.splice(i, 1); continue; }

      // Obstacle: レーザーが障害物にぶつかったら反射・3分裂
      if (this.obstacles.containsPoint(lb.x, lb.y)) {
        if (lb.generation < 1) {
          const horizontal = Math.abs(lb.vx) > Math.abs(lb.vy);
          const reflectAngle = horizontal ? Math.PI - lb.angle : -lb.angle;
          const SPREAD = Math.PI / 6;
          [0, SPREAD, -SPREAD].forEach(da => {
            lasers.push(new LaserBolt(this, lb.x, lb.y, reflectAngle + da, lb.speed, lb.damage, lb.ownerTag, 1));
          });
        }
        lb.destroy();
        lasers.splice(i, 1);
        continue;
      }

      if (target.isAlive &&
          lb.hits(target.x, target.y, tr) &&
          !this.obstacles.lineBlocked(lb.x, lb.y, target.x, target.y)) {
        lb.hasHit = true;
        target.takeDamage(lb.damage, 'laser');
        lb.destroy();
        lasers.splice(i, 1);
      }
    }
  }

  private updateBeamArray(beams: BeamProjectile[], target: Player | Enemy, dt: number) {
    const tr = PLAYER_CONFIG.radius;
    for (let i = beams.length - 1; i >= 0; i--) {
      const beam = beams[i];
      beam.update(dt);   // ← ①の核心: 必ずupdate()を呼ぶ
      if (beam.dead) { beams.splice(i, 1); continue; }

      if (target.isAlive &&
          !beam.hitTargets.has(target) &&
          beam.hits(target.x, target.y, tr)) {
        beam.hitTargets.add(target);
        target.takeDamage(beam.damage, 'beam');
        if (beam.hitTargets.size >= beam.maxHits) { beam.destroy(); beams.splice(i, 1); }
      }
    }
  }

  private circleOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    const dx = x1 - x2, dy = y1 - y2;
    return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
  }

  // ─── end game ───────────────────────────────────────────────────────────────
  private endGame(playerWon: boolean) {
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.enemy.setVelocity(0, 0);

    const msg   = playerWon ? 'YOU WIN! 🎉' : 'YOU LOSE...';
    const color = playerWon ? '#44ff88' : '#ff4444';

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, msg, {
      fontSize: '48px', color, stroke: '#000', strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(80);

    const replayBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '▶ PLAY AGAIN', {
      fontSize: '26px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true });
    replayBtn.on('pointerdown', () => { this.cleanup(); this.scene.restart(); });

    const menuBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, 'MENU', {
      fontSize: '20px', color: '#aaaaaa', backgroundColor: '#222222', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => { this.cleanup(); this.scene.start('MenuScene'); });
  }

  private cleanup() {
    [...this.playerLasers, ...this.enemyLasers].forEach(l => l.destroy());
    [...this.playerBeams,  ...this.enemyBeams ].forEach(b => b.destroy());
    this.joystick?.destroy();
    this.hud.destroy();
  }

  shutdown() { this.cleanup(); }
}
