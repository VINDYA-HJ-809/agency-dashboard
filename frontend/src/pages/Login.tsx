import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@agency.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", background: "#fff", padding: 32, borderRadius: 8 }}>
      <h2>Agency Dashboard</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            style={{ width: "100%", padding: 8 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            style={{ width: "100%", padding: 8 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" style={{ width: "100%", padding: 10 }}>
          Log in
        </button>
      </form>
      <p style={{ fontSize: 12, color: "#666", marginTop: 16 }}>
        Seeded users: admin@agency.test / pm1@agency.test / dev1@agency.test — password: password123
      </p>
    </div>
  );
}
