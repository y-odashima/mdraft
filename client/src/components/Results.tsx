import { useMemo } from 'react';
import { socket } from '../socket';
import type { JoinInfo, PublicState } from '../types';

interface Props {
  state: PublicState;
  role: JoinInfo;
}

export function Results({ state, role }: Props) {
  const isHost = role.role === 'host';
  const playerName = useMemo(() => {
    const m = new Map(state.players.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id;
  }, [state.players]);

  function reset() {
    if (confirm('ロビーに戻しますか？')) socket.emit('reset');
  }

  return (
    <div className="card">
      <h2>🏆 ドラフト結果</h2>
      <div className="teams-table-wrap">
        <table className="teams-table">
          <thead>
            <tr>
              <th>チーム</th>
              {Array.from({ length: state.totalRounds }, (_, i) => (
                <th key={i}>{i + 1}巡目</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.teams.map((t) => (
              <tr key={t.id} className={t.id === role.teamId ? 'mine-row' : ''}>
                <td className="team-cell">{t.name}</td>
                {Array.from({ length: state.totalRounds }, (_, i) => {
                  const pid = t.picks[i + 1];
                  return <td key={i}>{pid ? playerName(pid) : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isHost && (
        <div className="lobby-actions">
          <button className="secondary" onClick={reset}>
            ロビーに戻す
          </button>
        </div>
      )}
    </div>
  );
}
