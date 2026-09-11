import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface ActivityEvent {
  id: string;
  message: string;
  createdAt: string;
  actor?: { name: string };
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export default function ActivityFeed({ socket }: { socket: Socket }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    // Missed events fetched from DB on (re)connect — pushed by the server
    socket.on("activity:catchup", (missed: ActivityEvent[]) => {
      setEvents((prev) => [...missed, ...prev]);
    });

    // Live updates while connected
    socket.on("activity:new", (event: ActivityEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 100));
    });

    return () => {
      socket.off("activity:catchup");
      socket.off("activity:new");
    };
  }, [socket]);

  return (
    <div style={{ background: "white", borderRadius: 8, padding: 16 }}>
      <h3>Live Activity</h3>
      {events.length === 0 && <p style={{ color: "#888" }}>No activity yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {events.map((e) => (
          <li key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
            <div>{e.message}</div>
            <div style={{ fontSize: 11, color: "#999" }}>{timeAgo(e.createdAt)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
