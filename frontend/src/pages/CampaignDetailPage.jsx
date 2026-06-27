import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api/client";
import { asList } from "../utils/apiData";
import { CAN_CHANGE_STATUS, CAN_MANAGE_CAMPAIGNS } from "../utils/roles";
import { getStatusOptions } from "../utils/statusTransitions";

const emptyActivityForm = {
  channel: "",
  metric_source: "",
  name: "",
  description: "",
  status: "",
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [activities, setActivities] = useState([]);
  const [channels, setChannels] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [campaignStatuses, setCampaignStatuses] = useState([]);
  const [activityTransitions, setActivityTransitions] = useState([]);
  const [campaignTransitions, setCampaignTransitions] = useState([]);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [campaignForm, setCampaignForm] = useState(null);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [selectedCampaignStatus, setSelectedCampaignStatus] = useState("");
  const [selectedActivityStatuses, setSelectedActivityStatuses] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [formError, setFormError] = useState("");

  function load() {
    api.get(`/campaigns/${id}/`).then((res) => setCampaign(res.data));
    api.get(`/activities/?campaign=${id}`).then((res) => setActivities(asList(res.data)));
    api.get("/channels/").then((res) => setChannels(asList(res.data)));
    api.get("/metric-sources/").then((res) => setSources(asList(res.data)));
    api.get("/statuses/?entity_type=activity").then((res) => setStatuses(asList(res.data)));
    api.get("/statuses/?entity_type=campaign").then((res) => setCampaignStatuses(asList(res.data)));
    api.get("/status-transitions/?entity_type=activity").then((res) => setActivityTransitions(asList(res.data)));
    api.get("/status-transitions/?entity_type=campaign").then((res) => setCampaignTransitions(asList(res.data)));
    api.get("/me/").then((res) => setCurrentUser(res.data)).catch(() => setCurrentUser(null));
  }

  useEffect(load, [id]);

  function openCreate() {
    setEditingActivity(null);
    setFormError("");
    setActivityForm({
      ...emptyActivityForm,
      status: statuses.find((status) => status.name === "Запланирована")?.id || statuses[0]?.id || "",
    });
    setModalOpen(true);
  }

  function openEdit(activity) {
    setEditingActivity(activity);
    setFormError("");
    setActivityForm({
      channel: activity.channel,
      metric_source: activity.metric_source,
      name: activity.name,
      description: activity.description || "",
      status: activity.status,
    });
    setModalOpen(true);
  }

  function openCampaignEdit() {
    setFormError("");
    setCampaignForm({
      name: campaign.name,
      goal: campaign.goal,
      budget: campaign.budget,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status,
      responsible_user: campaign.responsible_user,
    });
    setCampaignModalOpen(true);
  }

  async function updateCampaign(event) {
    event.preventDefault();
    setFormError("");
    if (campaignForm.start_date && campaignForm.end_date && campaignForm.start_date > campaignForm.end_date) {
      setFormError("Дата начала не может быть позже даты окончания.");
      return;
    }
    await api.patch(`/campaigns/${id}/`, campaignForm);
    setCampaignModalOpen(false);
    load();
  }

  async function changeCampaignStatus(status) {
    await api.patch(`/campaigns/${id}/`, { status: status.id });
    setSelectedCampaignStatus("");
    load();
  }

  async function changeActivityStatus(activity, status) {
    await api.patch(`/activities/${activity.id}/`, { status: status.id });
    setSelectedActivityStatuses((values) => ({ ...values, [activity.id]: "" }));
    load();
  }

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    const payload = {
      ...activityForm,
      campaign: id,
      status: activityForm.status || statuses.find((status) => status.name === "Запланирована")?.id || statuses[0]?.id,
    };
    if (editingActivity) {
      await api.patch(`/activities/${editingActivity.id}/`, payload);
    } else {
      await api.post("/activities/", payload);
    }
    setModalOpen(false);
    setEditingActivity(null);
    setActivityForm(emptyActivityForm);
    load();
  }

  async function deleteActivity(activity) {
    if (!confirm(`Удалить активность "${activity.name}"?`)) return;
    await api.delete(`/activities/${activity.id}/`);
    load();
  }

  function isCampaignClosed() {
    return ["Завершена", "Отменена"].includes(campaign.status_name);
  }

  function isActivityClosed(activity) {
    return ["Выполнена", "Отменена"].includes(activity.status_name);
  }

  if (!campaign) return <p>Загрузка...</p>;

  const currentRole = currentUser?.profile?.role;
  const canManageCampaigns = CAN_MANAGE_CAMPAIGNS.includes(currentRole);
  const canChangeStatus = CAN_CHANGE_STATUS.includes(currentRole);
  const campaignStatusOptions = getStatusOptions(campaign.status_name, campaignStatuses, campaignTransitions);

  return (
    <>
      <div className="page-title">
        <div>
          <Link className="back-link" to="/campaigns">К списку кампаний</Link>
          <h1>{campaign.name}</h1>
        </div>
        {canManageCampaigns && <button className="plain-button" disabled={isCampaignClosed()} onClick={openCampaignEdit}>Изменить кампанию</button>}
      </div>

      <section className="campaign-hero">
        <div>
          <span className="section-label">Цель</span>
          <p>{campaign.goal}</p>
        </div>
        <div className="hero-facts">
          <div><span>Бюджет</span><strong>{campaign.budget} руб.</strong></div>
          <div><span>Сроки</span><strong>{campaign.start_date} - {campaign.end_date}</strong></div>
          <div><span>Статус</span><strong className="status-pill">{campaign.status_name}</strong></div>
        </div>
      </section>

      <section className="panel status-control">
        <div>
          <span className="section-label">Статус кампании</span>
          <h2>{campaign.status_name}</h2>
        </div>
        {canChangeStatus && <div className="status-actions">
          {campaignStatusOptions.length === 0 ? (
            <span className="muted-text">Доступных переходов нет</span>
          ) : (
            <select
              className="status-select"
              value={selectedCampaignStatus}
              onChange={(event) => {
                const status = campaignStatusOptions.find((item) => String(item.id) === event.target.value);
                setSelectedCampaignStatus(event.target.value);
                if (status) changeCampaignStatus(status);
              }}
            >
              <option value="">Сменить статус</option>
              {campaignStatusOptions.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
            </select>
          )}
        </div>}
      </section>

      <section className="nested-section">
        <div className="section-heading inline-heading activities-toolbar">
          <div>
            <span className="section-label">Вложенные данные</span>
            <h2>Активности кампании</h2>
          </div>
          {canManageCampaigns && <button className="primary-button" disabled={isCampaignClosed()} onClick={openCreate}>Добавить активность</button>}
        </div>

        {activities.length === 0 && <div className="empty-state">У этой кампании пока нет активностей.</div>}

        <div className="activity-list">
          {activities.map((activity) => (
            <article className="activity-row" key={activity.id}>
              <div className="activity-row-main" onClick={() => navigate(`/activities/${activity.id}`)}>
                <h3>{activity.name}</h3>
                <p>{activity.description || "Описание не заполнено"}</p>
              </div>
              <div className="activity-meta compact">
                <span>Канал: <b>{activity.channel_name}</b></span>
                <span>Источник: <b>{activity.metric_source_name}</b> ({activity.metric_source_type_display})</span>
              </div>
              <div className="activity-row-side">
                <span className="status-badge">{activity.status_name}</span>
                {canChangeStatus && !isCampaignClosed() && (
                  <div className="status-actions mini">
                    {getStatusOptions(activity.status_name, statuses, activityTransitions).length > 0 && (
                      <select
                        className="status-select small"
                        value={selectedActivityStatuses[activity.id] || ""}
                        onChange={(event) => {
                          const options = getStatusOptions(activity.status_name, statuses, activityTransitions);
                          const status = options.find((item) => String(item.id) === event.target.value);
                          setSelectedActivityStatuses((values) => ({ ...values, [activity.id]: event.target.value }));
                          if (status) changeActivityStatus(activity, status);
                        }}
                      >
                        <option value="">Сменить статус</option>
                        {getStatusOptions(activity.status_name, statuses, activityTransitions).map((status) => (
                          <option key={status.id} value={status.id}>{status.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {canManageCampaigns && (
                  <div className="table-actions">
                    <button className="plain-button small" disabled={isActivityClosed(activity)} onClick={() => openEdit(activity)}>Изменить</button>
                    <button className="danger-button small" onClick={() => deleteActivity(activity)}>Удалить</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window roomy-modal" onSubmit={submit}>
            <div className="modal-header">
              <h2>{editingActivity ? "Изменить активность" : "Добавить активность"}</h2>
              <button type="button" className="plain-button" onClick={() => setModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-grid">
              <label>Название активности<input required disabled={isActivityClosed(editingActivity || {})} value={activityForm.name} onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })} /></label>
              <label className="wide-field">Описание<textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} /></label>
              <label>
                Канал
                <select required disabled={editingActivity?.status_name === "В работе"} value={activityForm.channel} onChange={(e) => setActivityForm({ ...activityForm, channel: e.target.value })}>
                  <option value="">Выберите канал</option>
                  {channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                Источник метрик
                <select required disabled={editingActivity?.status_name === "В работе"} value={activityForm.metric_source} onChange={(e) => setActivityForm({ ...activityForm, metric_source: e.target.value })}>
                  <option value="">Выберите источник</option>
                  {sources.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.type})</option>)}
                </select>
              </label>
            </div>
            {formError && <p className="notice-text">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => setModalOpen(false)}>Отмена</button>
              <button className="primary-button">{editingActivity ? "Сохранить" : "Добавить"}</button>
            </div>
          </form>
        </div>
      )}

      {campaignModalOpen && campaignForm && (
        <div className="modal-backdrop">
          <form className="modal-window roomy-modal" onSubmit={updateCampaign}>
            <div className="modal-header">
              <h2>Изменить кампанию</h2>
              <button type="button" className="plain-button" onClick={() => setCampaignModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-grid">
              <label>Название<input required disabled={isCampaignClosed()} value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} /></label>
              <label className="wide-field">Цель<textarea required value={campaignForm.goal} onChange={(e) => setCampaignForm({ ...campaignForm, goal: e.target.value })} /></label>
              <label>Бюджет<input required type="number" min="0" value={campaignForm.budget} onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })} /></label>
              <label>Дата начала<input required type="date" disabled={campaign.status_name === "Активна"} value={campaignForm.start_date} onChange={(e) => setCampaignForm({ ...campaignForm, start_date: e.target.value })} /></label>
              <label>Дата окончания<input required type="date" value={campaignForm.end_date} onChange={(e) => setCampaignForm({ ...campaignForm, end_date: e.target.value })} /></label>
            </div>
            {formError && <p className="notice-text">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => setCampaignModalOpen(false)}>Отмена</button>
              <button className="primary-button">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
