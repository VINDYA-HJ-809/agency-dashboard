import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { api } from "../lib/api";

interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell({ socket }: { socket: Socket }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get("/notifications").then((res) => {
      setItems(res.data.data);
      setUnread(res.data.unreadCount);
    });

    // Real-time push — not polling
    socket.on("notification:new", (n: Notification) => {
      setItems((prev) => [n, ...prev]);
      setUnread((prev) => prev + 1);
    });

    return () => {
      socket.off("notification:new");
    };
  }, [socket]);

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "red",
              color: "white",
              borderRadius: "50%",
              fontSize: 10,
              padding: "2px 6px",
            }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 32,
            background: "white",
            border: "1px solid #ddd",
            width: 300,
            maxHeight: 360,
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <strong>Notifications</strong>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          {items.length === 0 && <p style={{ padding: 8, color: "#888" }}>No notifications</p>}
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{ padding: 8, borderBottom: "1px solid #f0f0f0", background: n.isRead ? "white" : "#eef6ff", cursor: "pointer" }}
            >
              <div>{n.message}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
