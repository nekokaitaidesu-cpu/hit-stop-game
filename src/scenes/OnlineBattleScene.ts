import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_CONFIG, WEAPON_CONFIG, COLORS } from '../config';
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
import type { PeerManager, NetMsg } from '../network/PeerManager';

// ─── 設計方針 ────────────────────────────────────────────────────────────────
// • 命中判定は「攻撃した側」が行い、hit メッセージで相手に通知（sender-authoritative）
// • pos メッセージで座標と HP を毎フレーム同期（相手の HP はここから取得）
// • ローカル弾：通常通り生成・命中判定
// • リモート弾：視覚的再現のみ（damage=0 で生成、命中判定なし）
// ─────────────────────────────────────────────────────────────────────────────

export class OnlineBattleScene extends Phaser.Scene {
  // ── ネットワーク ─────────────────────────────────────────────────────────
  private peer!: PeerManager;
  private isHost!: boolean;

  // ── プレイヤー ───────────────────────────────────────────────────────────
  private localPlayer!: Player;
  private localWeapon!: WeaponType;
  private remoteWeapon!: WeaponType;

  /** リモートプレイヤーの見た目（位置はネットワークで更新） */
  private remoteSprite!: Phaser.GameObjects.Sprite;
  private remoteX = GAME_WIDTH / 2;
  private remoteY = 150;
  private remoteHp = PLAYER_CONFIG.maxHp;

  // ── 弾 ──────────────────────────────────────────────────────────────────
  private localPellets:  Pellet[]          = [];
  private localLasers:   LaserBolt[]       = [];
  private localBeams:    BeamProjectile[]  = [];
  private remoteLasers:  LaserBolt[]       = [];
  private remoteBeams:   BeamProjectile[]  = [];

  // ── エフェクト・UI ───────────────────────────────────────────────────────
  private hitStop!: HitStop;
  private screenShake!: ScreenShake;
  private hud!: HUDDisplay;
  private joystick: VirtualJoystick | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key;
  };
  private isDesktop = true;
  private gameOver = false;

  constructor() {
    super({ key: 'OnlineBattleScene' });
  }

  init(data: { peer: PeerManager; localWeapon: WeaponType; remoteWeapon: WeaponType; isHost: boolean }) {
    this.peer         = data.peer;
    this.localWeapon  = data.localWeapon;
    this.remoteWeapon = data.remoteWeapon;
    this.isHost       = data.isHost;
    this.gameOver     = false;
    this.remoteHp     = PLAYER_CONFIG.maxHp;
  }

  create() {
    this.isDesktop = this.sys.game.device.os.desktop;

    // 背景
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d1a2e, 0x0d1a2e, 0x0d1117, 0x0d1117, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // アリーナ罫線
    bg.lineStyle(2, 0x334466, 0.6);
    bg.strokeRect(5, 5, GAME_WIDTH - 10, GAME_HEIGHT - 10);
    bg.lineStyle(1, 0x334466, 0.3);
    bg.lineBetween(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2);
    bg.lineStyle(1, 0x1a2030, 0.3);
    for (let x = 0; x < GAME_WIDTH; x += 40) bg.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y < GAME_HEIGHT; y += 40) bg.lineBetween(0, y, GAME_WIDTH, y);

    this.hitStop    = new HitStop(this);
    this.screenShake = new ScreenShake(this);

    // ホスト = 下側、ゲスト = 上側
    const localY  = this.isHost ? GAME_HEIGHT - 150 : 150;
    this.remoteY  = this.isHost ? 150 : GAME_HEIGHT - 150;
    this.remoteX  = GAME_WIDTH / 2;

    // ローカルプレイヤー
    this.localPlayer = new Player(
      this, GAME_WIDTH / 2, localY,
      this.localWeapon, 'player', COLORS.player,
      this.hitStop, this.screenShake,
    );

    // リモートプレイヤー（物理なし・視覚のみ）
    this.remoteSprite = this.add.sprite(this.remoteX, this.remoteY, 'player')
      .setTint(COLORS.enemy)
      .setDepth(20);

    // 入力
    if (this.isDesktop) {
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.wasd = {
        up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.gameOver) this.fireLocal(p.worldX, p.worldY);
      });
    } else {
      this.joystick = new VirtualJoystick(this, (wx, wy) => {
        if (!this.gameOver) this.fireLocal(wx, wy);
      });
    }

    this.hud = new HUDDisplay(this);

    // UI ラベル
    this.add.text(GAME_WIDTH / 2, 30,
      `🌐  ONLINE  ${this.isHost ? '(HOST)' : '(GUEST)'}`, {
        fontSize: '13px', color: '#44aaff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(60);

    this.add.text(14, 30, '← 切断', {
      fontSize: '14px', color: '#ff6666', backgroundColor: '#222222',
      padding: { x: 6, y: 3 },
    }).setDepth(60).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.start('MenuScene'); });

    // ネットワーク受信
    this.peer.onMessage      = (msg) => this.handleMessage(msg);
    this.peer.onDisconnected = () => { if (!this.gameOver) this.showDisconnected(); };
  }

  // ─── メインループ ─────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    if (this.gameOver) return;
    const dt = delta / 1000;

    this.hitStop.update();

    // ローカル移動
    if (!this.hitStop.active) {
      if (this.isDesktop) {
        let dx = 0, dy = 0;
        if (this.wasd.left.isDown  || this.cursors.left.isDown)  dx -= 1;
        if (this.wasd.right.isDown || this.cursors.right.isDown) dx += 1;
        if (this.wasd.up.isDown    || this.cursors.up.isDown)    dy -= 1;
        if (this.wasd.down.isDown  || this.cursors.down.isDown)  dy += 1;
        this.localPlayer.moveWithVector(dx, dy);
      } else if (this.joystick) {
        const axis = this.joystick.getAxis();
        this.localPlayer.moveWithVector(axis.x, axis.y);
      }
    } else {
      this.localPlayer.setVelocity(0, 0);
    }

    this.localPlayer.update(dt);

    // 毎フレーム座標と HP を送信
    this.peer.send({
      type: 'pos',
      x:    this.localPlayer.x,
      y:    this.localPlayer.y,
      hp:   this.localPlayer.hp,
    });

    // 弾更新
    this.updateLocalProjectiles(dt);
    this.updateRemoteProjectiles(dt);

    // リモートスプライトの HP バー描画
    this.drawRemoteHpBar();

    // HUD（ローカル=自分、リモート=相手）
    this.hud.update(
      this.localPlayer.hp, this.localPlayer.maxHp,
      this.remoteHp,       PLAYER_CONFIG.maxHp,
      this.localWeapon,
      this.localPlayer.cooldownRatio,
    );
  }

  // ─── 発射（ローカル） ─────────────────────────────────────────────────────
  private fireLocal(tx: number, ty: number) {
    const before = this.localPellets.length + this.localLasers.length + this.localBeams.length;
    this.localPlayer.fire(tx, ty, {
      pellets: this.localPellets,
      lasers:  this.localLasers,
      beams:   this.localBeams,
    });
    const after = this.localPellets.length + this.localLasers.length + this.localBeams.length;
    if (after > before) {
      // 実際に発射されたら角度を送信
      const angle = Math.atan2(ty - this.localPlayer.y, tx - this.localPlayer.x);
      this.peer.send({ type: 'fire', angle });
    }
  }

  // ─── ネットワーク受信 ─────────────────────────────────────────────────────
  private handleMessage(msg: NetMsg) {
    switch (msg.type) {

      case 'pos':
        this.remoteX  = msg.x;
        this.remoteY  = msg.y;
        this.remoteHp = msg.hp;
        this.remoteSprite.setPosition(msg.x, msg.y);
        break;

      case 'fire':
        // リモートが発射 → 視覚再現（命中判定なし）
        this.createRemoteProjectile(msg.angle);
        break;

      case 'hit':
        // 自分が被弾（相手側で判定済み）→ エフェクトのみ受け取る
        this.localPlayer.takeDamage(msg.amount, msg.weapon);
        if (!this.localPlayer.isAlive) {
          this.peer.send({ type: 'gameOver' });
          this.endGame(false);
        }
        break;

      case 'gameOver':
        this.endGame(true);
        break;
    }
  }

  // ─── リモート弾の視覚再現 ─────────────────────────────────────────────────
  private createRemoteProjectile(angle: number) {
    const x = this.remoteX;
    const y = this.remoteY;

    if (this.remoteWeapon === 'laser') {
      const cfg = WEAPON_CONFIG.laser;
      // damage=0：視覚のみ
      this.remoteLasers.push(
        new LaserBolt(this, x, y, angle, cfg.speed, 0, 'remote'),
      );
    } else if (this.remoteWeapon === 'beam') {
      const cfg = WEAPON_CONFIG.beam;
      this.remoteBeams.push(
        new BeamProjectile(this, x, y, angle, cfg.speed, cfg.width, cfg.height, 0, cfg.maxHits, 'remote'),
      );
    }
    // shotgun は弾数が多く再現コストが高いため、エフェクト無しで省略
    // （命中判定はリモート側が行い hit メッセージで通知）
  }

  // ─── ローカル弾の更新・命中判定 ──────────────────────────────────────────
  private updateLocalProjectiles(dt: number) {
    const tr = PLAYER_CONFIG.radius;

    // Pellets（ショットガン）
    for (let i = this.localPellets.length - 1; i >= 0; i--) {
      const p = this.localPellets[i];
      if (!p.active) { this.localPellets.splice(i, 1); continue; }
      p.update();

      if (this.circleOverlap(p.x, p.y, 4, this.remoteX, this.remoteY, tr)) {
        const dmg = p.damage;
        p.destroy();
        this.localPellets.splice(i, 1);
        this.sendHit(dmg, 'shotgun');
      }
    }

    // LaserBolts
    for (let i = this.localLasers.length - 1; i >= 0; i--) {
      const lb = this.localLasers[i];
      lb.update(dt);

      // 壁反射で生まれた子レーザーを追加
      for (const sp of lb.pendingSpawn) {
        this.localLasers.push(new LaserBolt(
          this, sp.x, sp.y, sp.angle, lb.speed, lb.damage, lb.ownerTag, sp.generation,
        ));
      }
      lb.pendingSpawn = [];

      if (lb.dead) { this.localLasers.splice(i, 1); continue; }

      if (!lb.hasHit && lb.hits(this.remoteX, this.remoteY, tr)) {
        lb.hasHit = true;
        this.sendHit(lb.damage, 'laser');
        lb.destroy();
        this.localLasers.splice(i, 1);
      }
    }

    // Beams
    for (let i = this.localBeams.length - 1; i >= 0; i--) {
      const beam = this.localBeams[i];
      beam.update(dt);
      if (beam.dead) { this.localBeams.splice(i, 1); continue; }

      if (!beam.hitTargets.has(this.remoteSprite) && beam.hits(this.remoteX, this.remoteY, tr)) {
        beam.hitTargets.add(this.remoteSprite);
        this.sendHit(beam.damage, 'beam');
        if (beam.hitTargets.size >= beam.maxHits) {
          beam.destroy();
          this.localBeams.splice(i, 1);
        }
      }
    }
  }

  private sendHit(amount: number, weapon: WeaponType) {
    this.peer.send({ type: 'hit', amount, weapon });
    // 攻撃側でもポップアップ表示
    DamagePopup.show(this, this.remoteX, this.remoteY - 30, amount);
    // リモートHPをローカルでも更新（pos で正確値が来るまでの暫定表示）
    this.remoteHp = Math.max(0, this.remoteHp - amount);
    if (this.remoteHp <= 0) this.endGame(true);
  }

  // ─── リモート弾の更新（視覚のみ） ────────────────────────────────────────
  private updateRemoteProjectiles(dt: number) {
    for (let i = this.remoteLasers.length - 1; i >= 0; i--) {
      this.remoteLasers[i].update(dt);
      if (this.remoteLasers[i].dead) this.remoteLasers.splice(i, 1);
    }
    for (let i = this.remoteBeams.length - 1; i >= 0; i--) {
      this.remoteBeams[i].update(dt);
      if (this.remoteBeams[i].dead) this.remoteBeams.splice(i, 1);
    }
  }

  // ─── リモートプレイヤーの HP バー ─────────────────────────────────────────
  private remoteHpGraphics?: Phaser.GameObjects.Graphics;

  private drawRemoteHpBar() {
    if (!this.remoteHpGraphics) {
      this.remoteHpGraphics = this.add.graphics().setDepth(25);
    }
    const g = this.remoteHpGraphics;
    g.clear();
    const bw = 60, bh = 8;
    const bx = this.remoteX - bw / 2;
    const by = this.remoteY - 48;
    g.fillStyle(0x333333);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0xff4444);
    g.fillRect(bx, by, bw * Math.max(0, this.remoteHp / PLAYER_CONFIG.maxHp), bh);
  }

  // ─── ゲーム終了 ──────────────────────────────────────────────────────────
  private endGame(localWon: boolean) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.localPlayer.setVelocity(0, 0);

    const msg   = localWon ? 'YOU WIN! 🎉' : 'YOU LOSE...';
    const color = localWon ? '#44ff88'     : '#ff4444';

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, msg, {
      fontSize: '48px', color, stroke: '#000', strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(80);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'MENU に戻る', {
      fontSize: '22px', color: '#ffffff', backgroundColor: '#333333',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.start('MenuScene'); });
  }

  private showDisconnected() {
    this.gameOver = true;
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '接続が切れました 😢', {
      fontSize: '26px', color: '#ff6666', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(80);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'MENU に戻る', {
      fontSize: '20px', color: '#ffffff', backgroundColor: '#333333',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.start('MenuScene'); });
  }

  private circleOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
    const dx = x1 - x2, dy = y1 - y2;
    return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
  }

  private cleanup() {
    [...this.localLasers,  ...this.remoteLasers ].forEach(l => l.destroy());
    [...this.localBeams,   ...this.remoteBeams  ].forEach(b => b.destroy());
    this.remoteHpGraphics?.destroy();
    this.joystick?.destroy();
    this.hud.destroy();
    this.peer.destroy();
  }

  shutdown() { this.cleanup(); }
}
