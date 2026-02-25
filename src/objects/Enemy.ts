import Phaser from 'phaser';
import { ENEMY_CONFIG, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import type { WeaponType, CpuLevel } from '../config';
import { Player } from './Player';
import { HitStop } from '../effects/HitStop';
import { ScreenShake } from '../effects/ScreenShake';
import { Pellet } from '../projectiles/Pellet';
import { LaserBolt } from '../projectiles/LaserBolt';
import { BeamProjectile } from '../projectiles/BeamProjectile';
import type { ObstacleDef } from './Obstacle';

type AIState = 'wander' | 'approach' | 'fire' | 'evade' | 'pause' | 'cover';

// レベルごとのAIパラメータ
const LEVEL_PARAMS = {
  1: {
    cooldownMultiplier: 1.0,
    aimJitter: 0.30,
    fireStateDuration: 40,
    approachWhileFiring: false,
    useEvade: true,
    approachSpeedRatio: 0.8,
  },
  2: {
    cooldownMultiplier: 0.5,
    aimJitter: 0.15,
    fireStateDuration: 70,
    approachWhileFiring: false,
    useEvade: true,
    approachSpeedRatio: 0.9,
  },
  3: {
    cooldownMultiplier: 1.0,   // プレイヤーと同じリロード間隔
    aimJitter: 0.0,             // 完全精密照準
    fireStateDuration: 80,      // この間隔でfire/pause/cover を選ぶ
    approachWhileFiring: true,
    useEvade: false,
    approachSpeedRatio: 1.0,   // 移動速度は同等
  },
} as const;

export class Enemy extends Player {
  private aiState: AIState = 'wander';
  private stateTimer = 0;
  private wanderAngle = 0;
  private target: Player | null = null;
  private level: CpuLevel;
  private params: typeof LEVEL_PARAMS[CpuLevel];
  private obstacles: ObstacleDef[] = [];
  // cover 目的地
  private coverTargetX = 0;
  private coverTargetY = 0;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    weapon: WeaponType,
    hitStop: HitStop,
    screenShake: ScreenShake,
    level: CpuLevel = 1,
  ) {
    super(scene, x, y, weapon, 'enemy', COLORS.enemy, hitStop, screenShake);
    this.level = level;
    this.params = LEVEL_PARAMS[level];
    this.cooldownMultiplier = this.params.cooldownMultiplier;
  }

  setTarget(player: Player) {
    this.target = player;
  }

  setObstacles(defs: ObstacleDef[]) {
    this.obstacles = defs;
  }

  updateAI(
    dt: number,
    allProjectiles: { pellets: Pellet[]; lasers: LaserBolt[]; beams: BeamProjectile[] }
  ) {
    super.update(dt);
    if (!this.target || !this.isAlive) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.stateTimer--;

    // ─── State transition ────────────────────────────────────────────
    if (this.stateTimer <= 0) {
      if (this.level === 3) {
        this.transitionLv3(dist);
      } else {
        this.transitionDefault(dist);
      }
    }

    // ─── Execute state ────────────────────────────────────────────────
    switch (this.aiState) {
      case 'wander':
        this.moveWithVector(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle));
        break;

      case 'approach': {
        const speed = ENEMY_CONFIG.speed * this.params.approachSpeedRatio;
        const len = Math.max(dist, 1);
        this.setVelocity((dx / len) * speed, (dy / len) * speed);
        break;
      }

      case 'fire': {
        if (this.params.approachWhileFiring) {
          const speed = ENEMY_CONFIG.speed * this.params.approachSpeedRatio;
          const len = Math.max(dist, 1);
          this.setVelocity((dx / len) * speed, (dy / len) * speed);
        } else {
          this.setVelocity(0, 0);
        }

        const jitter = (Math.random() - 0.5) * this.params.aimJitter * 2;
        const targetAngle = Math.atan2(dy, dx) + jitter;
        const tx = this.x + Math.cos(targetAngle) * 100;
        const ty = this.y + Math.sin(targetAngle) * 100;
        this.fire(tx, ty, allProjectiles);

        if (this.params.useEvade && this.stateTimer <= 10) {
          this.aiState = 'evade';
          this.wanderAngle = targetAngle + Math.PI / 2;
          this.stateTimer = Math.floor(ENEMY_CONFIG.evadeDuration / 16);
        }
        break;
      }

      case 'evade': {
        this.moveWithVector(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle));
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body.blocked.left  || body.blocked.right) this.wanderAngle = Math.PI - this.wanderAngle;
        if (body.blocked.up    || body.blocked.down)  this.wanderAngle = -this.wanderAngle;
        break;
      }

      // ── Lv.3 専用ステート ──────────────────────────────────────────
      case 'pause':
        // 立ち止まりながら射程内なら射撃継続
        this.setVelocity(0, 0);
        if (dist < ENEMY_CONFIG.fireRange) {
          const jitter = (Math.random() - 0.5) * this.params.aimJitter * 2;
          const targetAngle = Math.atan2(dy, dx) + jitter;
          const tx = this.x + Math.cos(targetAngle) * 100;
          const ty = this.y + Math.sin(targetAngle) * 100;
          this.fire(tx, ty, allProjectiles);
        }
        break;

      case 'cover': {
        // 目的地に向かって移動
        const cdx = this.coverTargetX - this.x;
        const cdy = this.coverTargetY - this.y;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        const speed = ENEMY_CONFIG.speed * this.params.approachSpeedRatio;
        if (cdist > 20) {
          this.setVelocity((cdx / cdist) * speed, (cdy / cdist) * speed);
        } else {
          // 到着したら即 fire に切り替え
          this.setVelocity(0, 0);
          this.aiState = 'fire';
          this.stateTimer = this.params.fireStateDuration;
        }
        break;
      }
    }
  }

  // ─── Lv.1 / Lv.2 の遷移 ─────────────────────────────────────────────────
  private transitionDefault(dist: number) {
    if (this.aiState === 'evade' && this.params.useEvade) {
      this.aiState = 'approach';
      this.stateTimer = 120;
    } else if (dist < ENEMY_CONFIG.fireRange) {
      this.aiState = 'fire';
      this.stateTimer = this.params.fireStateDuration;
    } else if (dist < ENEMY_CONFIG.approachRange * 1.5) {
      this.aiState = 'approach';
      this.stateTimer = 90;
    } else {
      this.aiState = 'wander';
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.stateTimer = 120;
    }
  }

  // ─── Lv.3 の遷移（fire / pause / cover をランダムに選択） ───────────────
  private transitionLv3(dist: number) {
    if (dist >= ENEMY_CONFIG.fireRange * 1.3) {
      // 射程外 → 近づく
      this.aiState = 'approach';
      this.stateTimer = 90;
      return;
    }

    // 射程内：fire / pause / cover からランダム選択
    const roll = Math.random();

    if (roll < 0.50) {
      // 50% → fire（近づきながら撃つ）
      this.aiState = 'fire';
      this.stateTimer = this.params.fireStateDuration;

    } else if (roll < 0.75) {
      // 25% → pause（立ち止まって撃つ）
      this.aiState = 'pause';
      this.stateTimer = 50 + Math.floor(Math.random() * 40); // 50~90f

    } else {
      // 25% → cover（障害物の陰に隠れる）
      const coverPos = this.findCoverPosition();
      if (coverPos) {
        this.coverTargetX = coverPos.x;
        this.coverTargetY = coverPos.y;
        this.aiState = 'cover';
        this.stateTimer = 120;
      } else {
        // 障害物が使えない場合は pause に fallback
        this.aiState = 'pause';
        this.stateTimer = 60;
      }
    }
  }

  // ─── 障害物の「陰」の座標を求める ────────────────────────────────────────
  private findCoverPosition(): { x: number; y: number } | null {
    if (!this.target || this.obstacles.length === 0) return null;

    // 一番近い障害物を選ぶ
    let bestObs: ObstacleDef | null = null;
    let bestDist = Infinity;

    for (const obs of this.obstacles) {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const d = Math.hypot(this.x - cx, this.y - cy);
      if (d < bestDist) {
        bestDist = d;
        bestObs = obs;
      }
    }

    if (!bestObs) return null;

    const obsCx = bestObs.x + bestObs.w / 2;
    const obsCy = bestObs.y + bestObs.h / 2;

    // 障害物 → プレイヤー方向の逆側 = 「陰」
    const toPx = this.target.x - obsCx;
    const toPy = this.target.y - obsCy;
    const toPLen = Math.hypot(toPx, toPy) || 1;

    // 障害物の半サイズ＋少し余裕のオフセット
    const offset = Math.max(bestObs.w, bestObs.h) / 2 + 40;
    const coverX = obsCx - (toPx / toPLen) * offset;
    const coverY = obsCy - (toPy / toPLen) * offset;

    // 画面内にクランプ
    return {
      x: Math.max(30, Math.min(GAME_WIDTH  - 30, coverX)),
      y: Math.max(80, Math.min(GAME_HEIGHT - 80, coverY)),
    };
  }
}
