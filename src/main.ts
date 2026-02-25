import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { TrainingScene } from './scenes/TrainingScene';
import { BattleScene } from './scenes/BattleScene';
import { OnlineLobbyScene } from './scenes/OnlineLobbyScene';
import { OnlineBattleScene } from './scenes/OnlineBattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  parent: document.body,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, TrainingScene, BattleScene, OnlineLobbyScene, OnlineBattleScene],
};

new Phaser.Game(config);
