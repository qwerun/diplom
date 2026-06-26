import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client";
import DataTable from "../components/DataTable";
import { asList } from "../utils/apiData";
import { CAN_MANAGE_CAMPAIGNS } from "../utils/roles";

const emptyForm = {
  name: "",
  goal: "",
  budget: 0,
  start_date: "",
  end_date: "",
  status: "",
  responsible_user: "",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [currentUser, setCurrentUser] = useState(null);

  const currentRole = currentUser?.profile?.role;
  const canManageCampaigns = CAN_MANAGE_CAMPAIGNS.includes(currentRole);

  const visibleCampaigns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return campaigns.filter((campaign) => {
      const matchesStatus = !selectedStatus || campaign.status_name === selectedStatus;
      const matchesSearch = !query || [campaign.name, campaign.goal, campaign.status_name, campaign.responsible_user_name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, search, selectedStatus]);

  function load() {
    setError("");
    api.get("/campaigns/")
      .then((res) => setCampaigns(asList(res.data)))
      .catch(() => setError("Список кампаний не загрузился. Проверьте, что backend запущен и выполнен вход."));
    api.get("/me/").then((res) => setCurrentUser(res.data)).catch(() => setCurrentUser(null));
    api.get("/users/")
      .then((res) => setUsers(asList(res.data)))
      .catch(() => {
        api.get("/me/").then((res) => setUsers([res.data])).catch(() => setUsers([]));
      });
    api.get("/statuses/?entity_type=campaign").then((res) => setStatuses(asList(res.data))).catch(() => setStatuses([]));
  }

  useEffect(load, []);

  function defaultCampaignStatusId() {
    return statuses.find((status) => status.name === "Черновик")?.id || statuses[0]?.id || "";
  }

  function datesAreValid() {
    return !form.start_date || !form.end_date || form.start_date <= form.end_date;
  }

  function openCreate() {
    setEditingCampaign(null);
    setError("");
    setForm({
      ...emptyForm,
      status: defaultCampaignStatusId(),
      responsible_user: users.length === 1 ? users[0].id : "",
    });
    setIsModalOpen(true);
  }

  function openEdit(campaign) {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      goal: campaign.goal,
      budget: campaign.budget,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status,
      responsible_user: campaign.responsible_user,
    });
    setIsModalOpen(true);
  }

  function isClosed(campaign) {
    return ["Завершена", "Отменена"].includes(campaign.status_name);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!datesAreValid()) {
      setError("Дата начала не может быть позже даты окончания.");
      return;
    }
    if (editingCampaign) {
      await api.patch(`/campaigns/${editingCampaign.id}/`, form);
    } else {
      await api.post("/campaigns/", { ...form, status: form.status || defaultCampaignStatusId() });
    }
    setForm(emptyForm);
    setEditingCampaign(null);
    setIsModalOpen(false);
    load();
  }

  async function deleteCampaign(campaign) {
    if (!confirm(`Удалить кампанию "${campaign.name}"?`)) return;
    await api.delete(`/campaigns/${campaign.id}/`);
    load();
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="section-label">Рабочий раздел</span>
          <h1>Рекламные кампании</h1>
        </div>
        <div className="filters">
          <input placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canManageCampaigns && <button className="primary-button" onClick={openCreate}>Создать кампанию</button>}
        </div>
      </div>
      {error && <p className="notice-text">{error}</p>}

      <section className="panel campaigns-list-panel">
        <div className="section-heading inline-heading">
          <div>
            <span className="section-label">Созданные записи</span>
            <h2>Список кампаний</h2>
          </div>
          <strong>{visibleCampaigns.length} шт.</strong>
        </div>
        {statuses.length > 0 && (
          <label className="status-filter-select">
            <span>Статус</span>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="">Все статусы</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.name}>{status.name}</option>
              ))}
            </select>
          </label>
        )}
        <DataTable
          rows={visibleCampaigns}
          emptyText="Кампании пока не созданы или не найдены."
          columns={[
            { key: "name", title: "Название", render: (row) => <Link className="table-link" to={`/campaigns/${row.id}`}>{row.name}</Link> },
            { key: "status_name", title: "Статус" },
            { key: "responsible_user_name", title: "Ответственный" },
            { key: "budget", title: "Бюджет" },
            { key: "start_date", title: "Дата начала" },
            { key: "end_date", title: "Дата окончания" },
            ...(canManageCampaigns ? [{ key: "actions", title: "Действия", render: (row) => (
              <div className="table-actions">
                <button className="plain-button small" disabled={isClosed(row)} onClick={() => openEdit(row)}>Изменить</button>
                <button className="danger-button small" onClick={() => deleteCampaign(row)}>Удалить</button>
              </div>
            ) }] : []),
          ]}
        />
      </section>

      {isModalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window roomy-modal" onSubmit={submit}>
            <div className="modal-header">
              <div>
                <span className="section-label">{editingCampaign ? "Редактирование" : "Новая запись"}</span>
                <h2>{editingCampaign ? "Изменить кампанию" : "Создание кампании"}</h2>
              </div>
              <button type="button" className="plain-button" onClick={() => setIsModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-grid">
              <label>Название кампании<input required disabled={isClosed(editingCampaign || {})} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="wide-field">Цель кампании<textarea required value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></label>
              <label>Бюджет, руб.<input required type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
              <label>Дата начала<input required type="date" disabled={editingCampaign?.status_name === "Активна"} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
              <label>Дата окончания<input required type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
              <label>
                Ответственный
                <select required disabled={editingCampaign?.status_name === "Активна"} value={form.responsible_user} onChange={(e) => setForm({ ...form, responsible_user: e.target.value })}>
                  <option value="">Выберите пользователя</option>
                  {users.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                </select>
              </label>
            </div>
            {error && <p className="notice-text">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => setIsModalOpen(false)}>Отмена</button>
              <button className="primary-button">{editingCampaign ? "Сохранить" : "Создать"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
