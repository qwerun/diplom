import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "admin", password: "12345678" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch {
      setError("Не удалось войти. Проверьте логин и пароль.");
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">МУИВ</div>
        <h1>Рекламные кампании университета</h1>
        <label>
          Логин
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>
          Пароль
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button">Войти</button>
      </form>
    </main>
  );
}
