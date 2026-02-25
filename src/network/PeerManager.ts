import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { WeaponType } from '../config';
import type { ObstacleDef } from '../objects/Obstacle';

/** ネットワークで送受信するメッセージの型 */
export type NetMsg =
  | { type: 'ready';   weapon: WeaponType; obstacles?: ObstacleDef[] } // 武器＋障害物を交換
  | { type: 'pos';     x: number; y: number; hp: number } // 位置・HP を毎フレーム送信
  | { type: 'fire';    angle: number }                    // 発射（角度のみ）
  | { type: 'hit';     amount: number; weapon: WeaponType } // 命中エフェクト通知
  | { type: 'gameOver' };                                 // 勝敗確定

export class PeerManager {
  private peer: Peer;
  private conn: DataConnection | null = null;
  isHost: boolean;
  peerId = '';

  onOpen:         (id: string) => void  = () => {};
  onConnected:    ()           => void  = () => {};
  onMessage:      (msg: NetMsg) => void = () => {};
  onDisconnected: ()           => void  = () => {};
  onError:        (err: Error) => void  = () => {};

  constructor(isHost: boolean) {
    this.isHost = isHost;

    if (isHost) {
      // ホスト: "hsg-XXXX" という固定IDで待機
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      this.peer = new Peer(`hsg-${code}`);
    } else {
      // ゲスト: PeerJS がランダムIDを割り当て
      this.peer = new Peer();
    }

    this.peer.on('open', (id) => {
      this.peerId = id;
      this.onOpen(id);
    });

    this.peer.on('error', (err) => this.onError(err as Error));

    // ホストは接続を待ち受ける
    if (isHost) {
      this.peer.on('connection', (conn) => {
        this.conn = conn;
        this.setupConn();
      });
    }
  }

  /** ゲストがホストのルームコードに接続 */
  connect(roomCode: string) {
    const conn = this.peer.connect(`hsg-${roomCode}`);
    this.conn = conn;
    this.setupConn();
  }

  private setupConn() {
    if (!this.conn) return;
    this.conn.on('open',  ()     => this.onConnected());
    this.conn.on('data',  (data) => this.onMessage(data as NetMsg));
    this.conn.on('close', ()     => this.onDisconnected());
    this.conn.on('error', (err)  => this.onError(err as Error));
  }

  send(msg: NetMsg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  /** "hsg-1234" から "1234" を取り出す */
  getRoomCode(): string {
    return this.peerId.replace('hsg-', '');
  }

  destroy() {
    this.conn?.close();
    this.peer.destroy();
  }
}
