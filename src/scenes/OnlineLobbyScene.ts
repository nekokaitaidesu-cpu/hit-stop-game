import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { WeaponType } from '../config';
import { PeerManager } from '../network/PeerManager';
import { generateObstacles } from '../network/generateObstacles';
import type { ObstacleDef } from '../objects/Obstacle';

export class OnlineLobbyScene extends Phaser.Scene {
  private peer: PeerManager | null = null;
  private selectedWeapon: WeaponType = 'shotgun';
  private statusText!: Phaser.GameObjects.Text;
  private codeDisplayText!: Phaser.GameObjects.Text; // ホストが表示するコード
  private inputDigits: string[] = [];
  private inputText!: Phaser.GameObjects.Text;
  private numpadContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'OnlineLobbyScene' });
  }

  create() {
    // シーン再開時に前回の入力をリセット
    this.inputDigits = [];

    const cx = GAME_WIDTH / 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2e, 0x0a0a2e, 0x1a1a4e, 0x1a1a4e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // タイトル
    this.add.text(cx, 70, '🌐  ONLINE BATTLE', {
      fontSize: '32px', color: '#ffffff', stroke: '#4488ff',
      strokeThickness: 5, fontStyle: 'bold',
    }).setOrigin(0.5);

    // ── 武器選択 ──────────────────────────────────────────────
    this.add.text(cx, 135, '── 武器を選ぶ ──', { fontSize: '15px', color: '#aaaaff' }).setOrigin(0.5);

    const weapons: WeaponType[] = ['shotgun', 'laser', 'beam'];
    const wLabels = ['🔫 SG', '⚡ LG', '💜 BEAM'];
    const wBtns: Phaser.GameObjects.Text[] = [];

    weapons.forEach((w, i) => {
      const btn = this.add.text(85 + i * 155, 175, wLabels[i], {
        fontSize: '17px',
        color:           w === this.selectedWeapon ? '#ffdd44' : '#888888',
        backgroundColor: w === this.selectedWeapon ? '#333300' : '#111111',
        padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectedWeapon = w;
        wBtns.forEach((b, j) => {
          const sel = weapons[j] === this.selectedWeapon;
          b.setColor(sel ? '#ffdd44' : '#888888');
          b.setBackgroundColor(sel ? '#333300' : '#111111');
        });
      });
      wBtns.push(btn);
    });

    // ── ホスト：部屋を作る ────────────────────────────────────
    this.add.graphics()
      .lineStyle(1, 0x334466, 0.6)
      .lineBetween(20, 220, GAME_WIDTH - 20, 220);

    this.add.text(cx, 240, '部屋を作る', {
      fontSize: '20px', color: '#44ffaa', fontStyle: 'bold',
    }).setOrigin(0.5);

    const createBtn = this.add.text(cx, 285, '🏠  CREATE ROOM', {
      fontSize: '19px', color: '#000', backgroundColor: '#44ffaa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    createBtn.on('pointerdown', () => this.startHost(createBtn));

    this.codeDisplayText = this.add.text(cx, 335, '', {
      fontSize: '34px', color: '#ffdd44', stroke: '#000',
      strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5);

    // ── ゲスト：部屋に入る ────────────────────────────────────
    this.add.graphics()
      .lineStyle(1, 0x334466, 0.6)
      .lineBetween(20, 375, GAME_WIDTH - 20, 375);

    this.add.text(cx, 395, '部屋に入る', {
      fontSize: '20px', color: '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 4桁入力表示
    this.inputText = this.add.text(cx, 440, '[ _ _ _ _ ]', {
      fontSize: '28px', color: '#aaaaaa', backgroundColor: '#111122',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);

    // テンキー
    this.numpadContainer = this.add.container(0, 0);
    this.buildNumpad();

    // JOIN ボタン
    const joinBtn = this.add.text(cx, 760, '🚪  JOIN ROOM', {
      fontSize: '19px', color: '#000', backgroundColor: '#ff8888',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    joinBtn.on('pointerdown', () => {
      if (this.inputDigits.length === 4) this.startJoin();
    });

    // ステータス表示
    this.statusText = this.add.text(cx, 808, '', {
      fontSize: '14px', color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // PC：キーボードでも数字入力可能
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      if (ev.key >= '0' && ev.key <= '9') this.appendDigit(ev.key);
      else if (ev.key === 'Backspace') this.deleteDigit();
    });

    // 戻るボタン
    this.add.text(14, 30, '← MENU', {
      fontSize: '14px', color: '#aaaaaa', backgroundColor: '#222222',
      padding: { x: 8, y: 4 },
    }).setDepth(60).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.peer?.destroy(); this.scene.start('MenuScene'); });
  }

  // ── テンキー ───────────────────────────────────────────────────────────────
  private buildNumpad() {
    const startY = 490;
    const digits = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];
    const cols = 3;
    const btnW = 100, btnH = 44, gapX = 20, gapY = 10;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = (GAME_WIDTH - totalW) / 2;

    digits.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnW + gapX) + btnW / 2;
      const y = startY + row * (btnH + gapY) + btnH / 2;

      const isAction = d === '⌫' || d === '✓';
      const btn = this.add.text(x, y, d, {
        fontSize: '22px',
        color:           isAction ? '#ffdd44' : '#ffffff',
        backgroundColor: isAction ? '#332200'  : '#223344',
        padding: { x: 0, y: 0 },
        fixedWidth:  btnW,
        fixedHeight: btnH,
        align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover',  () => btn.setBackgroundColor(isAction ? '#554400' : '#335566'));
      btn.on('pointerout',   () => btn.setBackgroundColor(isAction ? '#332200' : '#223344'));
      btn.on('pointerdown',  () => {
        if (d === '⌫') this.deleteDigit();
        else if (d === '✓') { if (this.inputDigits.length === 4) this.startJoin(); }
        else this.appendDigit(d);
      });

      this.numpadContainer.add(btn);
    });
  }

  private appendDigit(d: string) {
    if (this.inputDigits.length >= 4) return;
    this.inputDigits.push(d);
    this.refreshInput();
  }

  private deleteDigit() {
    this.inputDigits.pop();
    this.refreshInput();
  }

  private refreshInput() {
    const filled = this.inputDigits.join(' ');
    const blanks = '_ '.repeat(4 - this.inputDigits.length).trim();
    const display = [filled, blanks].filter(Boolean).join(' ');
    this.inputText.setText(`[ ${display} ]`);
    this.inputText.setColor(this.inputDigits.length === 4 ? '#ffffff' : '#aaaaaa');
  }

  // ── ホスト処理 ─────────────────────────────────────────────────────────────
  private startHost(createBtn: Phaser.GameObjects.Text) {
    createBtn.setInteractive(false).setAlpha(0.5);
    this.setStatus('接続を準備中...', '#ffffff');

    const peer = new PeerManager(true);
    this.peer = peer;
    // ホスト側でマップの障害物を決定（ゲストにも送信して共有）
    const obstacles: ObstacleDef[] = generateObstacles();

    peer.onOpen = () => {
      const code = peer.getRoomCode();
      this.codeDisplayText.setText(`CODE:  ${code}`);
      this.setStatus('友達にコードを教えよう！待機中...', '#44ffaa');
    };

    peer.onError = (err) => {
      this.setStatus(`エラー: ${err.message}`, '#ff4444');
      createBtn.setInteractive(true).setAlpha(1);
    };

    peer.onConnected = () => {
      this.setStatus('接続完了！', '#44ff88');
      // 障害物データも一緒に送る
      peer.send({ type: 'ready', weapon: this.selectedWeapon, obstacles });
    };

    peer.onMessage = (msg) => {
      if (msg.type === 'ready') {
        this.time.delayedCall(300, () => {
          this.scene.start('OnlineBattleScene', {
            peer,
            localWeapon:  this.selectedWeapon,
            remoteWeapon: msg.weapon,
            isHost:       true,
            obstacles,            // ホストが生成したものをそのまま渡す
          });
        });
      }
    };
  }

  // ── ゲスト処理 ─────────────────────────────────────────────────────────────
  private startJoin() {
    const code = this.inputDigits.join('');
    this.setStatus(`${code} に接続中...`, '#ffffff');
    this.numpadContainer.setAlpha(0.4);

    const peer = new PeerManager(false);
    this.peer = peer;

    peer.onOpen = () => peer.connect(code);

    peer.onError = (err) => {
      this.setStatus(`接続失敗: ${err.message}`, '#ff4444');
      this.numpadContainer.setAlpha(1);
    };

    peer.onConnected = () => {
      this.setStatus('接続完了！', '#44ff88');
      peer.send({ type: 'ready', weapon: this.selectedWeapon });
    };

    peer.onMessage = (msg) => {
      if (msg.type === 'ready') {
        this.time.delayedCall(300, () => {
          this.scene.start('OnlineBattleScene', {
            peer,
            localWeapon:  this.selectedWeapon,
            remoteWeapon: msg.weapon,
            isHost:       false,
            obstacles:    msg.obstacles ?? [], // ホストから受け取った障害物を使う
          });
        });
      }
    };
  }

  private setStatus(msg: string, color = '#ffffff') {
    this.statusText.setText(msg).setColor(color);
  }
}
