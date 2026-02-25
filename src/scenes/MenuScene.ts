import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { WeaponType, GameMode, CpuLevel } from '../config';

export class MenuScene extends Phaser.Scene {
  private selectedWeapon: WeaponType = 'shotgun';
  private selectedMode: GameMode = 'training';
  private selectedLevel: CpuLevel = 1;

  // CPU レベル選択UI（モードが battle のときだけ表示）
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

    // Title
    this.add.text(cx, 90, 'HIT STOP', {
      fontSize: '52px', color: '#ffffff', stroke: '#4488ff',
      strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(cx, 150, 'GAME', {
      fontSize: '28px', color: '#4488ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // ── WEAPON ──────────────────────────────────────────────
    this.add.text(cx, 220, '── WEAPON ──', {
      fontSize: '16px', color: '#aaaaff',
    }).setOrigin(0.5);

    const weapons: WeaponType[] = ['shotgun', 'laser', 'beam'];
    const weaponLabels = ['🔫  SHOTGUN', '⚡  LASER', '💜  GIANT BEAM'];
    const weaponBtns: Phaser.GameObjects.Text[] = [];

    weapons.forEach((w, i) => {
      const btn = this.add.text(cx, 262 + i * 58, weaponLabels[i], {
        fontSize: '20px',
        color: w === this.selectedWeapon ? '#ffdd44' : '#888888',
        backgroundColor: w === this.selectedWeapon ? '#333300' : '#111111',
        padding: { x: 18, y: 9 },
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
    this.add.text(cx, 448, '── MODE ──', {
      fontSize: '16px', color: '#aaaaff',
    }).setOrigin(0.5);

    const modes: GameMode[] = ['training', 'battle'];
    const modeLabels = ['🎯  TRAINING', '🤖  CPU BATTLE'];
    const modeBtns: Phaser.GameObjects.Text[] = [];

    modes.forEach((m, i) => {
      const btn = this.add.text(cx, 488 + i * 58, modeLabels[i], {
        fontSize: '20px',
        color: m === this.selectedMode ? '#44ffaa' : '#888888',
        backgroundColor: m === this.selectedMode ? '#003322' : '#111111',
        padding: { x: 18, y: 9 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectedMode = m;
        modeBtns.forEach((b, j) => {
          b.setColor(modes[j] === this.selectedMode ? '#44ffaa' : '#888888');
          b.setBackgroundColor(modes[j] === this.selectedMode ? '#003322' : '#111111');
        });
        // レベル選択の表示切り替え
        this.levelSection.setVisible(this.selectedMode === 'battle');
      });
      modeBtns.push(btn);
    });

    // ── CPU LEVEL（battle のときだけ表示） ──────────────────
    this.levelSection = this.add.container(0, 0);

    const lvLabel = this.add.text(cx, 612, '── CPU LEVEL ──', {
      fontSize: '16px', color: '#ffaaaa',
    }).setOrigin(0.5);
    this.levelSection.add(lvLabel);

    const levels: CpuLevel[] = [1, 2, 3];
    const levelLabels = ['⭐ Lv.1  かんたん', '⭐⭐ Lv.2  ふつう', '⭐⭐⭐ Lv.3  むずかしい'];
    const levelColors = { sel: '#ff6666', selBg: '#330000', def: '#888888', defBg: '#111111' };
    const levelBtns: Phaser.GameObjects.Text[] = [];

    levels.forEach((lv, i) => {
      const btn = this.add.text(cx, 650 + i * 52, levelLabels[i], {
        fontSize: '17px',
        color: lv === this.selectedLevel ? levelColors.sel : levelColors.def,
        backgroundColor: lv === this.selectedLevel ? levelColors.selBg : levelColors.defBg,
        padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.selectedLevel = lv;
        levelBtns.forEach((b, j) => {
          const active = levels[j] === this.selectedLevel;
          b.setColor(active ? levelColors.sel : levelColors.def);
          b.setBackgroundColor(active ? levelColors.selBg : levelColors.defBg);
        });
      });
      levelBtns.push(btn);
      this.levelSection.add(btn);
    });

    // Training 開始時は非表示
    this.levelSection.setVisible(this.selectedMode === 'battle');

    // ── START ───────────────────────────────────────────────
    const startBtn = this.add.text(cx, 810, '▶  START  ◀', {
      fontSize: '26px', color: '#000000', backgroundColor: '#44ff88',
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

    // Controls hint
    this.add.text(cx, 847, 'PC: WASD + Click │ Mobile: Joystick + Tap', {
      fontSize: '11px', color: '#444444',
    }).setOrigin(0.5);
  }
}
