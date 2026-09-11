import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  assignedTo?: { name: string } | null;
  project?: { name: string };
}

export default function TaskList({ canUpdateStatus }: { canUpdateStatus: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);

  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";

  useEffect(() => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    api.get("/tasks", { params }).then((res) => setTasks(res.data.data));
  }, [status, priority]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  async function updateStatus(taskId: string, newStatus: string) {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  }

  return (
    <div style={{ background: "white", borderRadius: 8, padding: 16 }}>
      <h3>Tasks</h3>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <select value={status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="DONE">Done</option>
        </select>
        <select value={priority} onChange={(e) => updateFilter("priority", e.target.value)}>
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
            <th>Title</th>
            <th>Project</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #f5f5f5", background: t.isOverdue ? "#fff4f4" : "white" }}>
              <td>{t.title}</td>
              <td>{t.project?.name}</td>
              <td>{t.assignedTo?.name || "-"}</td>
              <td>{t.priority}</td>
              <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"} {t.isOverdue && <strong style={{ color: "red" }}>OVERDUE</strong>}</td>
              <td>
                {canUpdateStatus ? (
                  <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)}>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                ) : (
                  t.status
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
