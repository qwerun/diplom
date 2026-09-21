import { useEffect, useState } from "react";

import api from "../api/client";

const emptyPasswordForm = { current_password: "", new_password: "", confirm_password: "" };

function formatError(error, fallback) {
  const data = error.response?.data;
  if (!data || typeof data !== "object") return fallback;
  if (data.detail) return data.detail;
  const first = Object.values(data)[0];
  return Array.isArray(first) ? first.join(" ") : String(first || fallback);
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    api.get("/me/")
      .then(({ data }) => {
        setUser(data);
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
        });
      })
      .catch(() => setProfileError("Не удалось загрузить данные профиля."));
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/me/", form);
      setUser(data);
      setProfileMessage("Данные профиля сохранены.");
    } catch (error) {
      setProfileError(formatError(error, "Не удалось сохранить профиль."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("Новый пароль и подтверждение не совпадают.");
      return;
    }
    setSavingPassword(true);
    try {
      await api.post("/me/change-password/", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Пароль изменён.");
    } catch (error) {
      setPasswordError(formatError(error, "Не удалось изменить пароль."));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="section-label">Учётная запись</span>
          <h1>Личный кабинет</h1>
        </div>
      </div>

      {!user ? (
        <section className="panel">{profileError || "Загрузка профиля..."}</section>
      ) : (
        <div className="account-grid">
          <section className="panel account-card">
            <h2>Мои данные</h2>
            <p className="account-hint">Здесь можно обновить контактные данные. Логин и роль назначаются администратором.</p>
            <div className="account-facts">
              <div><span>Логин</span><strong>{user.username}</strong></div>
              <div><span>Роль</span><strong>{user.profile?.role_display || "Не назначена"}</strong></div>
            </div>
            <form className="account-form" onSubmit={saveProfile}>
              <label>Имя<input maxLength="150" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
              <label>Фамилия<input maxLength="150" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
              <label>Email<input type="email" maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              {profileError && <p className="form-error" role="alert">{profileError}</p>}
              {profileMessage && <p className="form-success" role="status">{profileMessage}</p>}
              <button className="primary-button" disabled={savingProfile}>{savingProfile ? "Сохранение..." : "Сохранить данные"}</button>
            </form>
          </section>

          <section className="panel account-card">
            <h2>Смена пароля</h2>
            <p className="account-hint">Для безопасности укажите действующий пароль перед созданием нового.</p>
            <form className="account-form" onSubmit={changePassword}>
              <label>Текущий пароль<input required type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={(event) => setPasswordForm({ ...passwordForm, current_password: event.target.value })} /></label>
              <label>Новый пароль<input required type="password" minLength="8" autoComplete="new-password" value={passwordForm.new_password} onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })} /></label>
              <label>Повторите новый пароль<input required type="password" minLength="8" autoComplete="new-password" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm({ ...passwordForm, confirm_password: event.target.value })} /></label>
              {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
              {passwordMessage && <p className="form-success" role="status">{passwordMessage}</p>}
              <button className="primary-button" disabled={savingPassword}>{savingPassword ? "Сохранение..." : "Изменить пароль"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
