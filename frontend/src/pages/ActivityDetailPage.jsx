import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../api/client";
import { asList } from "../utils/apiData";
import { CAN_CHANGE_STATUS, CAN_EDIT_EXECUTION, CAN_MANAGE_CAMPAIGNS } from "../utils/roles";
import { getStatusOptions } from "../utils/statusTransitions";

export default function ActivityDetailPage() {
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [metricTypes, setMetricTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [statusTransitions, setStatusTransitions] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [resultForm, setResultForm] = useState({ result_url: "", comment: "" });
  const [metricForm, setMetricForm] = useState({ metric_type: "", planned_value: "", actual_value: "" });
  const [mediaForm, setMediaForm] = useState({ title: "", file: null });
  const [mediaError, setMediaError] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [metricsMessage, setMetricsMessage] = useState("");
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const campaignUrl = useMemo(() => activity ? `/campaigns/${activity.campaign}` : "/campaigns", [activity]);

  function load() {
    api.get(`/activities/${id}/`).then((res) => setActivity(res.data));
    api.get(`/activity-results/?activity=${id}`).then((res) => {
      const item = asList(res.data)[0] || null;
      setResult(item);
      setResultForm({ result_url: item?.result_url || "", comment: item?.comment || "" });
    });
    api.get(`/metric-values/?activity=${id}`).then((res) => setMetrics(asList(res.data)));
    api.get("/metric-types/").then((res) => setMetricTypes(asList(res.data)));
    api.get("/statuses/?entity_type=activity").then((res) => setStatuses(asList(res.data)));
    api.get("/status-transitions/?entity_type=activity").then((res) => setStatusTransitions(asList(res.data)));
    api.get(`/activity-media/?activity=${id}`).then((res) => setMediaFiles(asList(res.data)));
    api.get("/me/").then((res) => setCurrentUser(res.data)).catch(() => setCurrentUser(null));
  }

  useEffect(load, [id]);

  async function saveResult(event) {
    event.preventDefault();
    if (result) {
      await api.patch(`/activity-results/${result.id}/`, resultForm);
    } else {
      await api.post("/activity-results/", { ...resultForm, activity: id });
    }
    setResultModalOpen(false);
    load();
  }

  function openMetricModal(metric = null) {
    setEditingMetric(metric);
    setMetricForm(metric ? {
      metric_type: metric.metric_type,
      planned_value: metric.planned_value,
      actual_value: metric.actual_value,
    } : { metric_type: "", planned_value: "", actual_value: "" });
    setMetricModalOpen(true);
  }

  async function saveMetric(event) {
    event.preventDefault();
    const payload = {
      activity: id,
      metric_type: metricForm.metric_type,
      planned_value: metricForm.planned_value || 0,
      actual_value: activity?.metric_source_type === "API"
        ? editingMetric?.actual_value || 0
        : metricForm.actual_value || 0,
    };
    if (editingMetric) {
      await api.patch(`/metric-values/${editingMetric.id}/`, payload);
    } else {
      await api.post("/metric-values/", payload);
    }
    setMetricForm({ metric_type: "", planned_value: "", actual_value: "" });
    setEditingMetric(null);
    setMetricModalOpen(false);
    load();
  }

  async function deleteMetric(metric) {
    if (!confirm(`Удалить метрику "${metric.metric_type_name}"?`)) return;
    await api.delete(`/metric-values/${metric.id}/`);
    load();
  }

  async function collectMetrics() {
    setMetricsLoading(true);
    setMetricsMessage("");
    try {
      const { data } = await api.post(`/activities/${id}/collect-metrics/`);
      setMetrics(data.metrics || []);
      setMetricsMessage(data.detail || "Метрики обновлены.");
    } catch (error) {
      setMetricsMessage(error.response?.data?.detail || "Не удалось обновить метрики.");
    } finally {
      setMetricsLoading(false);
    }
  }

  async function changeStatus(status) {
    await api.patch(`/activities/${id}/`, { status: status.id });
    setSelectedStatus("");
    load();
  }

  async function uploadMedia(event) {
    event.preventDefault();
    if (!mediaForm.file) {
      setMediaError("Выберите файл для загрузки.");
      return;
    }
    if (!mediaForm.file.type.startsWith("image/")) {
      setMediaError("Можно загружать только фотографии.");
      return;
    }

    const formData = new FormData();
    formData.append("activity", id);
    formData.append("title", mediaForm.title);
    formData.append("file", mediaForm.file);

    setMediaUploading(true);
    setMediaError("");
    try {
      await api.post("/activity-media/", formData);
      setMediaForm({ title: "", file: null });
      setMediaModalOpen(false);
      load();
    } catch (error) {
      const data = error.response?.data;
      if (typeof data === "string") {
        setMediaError(
          data.includes("<!DOCTYPE") || data.includes("<html")
            ? "Сервер вернул техническую ошибку. Проверьте миграции и повторите загрузку."
            : data
        );
      } else if (data?.detail) {
        setMediaError(data.detail);
      } else if (data?.file) {
        setMediaError(Array.isArray(data.file) ? data.file.join(" ") : data.file);
      } else if (data?.activity) {
        setMediaError(Array.isArray(data.activity) ? data.activity.join(" ") : data.activity);
      } else {
        setMediaError("Файл не загрузился. Проверьте, что миграции применены и сервер запущен.");
      }
    } finally {
      setMediaUploading(false);
    }
  }

  async function deleteMedia(file) {
    if (!confirm(`Удалить файл "${file.title || file.file}"?`)) return;
    await api.delete(`/activity-media/${file.id}/`);
    load();
  }

  async function downloadMedia(file) {
    const url = file.download_url || file.file_url || file.file;
    const link = document.createElement("a");
    const fallbackName = decodeURIComponent(url.split("/").pop() || "photo");
    const extension = fallbackName.includes(".") ? `.${fallbackName.split(".").pop()}` : "";
    const title = file.title?.trim();
    link.href = url;
    link.download = title ? (title.includes(".") ? title : `${title}${extension}`) : fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (!activity) return <p>Загрузка...</p>;

  const isCanceled = activity.status_name === "Отменена";
  const activityStatusOptions = getStatusOptions(activity.status_name, statuses, statusTransitions);
  const isApiSource = activity.metric_source_type === "API";
  const currentRole = currentUser?.profile?.role;
  const canManageActivity = CAN_MANAGE_CAMPAIGNS.includes(currentRole);
  const canChangeStatus = CAN_CHANGE_STATUS.includes(currentRole);
  const canEditResult = CAN_EDIT_EXECUTION.includes(currentRole);
  const canEditMetrics = CAN_EDIT_EXECUTION.includes(currentRole);
  const resultTitle = isApiSource ? "Пост / результат" : "Результат";
  const resultLinkLabel = isApiSource ? "Ссылка на пост" : "Ссылка";

  return (
    <>
      <div className="page-title">
        <div>
          <Link className="back-link" to={campaignUrl}>К кампании</Link>
          <h1>{activity.name}</h1>
        </div>
        <span className="status-badge">{activity.status_name}</span>
      </div>

      <section className="activity-detail-hero">
        <p>{activity.description || "Описание активности не заполнено."}</p>
        <div className="activity-meta">
          <span>Кампания: <b>{activity.campaign_name}</b></span>
          <span>Канал: <b>{activity.channel_name}</b></span>
          <span>Источник: <b>{activity.metric_source_name}</b></span>
          <span>Сбор метрик: <b>{activity.metric_source_type_display}</b></span>
        </div>
      </section>

      <section className="panel status-control">
        <div>
          <span className="section-label">Статус активности</span>
          <h2>{activity.status_name}</h2>
        </div>
        {canChangeStatus && <div className="status-actions">
          {activityStatusOptions.length === 0 ? (
            <span className="muted-text">Доступных переходов нет</span>
          ) : (
            <select
              className="status-select"
              value={selectedStatus}
              onChange={(event) => {
                const status = activityStatusOptions.find((item) => String(item.id) === event.target.value);
                setSelectedStatus(event.target.value);
                if (status) changeStatus(status);
              }}
            >
              <option value="">Сменить статус</option>
              {activityStatusOptions.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
            </select>
          )}
        </div>}
      </section>

      <div className="detail-columns">
        <section className="panel">
          <div className="inline-heading section-heading">
            <div>
              <span className="section-label">Исполнение</span>
              <h2>{resultTitle}</h2>
            </div>
            {canEditResult && <button className="secondary-button" disabled={isCanceled} onClick={() => setResultModalOpen(true)}>
              {result ? "Изменить" : "Добавить"}
            </button>}
          </div>
          {result ? (
            <div className="result-summary">
              <span>{resultLinkLabel}</span>
              {result.result_url ? <a href={result.result_url} target="_blank">{isApiSource ? "Открыть пост" : "Открыть результат"}</a> : <b>Не указана</b>}
              <span>Комментарий</span>
              <p>{result.comment || "Комментарий не заполнен"}</p>
            </div>
          ) : (
            <div className="empty-state compact-empty">Результат еще не добавлен.</div>
          )}
        </section>

        <section className="panel">
          <div className="inline-heading section-heading">
            <div>
              <span className="section-label">План / факт</span>
              <h2>Метрики</h2>
            </div>
            {canEditMetrics && <div className="toolbar-actions">
              {isApiSource && (
                <button className="plain-button" disabled={isCanceled || metricsLoading} onClick={collectMetrics}>
                  {metricsLoading ? "Обновление..." : "Обновить из API"}
                </button>
              )}
              <button className="secondary-button" disabled={isCanceled} onClick={() => openMetricModal()}>Добавить</button>
            </div>}
          </div>
          {isApiSource && <p className="notice-text compact-note">Источник активности работает через API: результатом считается ссылка на пост, по ней обновляется факт для добавленных метрик.</p>}
          {!isApiSource && <p className="notice-text compact-note">Источник активности ручной: план и факт заполняются пользователем.</p>}
          {metricsMessage && <p className="notice-text compact-note">{metricsMessage}</p>}
          <div className="mini-table metrics-list">
            {metrics.length === 0 && <div><span>Метрики пока не добавлены</span></div>}
            {metrics.map((metric) => (
              <div className={canEditMetrics && !isCanceled ? "metric-row editable" : "metric-row"} key={metric.id}>
                <span>{metric.metric_type_name}</span>
                <b>{metric.actual_value} / {metric.planned_value} {metric.unit}</b>
                <em>{metric.completion_percent}%</em>
                {canEditMetrics && !isCanceled && (
                  <div className="table-actions">
                    <button className="plain-button small" onClick={() => openMetricModal(metric)}>Изменить</button>
                    <button className="danger-button small" onClick={() => deleteMetric(metric)}>Удалить</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {isCanceled && <p className="notice-text">Отмененная активность закрыта: результат и метрики больше не редактируются.</p>}
        </section>
      </div>

      <section className="panel media-panel">
        <div className="inline-heading section-heading">
          <div>
            <span className="section-label">Материалы</span>
            <h2>Медиафайлы</h2>
          </div>
          {canManageActivity && <button
            className="secondary-button"
            disabled={isCanceled}
            onClick={() => {
              setMediaError("");
              setMediaModalOpen(true);
            }}
          >
            Прикрепить файл
          </button>}
        </div>
        {mediaFiles.length === 0 && <div className="empty-state compact-empty">Файлы пока не прикреплены.</div>}
        <div className="media-list">
          {mediaFiles.map((file) => (
            <div className="media-item" key={file.id}>
              <a className="media-preview" href={file.preview_url || file.file_url || file.file} target="_blank" title="Открыть фото">
                <img src={file.preview_url || file.file_url || file.file} alt={file.title || "Фото"} />
              </a>
              <div className="media-info">
                <b>{file.title || "Фото"}</b>
                <span>{new Date(file.uploaded_at).toLocaleString("ru-RU")}</span>
              </div>
              <button type="button" className="plain-button small download-link" onClick={() => downloadMedia(file)}>
                Скачать
              </button>
              {canManageActivity && <button className="danger-button small" onClick={() => deleteMedia(file)}>Удалить</button>}
            </div>
          ))}
        </div>
      </section>

      {resultModalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window compact-modal" onSubmit={saveResult}>
            <div className="modal-header">
              <h2>{result ? `Изменить ${resultTitle.toLowerCase()}` : `Добавить ${resultTitle.toLowerCase()}`}</h2>
              <button type="button" className="plain-button" onClick={() => setResultModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-grid one-column">
              <label>
                {resultLinkLabel}
                <input type="url" placeholder="https://..." value={resultForm.result_url} onChange={(e) => setResultForm({ ...resultForm, result_url: e.target.value })} />
              </label>
              <label>
                Комментарий исполнителя
                <textarea placeholder="Что было сделано" value={resultForm.comment} onChange={(e) => setResultForm({ ...resultForm, comment: e.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => setResultModalOpen(false)}>Отмена</button>
              <button className="primary-button">Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {metricModalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window compact-modal" onSubmit={saveMetric}>
            <div className="modal-header">
              <h2>{editingMetric ? "Изменить метрику" : "Добавить метрику"}</h2>
              <button type="button" className="plain-button" onClick={() => { setMetricModalOpen(false); setEditingMetric(null); }}>Закрыть</button>
            </div>
            <div className="modal-grid">
              <label>
                Тип метрики
                <select required disabled={Boolean(editingMetric)} value={metricForm.metric_type} onChange={(e) => setMetricForm({ ...metricForm, metric_type: e.target.value })}>
                  <option value="">Выберите метрику</option>
                  {metricTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                Плановое значение
                <input type="number" min="0" value={metricForm.planned_value} onChange={(e) => setMetricForm({ ...metricForm, planned_value: e.target.value })} />
              </label>
              <label>
                Фактическое значение
                <input
                  type="number"
                  min="0"
                  disabled={isApiSource}
                  value={isApiSource ? 0 : metricForm.actual_value}
                  onChange={(e) => setMetricForm({ ...metricForm, actual_value: e.target.value })}
                />
              </label>
            </div>
            {isApiSource && <p className="notice-text compact-note">Для API-источника здесь задается план. Факт заполнится после обновления по ссылке на пост.</p>}
            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => { setMetricModalOpen(false); setEditingMetric(null); }}>Отмена</button>
              <button className="primary-button">{editingMetric ? "Сохранить" : "Добавить"}</button>
            </div>
          </form>
        </div>
      )}

      {mediaModalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window compact-modal" onSubmit={uploadMedia}>
            <div className="modal-header">
              <h2>Прикрепить медиафайл</h2>
              <button type="button" className="plain-button" onClick={() => setMediaModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-grid one-column">
              <label>
                Название файла
                <input value={mediaForm.title} onChange={(e) => setMediaForm({ ...mediaForm, title: e.target.value })} />
              </label>
              <label>
                Фото
                <input required type="file" accept="image/*" onChange={(e) => setMediaForm({ ...mediaForm, file: e.target.files[0] })} />
              </label>
            </div>
            {mediaError && <p className="form-error">{mediaError}</p>}
            <div className="modal-actions">
              <button type="button" className="plain-button" disabled={mediaUploading} onClick={() => setMediaModalOpen(false)}>Отмена</button>
              <button className="primary-button" disabled={mediaUploading || !mediaForm.file}>
                {mediaUploading ? "Загружается..." : "Загрузить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
