import type { PublicState } from '../types';

interface Props {
  state: PublicState;
  onHost: () => void;
  onTeam: (teamId: string) => void;
  onSpectator: () => void;
}

export function RoleSelect({ state, onHost, onTeam, onSpectator }: Props) {
  return (
    <div className="card">
      <h2>参加方法を選択</h2>
      <p className="muted">
        進行役は1名、各チームはそれぞれの端末から参加してください。
      </p>

      <div className="role-actions">
        <button className="primary big" onClick={onHost}>
          進行役（ホスト）になる
        </button>
        <button className="ghost big" onClick={onSpectator}>
          観戦する
        </button>
      </div>

      <h3>チームとして参加</h3>
      <div className="team-grid">
        {state.teams.map((t) => (
          <button
            key={t.id}
            className={`team-pick ${t.connected ? 'taken' : ''}`}
            onClick={() => onTeam(t.id)}
            title={t.connected ? 'すでに誰かが参加中（再参加も可能）' : ''}
          >
            <span className="team-pick-name">{t.name}</span>
            {t.connected && <span className="dot" />}
          </button>
        ))}
      </div>
    </div>
  );
}
