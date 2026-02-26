export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

export type WeaponType = 'shotgun' | 'laser' | 'beam';
export type GameMode = 'training' | 'battle';
export type CpuLevel = 1 | 2 | 3;

export const WEAPON_CONFIG = {
  shotgun: {
    pellets: 12,
    spread: Math.PI / 5,
    speed: 600,
    cooldown: 40,
    damage: 5,   // 8→5（近距離ワンパン防止）
    range: 580,
  },
  laser: {
    speed: 1080,
    cooldown: 30,
    damage: 15,
    maxGenerations: 1,
    range: 600,
  },
  beam: {
    speed: 320,  // 200→320（移動速度250より速く）
    width: 240,
    height: 80,
    cooldown: 60,
    damage: 15,
    maxHits: 5,
    range: 500,
  },
} as const;

export const HIT_STOP_FRAMES = {
  shotgun: 2,
  laser: 4,
  beam: 6,
  ko: 120,
} as const;

export const PLAYER_CONFIG = {
  speed: 250,
  maxHp: 150,  // 100→150（試合時間を伸ばして駆け引き増加）
  radius: 22,
};

export const ENEMY_CONFIG = {
  speed: 200,
  maxHp: 100,
  radius: 22,
  approachRange: 350,
  fireRange: 300,
  aimJitter: 0.3,
  evadeDuration: 2000,
};

export const COLORS = {
  player: 0x4488ff,
  enemy: 0xff4444,
  pellet: 0xffdd44,
  laser: 0x44ffff,
  beam: 0xff44ff,
  hitStop: 0xffffff,
  damageText: 0xff6600,
};
