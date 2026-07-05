import type {
  GameStatus,
  Phase,
  Player,
  Team,
  ResolutionGroup,
  DiceRoll,
  PublicState,
} from './types.js';

export const DEFAULT_TEAM_COUNT = 9;
export const MIN_TEAM_COUNT = 2;
export const MAX_TEAM_COUNT = 9;
export const PLAYER_COUNT = 40;
export const TOTAL_ROUNDS = 4;

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * ドラフト会議のゲーム状態と進行ロジックを管理するクラス。
 */
export class DraftGame {
  status: GameStatus = 'lobby';
  players: Player[] = [];
  teams: Team[] = [];
  totalRounds = TOTAL_ROUNDS;
  /** 参加チーム数（ロビーで変更可能。テスト用に2チームまで下げられる） */
  teamCount = DEFAULT_TEAM_COUNT;
  currentRound = 0;
  phase: Phase = 'nominating';
  pendingTeamIds: string[] = [];
  /** teamId -> playerId （このフェーズの指名。開票まで秘匿） */
  private nominations = new Map<string, string>();
  lastResults: ResolutionGroup[] | null = null;

  constructor() {
    this.initDefaults();
  }

  private initDefaults() {
    this.players = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
      id: `p${i + 1}`,
      name: `選手${i + 1}`,
      acquiredByTeamId: null,
      acquiredRound: null,
    }));
    this.teams = Array.from({ length: this.teamCount }, (_, i) => ({
      id: `t${i + 1}`,
      name: `チーム${i + 1}`,
      connected: false,
      picks: {},
    }));
  }

  /** 参加チーム数を変更する（ロビーのみ）。既存の名前・接続状態は保持する */
  setTeamCount(count: number) {
    if (this.status !== 'lobby') {
      throw new Error('ドラフト開始後はチーム数を変更できません。');
    }
    const n = Math.max(MIN_TEAM_COUNT, Math.min(MAX_TEAM_COUNT, Math.floor(count)));
    const names = this.teams.map((t) => t.name);
    const connected = new Map(this.teams.map((t) => [t.id, t.connected]));
    this.teamCount = n;
    this.teams = Array.from({ length: n }, (_, i) => ({
      id: `t${i + 1}`,
      name: names[i] ?? `チーム${i + 1}`,
      connected: connected.get(`t${i + 1}`) ?? false,
      picks: {},
    }));
  }

  /** ロビーで選手名・チーム名を更新する */
  updateSetup(playerNames: string[], teamNames: string[]) {
    if (this.status !== 'lobby') {
      throw new Error('ドラフト開始後は設定を変更できません。');
    }
    playerNames.forEach((name, i) => {
      if (this.players[i] && name.trim()) this.players[i].name = name.trim();
    });
    teamNames.forEach((name, i) => {
      if (this.teams[i] && name.trim()) this.teams[i].name = name.trim();
    });
  }

  getTeam(teamId: string): Team | undefined {
    return this.teams.find((t) => t.id === teamId);
  }

  setTeamConnected(teamId: string, connected: boolean) {
    const team = this.getTeam(teamId);
    if (team) team.connected = connected;
  }

  /** ドラフト開始 */
  startDraft() {
    if (this.status !== 'lobby') {
      throw new Error('すでにドラフトは開始されています。');
    }
    this.status = 'drafting';
    this.currentRound = 1;
    this.startRound();
  }

  private startRound() {
    this.phase = 'nominating';
    this.pendingTeamIds = this.teams.map((t) => t.id);
    this.nominations.clear();
    this.lastResults = null;
  }

  /** チームが選手を指名する */
  submitNomination(teamId: string, playerId: string) {
    if (this.status !== 'drafting') throw new Error('ドラフトは進行中ではありません。');
    if (this.phase !== 'nominating') throw new Error('現在は指名を受け付けていません。');
    if (!this.pendingTeamIds.includes(teamId)) {
      throw new Error('このチームは今巡目の指名を確定済みです。');
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new Error('選手が見つかりません。');
    if (player.acquiredByTeamId) throw new Error('その選手はすでに獲得されています。');

    this.nominations.set(teamId, playerId);

    // 保留中の全チームが指名を送信したら開票
    if (this.pendingTeamIds.every((id) => this.nominations.has(id))) {
      this.resolve();
    }
  }

  /** 開票して重複を判定、サイコロで勝者を決める */
  private resolve() {
    // 選手ごとに指名チームをグループ化
    const groups = new Map<string, string[]>();
    for (const teamId of this.pendingTeamIds) {
      const playerId = this.nominations.get(teamId)!;
      const arr = groups.get(playerId) ?? [];
      arr.push(teamId);
      groups.set(playerId, arr);
    }

    const results: ResolutionGroup[] = [];

    for (const [playerId, teamIds] of groups) {
      if (teamIds.length === 1) {
        // 単独指名 → 獲得確定
        results.push({
          playerId,
          teamIds,
          winnerTeamId: teamIds[0],
          dice: null,
          rerolls: 0,
        });
      } else {
        // 競合 → サイコロで決着（引き分けは振り直し）
        let contenders = [...teamIds];
        let dice: DiceRoll[] = [];
        let rerolls = -1;
        let winnerTeamId = '';
        while (true) {
          rerolls++;
          dice = contenders.map((teamId) => ({ teamId, value: rollDie() }));
          const max = Math.max(...dice.map((d) => d.value));
          const top = dice.filter((d) => d.value === max);
          if (top.length === 1) {
            winnerTeamId = top[0].teamId;
            break;
          }
          // 引き分け → 最高値のチームのみで振り直し
          contenders = top.map((d) => d.teamId);
        }
        results.push({ playerId, teamIds, winnerTeamId, dice, rerolls });
      }
    }

    // 勝者に選手を割り当て、保留リストから除外
    for (const r of results) {
      const player = this.players.find((p) => p.id === r.playerId)!;
      player.acquiredByTeamId = r.winnerTeamId;
      player.acquiredRound = this.currentRound;
      const team = this.getTeam(r.winnerTeamId)!;
      team.picks[this.currentRound] = r.playerId;
      this.pendingTeamIds = this.pendingTeamIds.filter((id) => id !== r.winnerTeamId);
    }

    this.lastResults = results;
    this.phase = 'revealing';
  }

  /** ホストが次のステップへ進める（開票結果表示後） */
  advance() {
    if (this.status !== 'drafting') throw new Error('ドラフトは進行中ではありません。');
    if (this.phase !== 'revealing') throw new Error('開票が完了していません。');

    if (this.pendingTeamIds.length > 0) {
      // 敗者が残っている → 同じ巡目で再指名
      this.phase = 'nominating';
      this.nominations.clear();
      this.lastResults = null;
    } else if (this.currentRound < this.totalRounds) {
      // 次の巡目へ
      this.currentRound++;
      this.startRound();
    } else {
      // 全巡目終了
      this.status = 'finished';
      this.lastResults = null;
    }
  }

  /** ロビーへ戻して全リセット（名前は保持） */
  reset() {
    const playerNames = this.players.map((p) => p.name);
    const teamNames = this.teams.map((t) => t.name);
    const connected = new Map(this.teams.map((t) => [t.id, t.connected]));
    this.initDefaults();
    this.players.forEach((p, i) => (p.name = playerNames[i]));
    this.teams.forEach((t, i) => {
      t.name = teamNames[i];
      t.connected = connected.get(t.id) ?? false;
    });
    this.status = 'lobby';
    this.currentRound = 0;
    this.phase = 'nominating';
    this.pendingTeamIds = [];
    this.nominations.clear();
    this.lastResults = null;
  }

  getPublicState(): PublicState {
    return {
      status: this.status,
      players: this.players,
      teams: this.teams,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      phase: this.phase,
      pendingTeamIds: this.pendingTeamIds,
      submittedTeamIds: [...this.nominations.keys()],
      lastResults: this.lastResults,
    };
  }
}
