// ドラフト会議アプリで使用する型定義（サーバー・クライアント共通の概念）

export type GameStatus = 'lobby' | 'drafting' | 'finished';

/** ラウンド内のフェーズ: 指名受付中 / 開票中（結果表示） */
export type Phase = 'nominating' | 'revealing';

export interface Player {
  id: string;
  name: string;
  /** 獲得したチームID（未獲得は null） */
  acquiredByTeamId: string | null;
  /** 獲得された巡目（未獲得は null） */
  acquiredRound: number | null;
}

export interface Team {
  id: string;
  name: string;
  connected: boolean;
  /** 巡目ごとの獲得選手ID  round(1-4) -> playerId */
  picks: Record<number, string>;
}

export interface DiceRoll {
  teamId: string;
  value: number;
}

/** 1選手に対する開票結果 */
export interface ResolutionGroup {
  playerId: string;
  /** その選手を指名したチームID一覧 */
  teamIds: string[];
  /** 獲得が確定したチームID */
  winnerTeamId: string;
  /** 競合時のサイコロ結果（単独指名なら null） */
  dice: DiceRoll[] | null;
  /** サイコロが引き分けで振り直しになった回数 */
  rerolls: number;
}

/** 全クライアントへ配信する公開状態（指名内容は開票まで秘匿） */
export interface PublicState {
  status: GameStatus;
  players: Player[];
  teams: Team[];
  currentRound: number;
  totalRounds: number;
  phase: Phase;
  /** この巡目でまだ獲得選手が確定していないチーム */
  pendingTeamIds: string[];
  /** このフェーズで指名を送信済みのチーム */
  submittedTeamIds: string[];
  /** 直近の開票結果 */
  lastResults: ResolutionGroup[] | null;
}

/** クライアント個別に返す情報 */
export interface JoinInfo {
  role: 'host' | 'team' | 'spectator';
  teamId: string | null;
}
