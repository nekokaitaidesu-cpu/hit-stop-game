import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { WeaponType, GameMode, CpuLevel } from '../config';

export class MenuScene extends Phaser.Scene {
  private selectedWeapon: WeaponType = 'shotgun';
  private selectedMode: GameMode = 'training';
  private selectedLevel: CpuLevel = 1;
  private levelSection!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = GAME_WIDTH / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2e, 0x0a0a2e, 0x1a1a4e, 0x1a1a4e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── タイトル ─────────────────────────────────────────────
    this.add.text(cx, 72, 'HIT STOP', {
      fontSize: '48px', color: '#ffffff', stroke: '#4488ff',
      strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(cx, 126, 'GAME', {
      fontSize: '26px', color: '#4488ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // ── 操作説明 ─────────────────────────────────────────────
    this.add.text(cx, 140, 'PC: WASDキーで移動 ／ クリックした方向に射撃', {
      fontSize: '11px', color: '#556677',
    }).setOrigin(0.5);
    this.add.text(cx, 154, 'スマホ: 左下スティックで移動 ／ タップした方向に射撃', {
      fontSize: '11px', color: '#556677',
    }).setOrigin(0.5);

    // ── 🌐 ONLINE BATTLE（メインコンテンツ、GAME直下） ──────
    this.add.graphics()
      .lineStyle(1, 0x223355, 1)
      .lineBetween(30, 182, GAME_WIDTH - 30, 182);

    const onlineBtn = this.add.text(cx, 212, '🌐  ONLINE BATTLE', {
      fontSize: '24px', color: '#44ccff', backgroundColor: '#001a33',
      padding: { x: 28, y: 14 }, fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.add.text(cx, 252, '友達と 1 vs 1 でオンライン対戦！', {
      fontSize: '13px', color: '#4488aa',
    }).setOrigin(0.5);

    onlineBtn.on('pointerover', () => onlineBtn.setBackgroundColor('#002a4d'));
    onlineBtn.on('pointerout',  () => onlineBtn.setBackgroundColor('#001a33'));
    onlineBtn.on('pointerdown', () => this.scene.start('OnlineLobbyScene'));

    this.add.graphics()
      .lineStyle(1, 0x223355, 1)
      .lineBetween(30, 274, GAME_WIDTH - 30, 274);

    // ── WEAPON ──────────────────────────────────────────────
    this.add.text(cx, 296, '── WEAPON ──', {
      fontSize: '15px', color: '#aaaaff',
    }).setOrigin(0.5);

    const weapons: WeaponType[] = ['shotgun', 'laser', 'beam'];
    const weaponLabels = ['🔫  SHOTGUN', '⚡  LASER', '💜  GIANT BEAM'];
    const weaponBtns: Phaser.GameObjects.Text[] = [];

    weapons.forEach((w, i) => {
      const btn = this.add.text(cx, 332 + i * 54, weaponLabels[i], {
        fontSize: '19px',
        color:           w === this.selectedWeapon ? '#ffdd44' : '#888888',
        backgroundColor: w === this.selectedWeapon ? '#333300' : '#111111',
        padding: { x: 18, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectedWeapon = w;
        weaponBtns.forEach((b, j) => {
          b.setColor(weapons[j] === this.selectedWeapon ? '#ffdd44' : '#888888');
          b.setBackgroundColor(weapons[j] === this.selectedWeapon ? '#333300' : '#111111');
        });
      });
      weaponBtns.push(btn);
    });

    // ── MODE ────────────────────────────────────────────────
    this.add.text(cx, 506, '── MODE ──', {
      fontSize: '15px', color: '#aaaaff',
    }).setOrigin(0.5);

    const modes: GameMode[] = ['training', 'battle'];
    const modeLabels = ['🎯  TRAINING', '🤖  CPU BATTLE'];
    const modeBtns: Phaser.GameObjects.Text[] = [];

    modes.forEach((m, i) => {
      const btn = this.add.text(cx, 540 + i * 54, modeLabels[i], {
        fontSize: '19px',
        color:           m === this.selectedMode ? '#44ffaa' : '#888888',
        backgroundColor: m === this.selectedMode ? '#003322' : '#111111',
        padding: { x: 18, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectedMode = m;
        modeBtns.forEach((b, j) => {
          b.setColor(modes[j] === this.selectedMode ? '#44ffaa' : '#888888');
          b.setBackgroundColor(modes[j] === this.selectedMode ? '#003322' : '#111111');
        });
        this.levelSection.setVisible(this.selectedMode === 'battle');
      });
      modeBtns.push(btn);
    });

    // ── START ────────────────────────────────────────────────
    const startBtn = this.add.text(cx, 652, '▶  START  ◀', {
      fontSize: '25px', color: '#000000', backgroundColor: '#44ff88',
      padding: { x: 28, y: 13 }, fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setBackgroundColor('#88ffaa'));
    startBtn.on('pointerout',  () => startBtn.setBackgroundColor('#44ff88'));
    startBtn.on('pointerdown', () => {
      const sceneKey = this.selectedMode === 'training' ? 'TrainingScene' : 'BattleScene';
      this.scene.start(sceneKey, {
        weapon: this.selectedWeapon,
        mode:   this.selectedMode,
        level:  this.selectedLevel,
      });
    });

    // ── CPU LEVEL（battle のときだけ・START下） ──────────────
    this.levelSection = this.add.container(0, 0);

    const lvLabel = this.add.text(cx, 714, '── CPU LEVEL ──', {
      fontSize: '15px', color: '#ffaaaa',
    }).setOrigin(0.5);
    this.levelSection.add(lvLabel);

    const levels: CpuLevel[] = [1, 2, 3];
    const levelLabels = ['⭐ Lv.1  かんたん', '⭐⭐ Lv.2  ふつう', '⭐⭐⭐ Lv.3  むずかしい'];
    const lc = { sel: '#ff6666', selBg: '#330000', def: '#888888', defBg: '#111111' };
    const levelBtns: Phaser.GameObjects.Text[] = [];

    levels.forEach((lv, i) => {
      const btn = this.add.text(cx, 746 + i * 44, levelLabels[i], {
        fontSize: '15px',
        color:           lv === this.selectedLevel ? lc.sel : lc.def,
        backgroundColor: lv === this.selectedLevel ? lc.selBg : lc.defBg,
        padding: { x: 14, y: 7 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectedLevel = lv;
        levelBtns.forEach((b, j) => {
          const a = levels[j] === this.selectedLevel;
          b.setColor(a ? lc.sel : lc.def);
          b.setBackgroundColor(a ? lc.selBg : lc.defBg);
        });
      });
      levelBtns.push(btn);
      this.levelSection.add(btn);
    });

    this.levelSection.setVisible(this.selectedMode === 'battle');

  }
}
