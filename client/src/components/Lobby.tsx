import { useEffect, useState } from 'react';
import { socket } from '../socket';
import type { JoinInfo, PublicState } from '../types';

interface Props {
  state: PublicState;
  role: JoinInfo;
  onTeam: (teamId: string) => void;
}

export function Lobby({ state, role, onTeam }: Props) {
  const isHost = role.role === 'host';
  const [playerNames, setPlayerNames] = useState<string[]>(
    state.players.map((p) => p.name)
  );
  const [teamNames, setTeamNames] = useState<string[]>(
    state.teams.map((t) => t.name)
  );

  // 他クライアントによる更新を反映（自分が編集中でない初期同期用）
  useEffect(() => {
    setPlayerNames(state.players.map((p) => p.name));
    setTeamNames(state.teams.map((t) => t.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.players.length, state.teams.length]);

  function saveSetup() {
    socket.emit('updateSetup', { playerNames, teamNames });
  }
  function start() {
    socket.emit('startDraft');
  }

  if (!isHost) {
    return (
      <div className="card">
        <h2>ドラフト開始を待っています…</h2>
        <p className="muted">進行役が選手・チームを設定して開始します。</p>
        <h3>チーム一覧</h3>
        <div className="team-grid">
          {state.teams.map((t) => (
            <button
              key={t.id}
              className={`team-pick ${t.id === role.teamId ? 'mine' : ''} ${
                t.connected ? 'taken' : ''
              }`}
              onClick={() => onTeam(t.id)}
            >
              <span className="team-pick-name">{t.name}</span>
              {t.connected && <span className="dot" />}
            </button>
          ))}
        </div>
        <h3>指名対象選手（{state.players.length}名）</h3>
        <ol className="player-list">
          {state.players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>ドラフト設定（進行役）</h2>
      <p className="muted">
        選手名・チーム名を入力し「設定を保存」で全員に反映されます。準備ができたら開始してください。
      </p>

      <section className="team-count-row">
        <label htmlFor="team-count">参加チーム数（テスト時は少なく設定可）</label>
        <select
          id="team-count"
          value={state.teams.length}
          onChange={(e) => socket.emit('setTeamCount', Number(e.target.value))}
        >
          {Array.from({ length: 8 }, (_, i) => i + 2).map((n) => (
            <option key={n} value={n}>
              {n}チーム
            </option>
          ))}
        </select>
      </section>

      <div className="setup-grid">
        <section>
          <h3>チーム名（{teamNames.length}チーム）</h3>
          <div className="name-inputs">
            {teamNames.map((name, i) => (
              <input
                key={i}
                value={name}
                onChange={(e) => {
                  const next = [...teamNames];
                  next[i] = e.target.value;
                  setTeamNames(next);
                }}
              />
            ))}
          </div>
        </section>

        <section>
          <h3>選手名（{playerNames.length}名）</h3>
          <div className="name-inputs players">
            {playerNames.map((name, i) => (
              <input
                key={i}
                value={name}
                onChange={(e) => {
                  const next = [...playerNames];
                  next[i] = e.target.value;
                  setPlayerNames(next);
                }}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="lobby-actions">
        <button className="secondary" onClick={saveSetup}>
          設定を保存
        </button>
        <button className="primary" onClick={start}>
          ドラフト開始（全{state.totalRounds}巡）
        </button>
      </div>

      <p className="muted small">
        参加中チーム: {state.teams.filter((t) => t.connected).length} / {state.teams.length}
      </p>
    </div>
  );
}
