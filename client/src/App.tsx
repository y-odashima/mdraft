import { useEffect, useState } from 'react';
import { socket } from './socket';
import type { JoinInfo, PublicState } from './types';
import { RoleSelect } from './components/RoleSelect';
import { Lobby } from './components/Lobby';
import { DraftBoard } from './components/DraftBoard';
import { Results } from './components/Results';

const STORAGE_KEY = 'mdraft-role';

function loadRole(): JoinInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JoinInfo) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [state, setState] = useState<PublicState | null>(null);
  const [role, setRole] = useState<JoinInfo | null>(loadRole());
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      // 再接続時に役割を復元
      const saved = loadRole();
      if (saved?.role === 'host') socket.emit('becomeHost');
      else if (saved?.role === 'team' && saved.teamId) socket.emit('joinTeam', saved.teamId);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onState(s: PublicState) {
      setState(s);
    }
    function onJoined(info: JoinInfo) {
      setRole(info);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    }
    function onError(msg: string) {
      setToast(msg);
      setTimeout(() => setToast(null), 3500);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('joined', onJoined);
    socket.on('errorMsg', onError);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('joined', onJoined);
      socket.off('errorMsg', onError);
    };
  }, []);

  function chooseHost() {
    socket.emit('becomeHost');
  }
  function chooseTeam(teamId: string) {
    socket.emit('joinTeam', teamId);
  }
  function chooseSpectator() {
    const info: JoinInfo = { role: 'spectator', teamId: null };
    setRole(info);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  }
  function leaveRole() {
    localStorage.removeItem(STORAGE_KEY);
    setRole(null);
  }

  const myTeam = state?.teams.find((t) => t.id === role?.teamId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>⚾ ドラフト会議</h1>
        <div className="topbar-right">
          {role && (
            <span className="role-badge">
              {role.role === 'host' && '進行役（ホスト）'}
              {role.role === 'team' && `${myTeam?.name ?? 'チーム'} として参加中`}
              {role.role === 'spectator' && '観戦中'}
            </span>
          )}
          <span className={`conn ${connected ? 'on' : 'off'}`}>
            {connected ? '接続中' : '切断'}
          </span>
          {role && (
            <button className="ghost" onClick={leaveRole}>
              役割を変更
            </button>
          )}
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <main className="content">
        {!state && <p className="loading">サーバーに接続しています…</p>}

        {state && !role && (
          <RoleSelect
            state={state}
            onHost={chooseHost}
            onTeam={chooseTeam}
            onSpectator={chooseSpectator}
          />
        )}

        {state && role && state.status === 'lobby' && (
          <Lobby state={state} role={role} onTeam={chooseTeam} />
        )}

        {state && role && state.status === 'drafting' && (
          <DraftBoard state={state} role={role} />
        )}

        {state && role && state.status === 'finished' && (
          <Results state={state} role={role} />
        )}
      </main>
    </div>
  );
}
