import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { DraftGame } from './game.js';
import type { JoinInfo } from './types.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.get('/', (_req, res) => res.send('mdraft server is running'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const game = new DraftGame();

/** socketId -> 役割情報 */
const clients = new Map<string, JoinInfo>();

let hostSocketId: string | null = null;

function broadcastState() {
  io.emit('state', game.getPublicState());
}

function isHost(socketId: string): boolean {
  return hostSocketId === socketId;
}

io.on('connection', (socket) => {
  clients.set(socket.id, { role: 'spectator', teamId: null });
  // 接続直後に現在の状態を送る
  socket.emit('state', game.getPublicState());

  socket.on('becomeHost', () => {
    hostSocketId = socket.id;
    clients.set(socket.id, { role: 'host', teamId: null });
    socket.emit('joined', { role: 'host', teamId: null } satisfies JoinInfo);
    broadcastState();
  });

  socket.on('joinTeam', (teamId: string) => {
    const team = game.getTeam(teamId);
    if (!team) {
      socket.emit('errorMsg', 'チームが見つかりません。');
      return;
    }
    // 既存の担当を解除
    const prev = clients.get(socket.id);
    if (prev?.teamId && prev.teamId !== teamId) {
      // 他に同じチームの接続がなければ切断扱い
      game.setTeamConnected(prev.teamId, hasOtherTeamMember(prev.teamId, socket.id));
    }
    clients.set(socket.id, { role: 'team', teamId });
    game.setTeamConnected(teamId, true);
    socket.emit('joined', { role: 'team', teamId } satisfies JoinInfo);
    broadcastState();
  });

  socket.on('updateSetup', (payload: { playerNames: string[]; teamNames: string[] }) => {
    if (!isHost(socket.id)) return;
    try {
      game.updateSetup(payload.playerNames ?? [], payload.teamNames ?? []);
      broadcastState();
    } catch (e) {
      socket.emit('errorMsg', (e as Error).message);
    }
  });

  socket.on('setTeamCount', (count: number) => {
    if (!isHost(socket.id)) return;
    try {
      game.setTeamCount(count);
      broadcastState();
    } catch (e) {
      socket.emit('errorMsg', (e as Error).message);
    }
  });

  socket.on('startDraft', () => {
    if (!isHost(socket.id)) return;
    try {
      game.startDraft();
      broadcastState();
    } catch (e) {
      socket.emit('errorMsg', (e as Error).message);
    }
  });

  socket.on('submitNomination', (playerId: string) => {
    const info = clients.get(socket.id);
    if (info?.role !== 'team' || !info.teamId) {
      socket.emit('errorMsg', 'チームとして参加していません。');
      return;
    }
    try {
      game.submitNomination(info.teamId, playerId);
      broadcastState();
    } catch (e) {
      socket.emit('errorMsg', (e as Error).message);
    }
  });

  socket.on('advance', () => {
    if (!isHost(socket.id)) return;
    try {
      game.advance();
      broadcastState();
    } catch (e) {
      socket.emit('errorMsg', (e as Error).message);
    }
  });

  socket.on('reset', () => {
    if (!isHost(socket.id)) return;
    game.reset();
    broadcastState();
  });

  socket.on('disconnect', () => {
    const info = clients.get(socket.id);
    if (info?.teamId) {
      game.setTeamConnected(info.teamId, hasOtherTeamMember(info.teamId, socket.id));
    }
    if (hostSocketId === socket.id) hostSocketId = null;
    clients.delete(socket.id);
    broadcastState();
  });
});

/** 指定チームに、除外socket以外の接続が残っているか */
function hasOtherTeamMember(teamId: string, exceptSocketId: string): boolean {
  for (const [sid, info] of clients) {
    if (sid !== exceptSocketId && info.teamId === teamId) return true;
  }
  return false;
}

httpServer.listen(PORT, () => {
  console.log(`mdraft server listening on http://localhost:${PORT}`);
});
