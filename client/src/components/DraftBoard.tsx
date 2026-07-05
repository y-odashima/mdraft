import { useMemo, useState } from 'react';
import { socket } from '../socket';
import type { JoinInfo, PublicState } from '../types';

interface Props {
  state: PublicState;
  role: JoinInfo;
}

export function DraftBoard({ state, role }: Props) {
  const isHost = role.role === 'host';
  const myTeamId = role.teamId;

  const playerName = useMemo(() => {
    const m = new Map(state.players.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id;
  }, [state.players]);

  const teamName = useMemo(() => {
    const m = new Map(state.teams.map((t) => [t.id, t.name]));
    return (id: string) => m.get(id) ?? id;
  }, [state.teams]);

  const availablePlayers = state.players.filter((p) => !p.acquiredByTeamId);

  const iAmPending = !!myTeamId && state.pendingTeamIds.includes(myTeamId);
  const iSubmitted = !!myTeamId && state.submittedTeamIds.includes(myTeamId);

  return (
    <div className="board">
      <div className="round-banner">
        <span className="round-num">{state.currentRound}巡目</span>
        <span className="phase-label">
          {state.phase === 'nominating' ? '指名受付中' : '開票結果'}
        </span>
        <span className="muted">全{state.totalRounds}巡</span>
      </div>

      {/* 指名パネル（チーム参加者向け） */}
      {role.role === 'team' && state.phase === 'nominating' && (
        <NominatePanel
          state={state}
          myTeamId={myTeamId!}
          pending={iAmPending}
          submitted={iSubmitted}
          availablePlayers={availablePlayers}
          playerName={playerName}
        />
      )}

      {/* 開票結果 */}
      {state.phase === 'revealing' && state.lastResults && (
        <RevealPanel
          results={state.lastResults}
          playerName={playerName}
          teamName={teamName}
        />
      )}

      {/* 進行役コントロール */}
      {isHost && (
        <HostControls state={state} teamName={teamName} />
      )}

      {/* 指名状況 */}
      {state.phase === 'nominating' && (
        <div className="card">
          <h3>指名状況</h3>
          <p className="muted small">
            この巡で未確定のチームが指名します。全員そろうと自動で開票されます。
          </p>
          <div className="status-grid">
            {state.teams.map((t) => {
              const confirmed = !state.pendingTeamIds.includes(t.id);
              const submitted = state.submittedTeamIds.includes(t.id);
              return (
                <div
                  key={t.id}
                  className={`status-cell ${confirmed ? 'confirmed' : submitted ? 'submitted' : 'waiting'}`}
                >
                  <span className="status-team">{t.name}</span>
                  <span className="status-text">
                    {confirmed ? '✅ 獲得確定' : submitted ? '📨 指名済み' : '⏳ 指名待ち'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* チーム別の獲得状況 */}
      <div className="card">
        <h3>チーム別 獲得選手</h3>
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
                <tr key={t.id} className={t.id === myTeamId ? 'mine-row' : ''}>
                  <td className="team-cell">
                    {t.name}
                    {!t.connected && <span className="offline"> (未接続)</span>}
                  </td>
                  {Array.from({ length: state.totalRounds }, (_, i) => {
                    const pid = t.picks[i + 1];
                    return (
                      <td key={i}>{pid ? playerName(pid) : '—'}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 残り選手 */}
      <div className="card">
        <h3>指名可能な選手（残り {availablePlayers.length}名）</h3>
        <div className="chips">
          {availablePlayers.map((p) => (
            <span key={p.id} className="chip">
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 指名パネル ---------- */

function NominatePanel({
  myTeamId,
  pending,
  submitted,
  availablePlayers,
}: {
  state: PublicState;
  myTeamId: string;
  pending: boolean;
  submitted: boolean;
  availablePlayers: PublicState['players'];
  playerName: (id: string) => string;
}) {
  const [selected, setSelected] = useState('');

  if (!myTeamId) return null;

  if (!pending) {
    return (
      <div className="card highlight">
        <h3>この巡目の獲得は確定しています 🎉</h3>
        <p className="muted">他チームの指名完了をお待ちください。</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="card highlight">
        <h3>指名を送信しました 📨</h3>
        <p className="muted">全チームの指名がそろうと開票されます。</p>
      </div>
    );
  }

  function submit() {
    if (!selected) return;
    socket.emit('submitNomination', selected);
  }

  return (
    <div className="card highlight">
      <h3>選手を指名してください</h3>
      <div className="nominate-row">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">-- 選手を選択 --</option>
          {availablePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="primary" disabled={!selected} onClick={submit}>
          指名を確定
        </button>
      </div>
    </div>
  );
}

/* ---------- 開票結果パネル ---------- */

function RevealPanel({
  results,
  playerName,
  teamName,
}: {
  results: NonNullable<PublicState['lastResults']>;
  playerName: (id: string) => string;
  teamName: (id: string) => string;
}) {
  return (
    <div className="card highlight">
      <h3>開票結果</h3>
      <div className="results">
        {results.map((r) => {
          const contested = r.teamIds.length > 1;
          return (
            <div key={r.playerId} className={`result ${contested ? 'contested' : ''}`}>
              <div className="result-head">
                <span className="result-player">{playerName(r.playerId)}</span>
                {contested ? (
                  <span className="badge warn">重複 {r.teamIds.length}チーム</span>
                ) : (
                  <span className="badge ok">単独指名</span>
                )}
              </div>
              <div className="result-body">
                <div className="result-teams">
                  指名: {r.teamIds.map((id) => teamName(id)).join(' / ')}
                </div>
                {r.dice && (
                  <div className="dice-row">
                    {r.dice.map((d) => (
                      <span
                        key={d.teamId}
                        className={`die ${d.teamId === r.winnerTeamId ? 'win' : ''}`}
                      >
                        🎲 {teamName(d.teamId)}: <b>{d.value}</b>
                      </span>
                    ))}
                    {r.rerolls > 0 && (
                      <span className="muted small">（振り直し {r.rerolls}回）</span>
                    )}
                  </div>
                )}
                <div className="winner">
                  獲得 → <b>{teamName(r.winnerTeamId)}</b>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 進行役コントロール ---------- */

function HostControls({
  state,
  teamName,
}: {
  state: PublicState;
  teamName: (id: string) => string;
}) {
  function advance() {
    socket.emit('advance');
  }
  function reset() {
    if (confirm('ロビーに戻してドラフトをリセットしますか？')) {
      socket.emit('reset');
    }
  }

  const submittedCount = state.submittedTeamIds.length;
  const pendingCount = state.pendingTeamIds.length;

  return (
    <div className="card host-controls">
      <h3>進行役コントロール</h3>
      {state.phase === 'nominating' && (
        <p className="muted">
          指名済み: {submittedCount} / {pendingCount} チーム（全員そろうと自動開票）
          {pendingCount > 0 && submittedCount < pendingCount && (
            <>
              {' '}
              — 待ち:{' '}
              {state.pendingTeamIds
                .filter((id) => !state.submittedTeamIds.includes(id))
                .map((id) => teamName(id))
                .join(', ')}
            </>
          )}
        </p>
      )}
      {state.phase === 'revealing' && (
        <div className="host-actions">
          <p className="muted">
            {pendingCount > 0
              ? `${pendingCount}チームが未確定です。同じ巡目で再指名に進みます。`
              : state.currentRound < state.totalRounds
                ? 'この巡目は完了しました。次の巡目に進みます。'
                : '最終巡目が完了しました。結果を確定します。'}
          </p>
          <button className="primary big" onClick={advance}>
            {pendingCount > 0
              ? '再指名へ進む'
              : state.currentRound < state.totalRounds
                ? `${state.currentRound + 1}巡目へ進む`
                : '結果を表示'}
          </button>
        </div>
      )}
      <button className="ghost small-btn" onClick={reset}>
        リセット
      </button>
    </div>
  );
}
