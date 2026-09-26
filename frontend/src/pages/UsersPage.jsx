import { useEffect, useState } from "react";

import api from "../api/client";
import DataTable from "../components/DataTable";
import ErrorDialog from "../components/ErrorDialog";
import { asList } from "../utils/apiData";
import { ROLE_LABELS } from "../utils/roles";
import { formatApiError } from "../utils/apiErrors";


const emptyForm = {
  username: "",
  password: "12345678",
  first_name: "",
  last_name: "",
  email: "",
  profile: { role: "manager" },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function load() {
    api.get("/users/").then((res) => setUsers(asList(res.data)));
  }

  useEffect(load, []);

  function openCreate() {
    setError("");
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(user) {
    setError("");
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      profile: { role: user.profile?.role || "manager" },
    });
    setModalOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const payload = { ...form };
    if (editingUser && !payload.password) {
      delete payload.password;
    }
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}/`, payload);
      } else {
        await api.post("/users/", payload);
      }
      setModalOpen(false);
      setEditingUser(null);
      setForm(emptyForm);
      load();
    } catch (requestError) {
      setError(formatApiError(requestError, "Не удалось сохранить пользователя."));
    }
  }

  async function deleteUser(user) {
    if (!confirm(`Удалить пользователя "${user.username}"?`)) return;
    setError("");
    try {
      await api.delete(`/users/${user.id}/`);
      load();
    } catch (requestError) {
      setError(formatApiError(requestError, "Не удалось удалить пользователя."));
    }
  }

  return (
    <>
      <div className="page-title">
        <h1>Пользователи</h1>
        <button className="primary-button" onClick={openCreate}>Создать пользователя</button>
      </div>
      <ErrorDialog message={error} onClose={() => setError("")} />
      <DataTable rows={users} columns={[
        { key: "username", title: "Логин" },
        { key: "full_name", title: "ФИО" },
        { key: "email", title: "Email" },
        { key: "role", title: "Роль", render: (row) => row.profile?.role_display },
        { key: "actions", title: "Действия", render: (row) => (
          <div className="table-actions">
            <button className="plain-button small" onClick={() => openEdit(row)}>Изменить</button>
            <button className="danger-button small" onClick={() => deleteUser(row)}>Удалить</button>
          </div>
        ) },
      ]} />

      {modalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window" onSubmit={submit}>
            <div className="modal-header">
              <h2>{editingUser ? "Изменить пользователя" : "Новый пользователь"}</h2>
              <button type="button" className="plain-button" onClick={() => setModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-grid">
              <label>Логин<input required disabled={Boolean(editingUser)} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
              <label>Имя<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
              <label>Фамилия<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>{editingUser ? "Новый пароль" : "Пароль"}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <label>
                Роль
                <select value={form.profile.role} onChange={(e) => setForm({ ...form, profile: { role: e.target.value } })}>
                  {ROLE_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {editingUser && <p className="notice-text">Логин не меняется после создания, потому что используется как учетный идентификатор пользователя.</p>}
            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => setModalOpen(false)}>Отмена</button>
              <button className="primary-button">{editingUser ? "Сохранить" : "Создать"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
