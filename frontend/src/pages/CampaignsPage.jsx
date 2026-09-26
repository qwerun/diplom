import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client";
import DataTable from "../components/DataTable";
import { asList } from "../utils/apiData";
import { formatApiError } from "../utils/apiErrors";
import { CAN_MANAGE_CAMPAIGNS } from "../utils/roles";

const emptyForm = {
  name: "",
  goal: "",
  budget: 0,
  start_date: "",
  end_date: "",
  status: "",
  responsible_user: "",
  executor: "",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [managers, setManagers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [executors, setExecutors] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [currentUser, setCurrentUser] = useState(null);

  const currentRole = currentUser?.profile?.role;
  const canManageCampaigns = CAN_MANAGE_CAMPAIGNS.includes(currentRole);

  function campaignQueryParams(targetPage = page) {
    const params = { page: targetPage };
    if (search.trim()) params.search = search.trim();
    if (selectedStatus) params.status = selectedStatus;
    return params;
  }

  function load() {
    setError("");
    api.get("/campaigns/", { params: campaignQueryParams() })
      .then((res) => {
        setCampaigns(asList(res.data));
        setCampaignsCount(res.data?.count ?? asList(res.data).length);
        setHasNextPage(Boolean(res.data?.next));
        setHasPreviousPage(Boolean(res.data?.previous));
      })
      .catch(() => setError("Список кампаний не загрузился. Проверьте, что backend запущен и выполнен вход."));
    api.get("/me/", { silentError: true }).then((res) => setCurrentUser(res.data)).catch(() => setCurrentUser(null));
    api.get("/users/managers/", { silentError: true }).then((res) => setManagers(asList(res.data))).catch(() => setManagers([]));
    api.get("/users/executors/", { silentError: true }).then((res) => setExecutors(asList(res.data))).catch(() => setExecutors([]));
    api.get("/statuses/?entity_type=campaign", { silentError: true }).then((res) => setStatuses(asList(res.data))).catch(() => setStatuses([]));
  }

  useEffect(load, [page, search, selectedStatus]);

  function defaultCampaignStatusId() {
    return statuses.find((status) => status.is_initial)?.id || statuses[0]?.id || "";
  }

  function datesAreValid() {
    return !form.start_date || !form.end_date || form.start_date <= form.end_date;
  }

  function openCreate() {
    setEditingCampaign(null);
    setError("");
    setForm({
      ...emptyForm,
      responsible_user: managers.length === 1 ? managers[0].id : "",
      executor: "",
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
      executor: campaign.executor || "",
    });
    setIsModalOpen(true);
  }

  function isClosed(campaign) {
    return Boolean(campaign.status_is_terminal);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!datesAreValid()) {
      setError("Дата начала не может быть позже даты окончания.");
      return;
    }
    try {
      if (editingCampaign) {
        await api.patch(`/campaigns/${editingCampaign.id}/`, { ...form, executor: form.executor || null });
      } else {
        const { status, ...createForm } = form;
        await api.post("/campaigns/", { ...createForm, executor: form.executor || null });
      }
      setForm(emptyForm);
      setEditingCampaign(null);
      setIsModalOpen(false);
      setPage(1);
      load();
    } catch (err) {
      setError(formatApiError(err, "Кампанию не удалось сохранить."));
    }
  }

  async function deleteCampaign(campaign) {
    if (!confirm(`Удалить кампанию "${campaign.name}"?`)) return;
    await api.delete(`/campaigns/${campaign.id}/`);
    if (page !== 1) {
      setPage(1);
    } else {
      load();
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="section-label">Рабочий раздел</span>
          <h1>Рекламные кампании</h1>
        </div>
        <div className="filters">
          <input placeholder="Поиск" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
          <strong>{campaignsCount} шт.</strong>
        </div>
        {statuses.length > 0 && (
          <label className="status-filter-select">
            <span>Статус</span>
            <select value={selectedStatus} onChange={(event) => { setSelectedStatus(event.target.value); setPage(1); }}>
              <option value="">Все статусы</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>{status.name}</option>
              ))}
            </select>
          </label>
        )}
        <DataTable
          rows={campaigns}
          emptyText="Кампании пока не созданы или не найдены."
          columns={[
            { key: "name", title: "Название", render: (row) => <Link className="table-link" to={`/campaigns/${row.id}`}>{row.name}</Link> },
            { key: "status_name", title: "Статус" },
            { key: "responsible_user_name", title: "Менеджер" },
            { key: "executor_name", title: "Исполнитель", render: (row) => row.executor_name || "Не назначен" },
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
        <div className="pagination-bar">
          <button className="plain-button small" disabled={!hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))}>Назад</button>
          <span>Страница {page}</span>
          <button className="plain-button small" disabled={!hasNextPage} onClick={() => setPage((value) => value + 1)}>Вперед</button>
        </div>
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
              <label>Дата начала<input required type="date" disabled={editingCampaign?.status_locks_fields} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
              <label>Дата окончания<input required type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
              <label>
                Ответственный менеджер
                <select required disabled={editingCampaign?.status_locks_fields} value={form.responsible_user} onChange={(e) => setForm({ ...form, responsible_user: e.target.value })}>
                  <option value="">Выберите пользователя</option>
                  {managers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                </select>
              </label>
              <label>
                Исполнитель
                <select value={form.executor} onChange={(e) => setForm({ ...form, executor: e.target.value })}>
                  <option value="">Не назначен</option>
                  {executors.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
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
