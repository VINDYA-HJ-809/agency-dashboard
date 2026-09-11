import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(API_BASE, {
    auth: { token: getAccessToken() },
    withCredentials: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
