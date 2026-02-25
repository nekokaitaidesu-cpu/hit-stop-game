import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { ObstacleDef } from '../objects/Obstacle';

/**
 * バトルごとにランダムな障害物を4枚生成。
 * 上下左右対称（180°回転対称）で、ホスト・ゲスト双方が
 * 同じ条件でプレイできるようにする。
 *
 * 構造:
 *   [壁A]         [壁B]    ← 上半分（壁BはAの左右ミラー）
 *   ─────────────────────  中央
 *   [壁C]         [壁D]    ← 下半分（壁Cは壁Bの上下ミラー、壁DはAの上下ミラー）
 *
 * = AとDが対、BとCが対になる180°回転対称
 */
export function generateObstacles(): ObstacleDef[] {
  // 横向きか縦向きかランダム
  const isHoriz = Math.random() < 0.6; // 横壁の方が多めに
  const ww = isHoriz
    ? 90  + Math.floor(Math.random() * 80)  // 横壁: 幅90〜170
    : 22  + Math.floor(Math.random() * 12); // 縦壁: 幅22〜34
  const wh = isHoriz
    ? 22  + Math.floor(Math.random() * 12)  // 横壁: 高さ22〜34
    : 90  + Math.floor(Math.random() * 80); // 縦壁: 高さ90〜170

  // 上半分の左エリアに基準位置を決める
  const xMin = 40;
  const xMax = GAME_WIDTH / 2 - ww - 20;   // 中央から左に余白
  const yMin = 100;                          // HUD の下
  const yMax = GAME_HEIGHT / 2 - wh - 60;  // 中央から上に余白

  const bx = xMin + Math.floor(Math.random() * (xMax - xMin));
  const by = yMin + Math.floor(Math.random() * (yMax - yMin));

  // 180°回転対称の4点を生成
  // ミラーX: GAME_WIDTH  - bx - ww
  // ミラーY: GAME_HEIGHT - by - wh
  const mx = GAME_WIDTH  - bx - ww;
  const my = GAME_HEIGHT - by - wh;

  return [
    { x: bx, y: by, w: ww, h: wh }, // 上-左
    { x: mx, y: by, w: ww, h: wh }, // 上-右
    { x: bx, y: my, w: ww, h: wh }, // 下-左
    { x: mx, y: my, w: ww, h: wh }, // 下-右
  ];
}
