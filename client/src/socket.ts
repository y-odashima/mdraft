import { io, Socket } from 'socket.io-client';

// サーバーURL（環境変数がなければこのPCのIPアドレスを使用）
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://192.168.0.51:3001';

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
});
