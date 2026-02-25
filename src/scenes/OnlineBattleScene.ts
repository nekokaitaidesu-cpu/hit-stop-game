import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_CONFIG, WEAPON_CONFIG, COLORS } from '../config';
import type { WeaponType } from '../config';
import { Player } from '../objects/Player';
import { ObstacleGroup } from '../objects/Obstacle';
import type { ObstacleDef } from '../objects/Obstacle';
import { HitStop } from '../effects/HitStop';
import { ScreenShake } from '../effects/ScreenShake';
import { HUDDisplay } from '../ui/HUDDisplay';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { Pellet } from '../projectiles/Pellet';
import { LaserBolt } from '../projectiles/LaserBolt';
import { BeamProjectile } from '../projectiles/BeamProjectile';
import { DamagePopup } from '../ui/DamagePopup';
import type { PeerManager, NetMsg } from '../network/PeerManager';
import { generateObstacles } from '../network/generateObstacles';

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
  private obstacleData: ObstacleDef[] = [];
  private obstacles!: ObstacleGroup;

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
  private remotePellets: Pellet[]          = [];
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

  // ── 再戦 ─────────────────────────────────────────────────────────────────
  /** WIN側が次の対戦で使う武器（結果画面で選択可） */
  private rematchWeapon: WeaponType = 'shotgun';
  /** LOSE側が送信した rematch メッセージを WIN 側が受け取った時点での武器（再戦開始に使う） */
  private loseRematchWeapon: WeaponType = 'shotgun';

  constructor() {
    super({ key: 'OnlineBattleScene' });
  }

  init(data: { peer: PeerManager; localWeapon: WeaponType; remoteWeapon: WeaponType; isHost: boolean; obstacles?: ObstacleDef[] }) {
    this.peer         = data.peer;
    this.localWeapon  = data.localWeapon;
    this.remoteWeapon = data.remoteWeapon;
    this.isHost       = data.isHost;
    this.obstacleData = data.obstacles ?? [];
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

    // 障害物（ホスト・ゲスト共通のデータで生成）
    this.obstacles = new ObstacleGroup(this, this.obstacleData);

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

    // ローカルプレイヤーと障害物の衝突
    this.obstacles.addCollider(this.localPlayer);

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
      .on('pointerdown', () => { this.cleanup(true); this.scene.start('MenuScene'); });

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

      case 'returnToMenu':
        // 相手がメニューに戻った → 自分も即メニューへ
        this.cleanup(true);
        this.scene.start('MenuScene');
        break;

      case 'rematch':
        // WIN側が受信 → 返信して再戦開始
        // startRematch(localWeapon, remoteWeapon, obstacles)
        // localWeapon = 自分(WIN)の武器 = this.rematchWeapon
        // remoteWeapon = 相手(LOSE)の武器 = msg.weapon
        if (this.isHost) {
          // HOST(WIN): 障害物を新規生成して rematchAccept に含める
          const newObs = generateObstacles();
          this.obstacleData = newObs;
          this.peer.send({ type: 'rematchAccept', weapon: this.rematchWeapon, obstacles: newObs });
          this.startRematch(this.rematchWeapon, msg.weapon, newObs);
        } else {
          // GUEST(WIN): HOST(LOSE)が生成した障害物を使う
          this.peer.send({ type: 'rematchAccept', weapon: this.rematchWeapon });
          this.startRematch(this.rematchWeapon, msg.weapon, msg.obstacles ?? []);
        }
        break;

      case 'rematchAccept':
        // LOSE側が受信 → 再戦開始
        if (this.isHost) {
          // HOST(LOSE): 自分が生成した障害物を使う
          this.startRematch(this.loseRematchWeapon, msg.weapon, this.obstacleData);
        } else {
          // GUEST(LOSE): HOST(WIN)が生成した障害物を使う
          this.startRematch(this.loseRematchWeapon, msg.weapon, msg.obstacles ?? []);
        }
        break;
    }
  }

  // ─── リモート弾の視覚再現（全武器対応・damage=0） ────────────────────────
  private createRemoteProjectile(angle: number) {
    const x = this.remoteX;
    const y = this.remoteY;

    if (this.remoteWeapon === 'shotgun') {
      const cfg = WEAPON_CONFIG.shotgun;
      const spread = Math.PI / 5;
      for (let i = 0; i < cfg.pellets; i++) {
        const a = angle - spread / 2 + (spread / (cfg.pellets - 1)) * i;
        this.remotePellets.push(
          new Pellet(this, x, y, Math.cos(a) * cfg.speed, Math.sin(a) * cfg.speed, 0, 'remote'),
        );
      }
    } else if (this.remoteWeapon === 'laser') {
      const cfg = WEAPON_CONFIG.laser;
      this.remoteLasers.push(
        new LaserBolt(this, x, y, angle, cfg.speed, 0, 'remote'),
      );
    } else if (this.remoteWeapon === 'beam') {
      const cfg = WEAPON_CONFIG.beam;
      this.remoteBeams.push(
        new BeamProjectile(this, x, y, angle, cfg.speed, cfg.width, cfg.height, 0, cfg.maxHits, 'remote'),
      );
    }
  }

  // ─── ローカル弾の更新・命中判定 ──────────────────────────────────────────
  private updateLocalProjectiles(dt: number) {
    const tr = PLAYER_CONFIG.radius;

    // Pellets（ショットガン）
    for (let i = this.localPellets.length - 1; i >= 0; i--) {
      const p = this.localPellets[i];
      if (!p.active) { this.localPellets.splice(i, 1); continue; }
      p.update();

      if (this.obstacles.circleOverlaps(p.x, p.y, 4)) {
        p.destroy(); this.localPellets.splice(i, 1); continue;
      }
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

      // 障害物反射
      if (this.obstacles.containsPoint(lb.x, lb.y)) {
        if (lb.generation < 1) {
          const horizontal = Math.abs(lb.vx) > Math.abs(lb.vy);
          const reflectAngle = horizontal ? Math.PI - lb.angle : -lb.angle;
          const SPREAD = Math.PI / 6;
          [0, SPREAD, -SPREAD].forEach(da => {
            this.localLasers.push(new LaserBolt(this, lb.x, lb.y, reflectAngle + da, lb.speed, lb.damage, lb.ownerTag, 1));
          });
        }
        lb.destroy();
        this.localLasers.splice(i, 1);
        continue;
      }

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

  // ─── リモート弾の更新（視覚のみ・命中判定なし） ─────────────────────────
  private updateRemoteProjectiles(dt: number) {
    // ── リモートペレット（ショットガン）：障害物に当たったら消える
    for (let i = this.remotePellets.length - 1; i >= 0; i--) {
      const p = this.remotePellets[i];
      if (!p.active) { this.remotePellets.splice(i, 1); continue; }
      p.update();
      if (p.active && this.obstacles.circleOverlaps(p.x, p.y, 4)) {
        p.destroy();
        this.remotePellets.splice(i, 1);
      }
    }

    // ── リモートレーザー：壁反射・障害物反射をローカルと同じロジックで再現
    for (let i = this.remoteLasers.length - 1; i >= 0; i--) {
      const lb = this.remoteLasers[i];
      lb.update(dt);

      // 壁反射で生まれた子レーザーを追加
      for (const sp of lb.pendingSpawn) {
        this.remoteLasers.push(new LaserBolt(
          this, sp.x, sp.y, sp.angle, lb.speed, 0, 'remote', sp.generation,
        ));
      }
      lb.pendingSpawn = [];

      if (lb.dead) { this.remoteLasers.splice(i, 1); continue; }

      // 障害物反射（ローカルと同じ挙動）
      if (this.obstacles.containsPoint(lb.x, lb.y)) {
        if (lb.generation < 1) {
          const horizontal = Math.abs(lb.vx) > Math.abs(lb.vy);
          const reflectAngle = horizontal ? Math.PI - lb.angle : -lb.angle;
          const SPREAD = Math.PI / 6;
          [0, SPREAD, -SPREAD].forEach(da => {
            this.remoteLasers.push(new LaserBolt(this, lb.x, lb.y, reflectAngle + da, lb.speed, 0, 'remote', 1));
          });
        }
        lb.destroy();
        this.remoteLasers.splice(i, 1);
        continue;
      }
    }

    // ── リモートビーム
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

    const cx    = GAME_WIDTH / 2;
    const baseY = GAME_HEIGHT / 2 - 120;

    // 勝敗テキスト
    const resultMsg   = localWon ? 'YOU WIN! 🎉' : 'YOU LOSE...';
    const resultColor = localWon ? '#44ff88'     : '#ff4444';
    this.add.text(cx, baseY, resultMsg, {
      fontSize: '46px', color: resultColor, stroke: '#000',
      strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(80);

    if (localWon) {
      this.buildWinRematchUI(cx, baseY);
    } else {
      this.buildLoseRematchUI(cx, baseY);
    }

    // MENU に戻るボタン（共通・最下部）
    this.add.text(cx, baseY + 320, 'MENUに戻る', {
      fontSize: '20px', color: '#aaaaaa', backgroundColor: '#222222',
      padding: { x: 18, y: 9 },
    }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.peer.send({ type: 'returnToMenu' });
        this.cleanup(true);
        this.scene.start('MenuScene');
      });
  }

  // ─── WIN側 UI ─────────────────────────────────────────────────────────────
  private buildWinRematchUI(cx: number, baseY: number) {
    this.rematchWeapon = this.localWeapon; // 現在の武器をデフォルトに

    this.add.text(cx, baseY + 70, '再戦を受け付けています...', {
      fontSize: '17px', color: '#ffdd44',
    }).setOrigin(0.5).setDepth(80);

    this.add.text(cx, baseY + 115, '次の対戦で使う武器：', {
      fontSize: '13px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(80);

    const weapons: WeaponType[] = ['shotgun', 'laser', 'beam'];
    const wLabels = ['🔫 SG', '⚡ LG', '💜 BEAM'];
    const wBtns: Phaser.GameObjects.Text[] = [];

    weapons.forEach((w, i) => {
      const btn = this.add.text(78 + i * 150, baseY + 155, wLabels[i], {
        fontSize: '15px',
        color:           w === this.rematchWeapon ? '#ffdd44' : '#888888',
        backgroundColor: w === this.rematchWeapon ? '#333300' : '#111111',
        padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.rematchWeapon = w;
        wBtns.forEach((b, j) => {
          b.setColor(weapons[j] === this.rematchWeapon ? '#ffdd44' : '#888888');
          b.setBackgroundColor(weapons[j] === this.rematchWeapon ? '#333300' : '#111111');
        });
      });
      wBtns.push(btn);
    });
  }

  // ─── LOSE側 UI ────────────────────────────────────────────────────────────
  private buildLoseRematchUI(cx: number, baseY: number) {
    // 「再戦する」ボタン
    const rematchBtn = this.add.text(cx, baseY + 80, '🔄  再戦する', {
      fontSize: '22px', color: '#000000', backgroundColor: '#ffaa00',
      padding: { x: 22, y: 11 }, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true });

    rematchBtn.on('pointerdown', () => {
      rematchBtn.setInteractive(false).setAlpha(0.5);
      this.buildLoseWeaponPicker(cx, baseY);
    });
  }

  private buildLoseWeaponPicker(cx: number, baseY: number) {
    this.add.text(cx, baseY + 135, '次の対戦で使う武器を選んでください', {
      fontSize: '13px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(80);

    const weapons: WeaponType[] = ['shotgun', 'laser', 'beam'];
    const wLabels = ['🔫 SG', '⚡ LG', '💜 BEAM'];
    let sent = false;

    weapons.forEach((w, i) => {
      const btn = this.add.text(78 + i * 150, baseY + 175, wLabels[i], {
        fontSize: '15px', color: '#ffffff', backgroundColor: '#223344',
        padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setDepth(80).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => { if (!sent) btn.setBackgroundColor('#335566'); });
      btn.on('pointerout',  () => { if (!sent) btn.setBackgroundColor('#223344'); });

      btn.on('pointerdown', () => {
        if (sent) return;
        sent = true;
        this.loseRematchWeapon = w;

        // ボタンを選択状態に固定
        weapons.forEach((_, j) => {
          // btnへの参照は closure の btn ではなく index で管理する必要があるため
          // 選ばれたものだけ色変え・それ以外は暗くする処理は下記で行う
        });
        btn.setColor('#ffdd44').setBackgroundColor('#333300');

        // 再戦リクエスト送信
        if (this.isHost) {
          const newObs = generateObstacles();
          this.obstacleData = newObs;
          this.peer.send({ type: 'rematch', weapon: w, obstacles: newObs });
        } else {
          this.peer.send({ type: 'rematch', weapon: w });
        }

        this.add.text(cx, baseY + 225, '相手の承認待ち...', {
          fontSize: '14px', color: '#44ffaa',
        }).setOrigin(0.5).setDepth(80);
      });
    });
  }

  // ─── 再戦開始 ─────────────────────────────────────────────────────────────
  private startRematch(localWeapon: WeaponType, remoteWeapon: WeaponType, obstacles: ObstacleDef[]) {
    this.cleanup(false); // peer は維持したまま画面をクリーン
    this.scene.start('OnlineBattleScene', {
      peer: this.peer,
      localWeapon,
      remoteWeapon,
      isHost: this.isHost,
      obstacles,
    });
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
      .on('pointerdown', () => { this.cleanup(true); this.scene.start('MenuScene'); });
  }

  private circleOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
    const dx = x1 - x2, dy = y1 - y2;
    return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
  }

  private cleanup(destroyPeer = true) {
    this.remotePellets.filter(p => p.active).forEach(p => p.destroy());
    [...this.localLasers,  ...this.remoteLasers ].forEach(l => l.destroy());
    [...this.localBeams,   ...this.remoteBeams  ].forEach(b => b.destroy());
    this.remoteHpGraphics?.destroy();
    this.joystick?.destroy();
    this.hud?.destroy();
    this.obstacles?.destroy();
    if (destroyPeer) this.peer.destroy();
  }

  shutdown() { this.cleanup(true); }
}
