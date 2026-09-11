import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useAuth } from "../lib/AuthContext";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { api } from "../lib/api";
import ActivityFeed from "../components/ActivityFeed";
import NotificationBell from "../components/NotificationBell";
import TaskList from "../components/TaskList";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);
    s.on("presence:count", (data: { count: number }) => setOnlineCount(data.count));
    api.get("/dashboard").then((res) => setStats(res.data.data));
    return () => {
      disconnectSocket();
    };
  }, []);

  if (!user || !socket) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Welcome, {user.name}</h2>
          <span style={{ fontSize: 12, color: "#888" }}>{user.role}</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {user.role === "ADMIN" && <span>🟢 {onlineCount} online</span>}
          <NotificationBell socket={socket} />
          <button onClick={logout}>Log out</button>
        </div>
      </div>

      {user.role === "ADMIN" && stats && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <StatCard label="Total Projects" value={stats.totalProjects} />
          <StatCard label="Overdue Tasks" value={stats.overdueCount} />
        </div>
      )}

      {user.role === "PM" && stats && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <StatCard label="Your Projects" value={stats.projects?.length ?? 0} />
          <StatCard label="Due This Week" value={stats.upcomingDueDates?.length ?? 0} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <TaskList canUpdateStatus={user.role === "DEVELOPER" || user.role === "ADMIN"} />
        <ActivityFeed socket={socket} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "white", borderRadius: 8, padding: 16, flex: 1 }}>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
