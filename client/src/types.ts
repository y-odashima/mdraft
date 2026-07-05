// サーバーと共通のドラフト型定義

export type GameStatus = 'lobby' | 'drafting' | 'finished';
export type Phase = 'nominating' | 'revealing';

export interface Player {
  id: string;
  name: string;
  acquiredByTeamId: string | null;
  acquiredRound: number | null;
}

export interface Team {
  id: string;
  name: string;
  connected: boolean;
  picks: Record<number, string>;
}

export interface DiceRoll {
  teamId: string;
  value: number;
}

export interface ResolutionGroup {
  playerId: string;
  teamIds: string[];
  winnerTeamId: string;
  dice: DiceRoll[] | null;
  rerolls: number;
}

export interface PublicState {
  status: GameStatus;
  players: Player[];
  teams: Team[];
  currentRound: number;
  totalRounds: number;
  phase: Phase;
  pendingTeamIds: string[];
  submittedTeamIds: string[];
  lastResults: ResolutionGroup[] | null;
}

export interface JoinInfo {
  role: 'host' | 'team' | 'spectator';
  teamId: string | null;
}
