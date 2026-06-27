import { useEffect, useMemo, useState } from "react";

import api from "../api/client";
import DataTable from "../components/DataTable";
import { asList } from "../utils/apiData";

const sections = [
  { id: "channels", label: "Каналы" },
  { id: "sources", label: "Источники метрик" },
  { id: "types", label: "Типы метрик" },
  { id: "statuses", label: "Статусы" },
];

const entityLabels = {
  campaign: "Кампания",
  activity: "Активность",
};

export default function DictionariesPage() {
  const [activeSection, setActiveSection] = useState("channels");
  const [statusTab, setStatusTab] = useState("list");
  const [transitionEntity, setTransitionEntity] = useState("campaign");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [channels, setChannels] = useState([]);
  const [sources, setSources] = useState([]);
  const [types, setTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [transitionDraft, setTransitionDraft] = useState([]);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", url: "" });
  const [sourceForm, setSourceForm] = useState({ name: "", type: "MANUAL", is_active: true });
  const [typeForm, setTypeForm] = useState({ name: "", unit: "" });
  const [statusForm, setStatusForm] = useState({ name: "", entity_type: "campaign" });

  function load() {
    api.get("/channels/").then((res) => setChannels(asList(res.data)));
    api.get("/metric-sources/").then((res) => setSources(asList(res.data)));
    api.get("/metric-types/").then((res) => setTypes(asList(res.data)));
    api.get("/statuses/").then((res) => setStatuses(asList(res.data)));
    api.get("/status-transitions/").then((res) => setTransitions(asList(res.data)));
  }

  useEffect(load, []);

  const matrixStatuses = statuses.filter((status) => status.entity_type === transitionEntity);
  const matrixTransitions = transitions.filter((transition) => transition.entity_type === transitionEntity);

  useEffect(() => {
    setTransitionDraft(matrixTransitions.map((transition) => `${transition.from_status}:${transition.to_status}`));
  }, [transitions, transitionEntity]);

  const current = useMemo(() => {
    if (activeSection === "channels") {
      return {
        title: "Каналы",
        rows: channels,
        columns: [
          { key: "name", title: "Название" },
          { key: "url", title: "Ссылка" },
          { key: "actions", title: "Действия", render: (row) => actions(row) },
        ],
      };
    }
    if (activeSection === "sources") {
      return {
        title: "Источники метрик",
        rows: sources,
        columns: [
          { key: "name", title: "Название" },
          { key: "type", title: "Тип" },
          { key: "is_active", title: "Активен", render: (row) => row.is_active ? "Да" : "Нет" },
          { key: "actions", title: "Действия", render: (row) => actions(row) },
        ],
      };
    }
    if (activeSection === "types") {
      return {
        title: "Типы метрик",
        rows: types,
        columns: [
          { key: "name", title: "Название" },
          { key: "unit", title: "Ед. изм." },
          { key: "actions", title: "Действия", render: (row) => actions(row) },
        ],
      };
    }
    return {
      title: "Статусы",
      rows: statuses,
      columns: [
        { key: "name", title: "Название" },
        { key: "entity_type", title: "Сущность", render: (row) => entityLabels[row.entity_type] || row.entity_type },
        { key: "actions", title: "Действия", render: (row) => actions(row) },
      ],
    };
  }, [activeSection, channels, sources, statuses, types]);

  function actions(row) {
    return (
      <div className="table-actions">
        <button className="plain-button small" onClick={() => openEdit(row)}>Изменить</button>
        <button className="danger-button small" onClick={() => deleteItem(row)}>Удалить</button>
      </div>
    );
  }

  function resetForms() {
    setChannelForm({ name: "", url: "" });
    setSourceForm({ name: "", type: "MANUAL", is_active: true });
    setTypeForm({ name: "", unit: "" });
    setStatusForm({ name: "", entity_type: "campaign" });
  }

  function openCreate() {
    setEditingItem(null);
    resetForms();
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingItem(row);
    if (activeSection === "channels") setChannelForm({ name: row.name, url: row.url || "" });
    if (activeSection === "sources") setSourceForm({ name: row.name, type: row.type, is_active: row.is_active });
    if (activeSection === "types") setTypeForm({ name: row.name, unit: row.unit });
    if (activeSection === "statuses") setStatusForm({ name: row.name, entity_type: row.entity_type });
    setModalOpen(true);
  }

  async function saveItem(event) {
    event.preventDefault();
    if (activeSection === "channels") {
      if (editingItem) await api.patch(`/channels/${editingItem.id}/`, channelForm);
      else await api.post("/channels/", channelForm);
    }
    if (activeSection === "sources") {
      if (editingItem) await api.patch(`/metric-sources/${editingItem.id}/`, sourceForm);
      else await api.post("/metric-sources/", sourceForm);
    }
    if (activeSection === "types") {
      if (editingItem) await api.patch(`/metric-types/${editingItem.id}/`, typeForm);
      else await api.post("/metric-types/", typeForm);
    }
    if (activeSection === "statuses") {
      if (editingItem) await api.patch(`/statuses/${editingItem.id}/`, statusForm);
      else await api.post("/statuses/", statusForm);
    }
    setEditingItem(null);
    setModalOpen(false);
    resetForms();
    load();
  }

  async function deleteItem(row) {
    if (!confirm(`Удалить "${row.name}"?`)) return;
    if (activeSection === "channels") await api.delete(`/channels/${row.id}/`);
    if (activeSection === "sources") await api.delete(`/metric-sources/${row.id}/`);
    if (activeSection === "types") await api.delete(`/metric-types/${row.id}/`);
    if (activeSection === "statuses") await api.delete(`/statuses/${row.id}/`);
    load();
  }

  function isDraftTransitionEnabled(fromStatus, toStatus) {
    return transitionDraft.includes(`${fromStatus.id}:${toStatus.id}`);
  }

  function toggleTransition(fromStatus, toStatus) {
    if (fromStatus.id === toStatus.id) return;
    const key = `${fromStatus.id}:${toStatus.id}`;
    setTransitionDraft((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  }

  async function saveTransitions() {
    setMatrixSaving(true);
    // Временный учебный комментарий: матрица редактируется как черновик.
    // При сохранении считаем разницу: что удалить и что создать.
    const currentKeys = matrixTransitions.map((transition) => `${transition.from_status}:${transition.to_status}`);
    const draftSet = new Set(transitionDraft);
    const currentSet = new Set(currentKeys);

    const toDelete = matrixTransitions.filter((transition) => !draftSet.has(`${transition.from_status}:${transition.to_status}`));
    const toCreate = transitionDraft.filter((key) => !currentSet.has(key));

    try {
      await Promise.all([
        ...toDelete.map((transition) => api.delete(`/status-transitions/${transition.id}/`)),
        ...toCreate.map((key) => {
          const [from_status, to_status] = key.split(":");
          return api.post("/status-transitions/", { from_status, to_status });
        }),
      ]);
      load();
    } finally {
      setMatrixSaving(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <h1>Справочники</h1>
        {(activeSection !== "statuses" || statusTab === "list") && (
          <button className="primary-button" onClick={openCreate}>Добавить</button>
        )}
      </div>

      <div className="section-switcher">
        {sections.map((section) => (
          <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => setActiveSection(section.id)}>
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "statuses" && (
        <div className="subtabs">
          <button className={statusTab === "list" ? "active" : ""} onClick={() => setStatusTab("list")}>Список статусов</button>
          <button className={statusTab === "matrix" ? "active" : ""} onClick={() => setStatusTab("matrix")}>Переходы</button>
        </div>
      )}

      <section className="panel">
        <div className="inline-heading section-heading">
          <div>
            <span className="section-label">Справочник</span>
            <h2>{activeSection === "statuses" && statusTab === "matrix" ? "Переходы статусов" : current.title}</h2>
          </div>
          {!(activeSection === "statuses" && statusTab === "matrix") && <strong>{current.rows.length} шт.</strong>}
        </div>

        {activeSection === "statuses" && statusTab === "matrix" ? (
          <div className="transition-matrix-block">
            <div className="transition-matrix-toolbar">
              <label className="status-filter-select">
                <span>Сущность</span>
                <select value={transitionEntity} onChange={(event) => setTransitionEntity(event.target.value)}>
                  <option value="campaign">Кампания</option>
                  <option value="activity">Активность</option>
                </select>
              </label>
              <div className="table-actions">
                <button type="button" className="plain-button" onClick={() => setTransitionDraft(matrixTransitions.map((transition) => `${transition.from_status}:${transition.to_status}`))}>
                  Отменить
                </button>
                <button type="button" className="primary-button" disabled={matrixSaving} onClick={saveTransitions}>
                  {matrixSaving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </div>

            <div className="transition-matrix-wrap">
              <table className="transition-matrix">
                <thead>
                  <tr>
                    <th>Из / в</th>
                    {matrixStatuses.map((status) => <th key={status.id}>{status.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrixStatuses.map((fromStatus) => (
                    <tr key={fromStatus.id}>
                      <th>{fromStatus.name}</th>
                      {matrixStatuses.map((toStatus) => {
                        const active = isDraftTransitionEnabled(fromStatus, toStatus);
                        const same = fromStatus.id === toStatus.id;
                        return (
                          <td key={toStatus.id} className={same ? "blocked" : active ? "enabled" : ""}>
                            <button
                              type="button"
                              disabled={same}
                              title={same ? "Переход в тот же статус не нужен" : active ? "Отключить переход" : "Включить переход"}
                              onClick={() => toggleTransition(fromStatus, toStatus)}
                            >
                              {same ? "—" : active ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <DataTable rows={current.rows} columns={current.columns} />
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop">
          <form className="modal-window compact-modal" onSubmit={saveItem}>
            <div className="modal-header">
              <h2>{editingItem ? "Изменить" : "Добавить"}: {current.title}</h2>
              <button type="button" className="plain-button" onClick={() => { setModalOpen(false); setEditingItem(null); }}>Закрыть</button>
            </div>

            {activeSection === "channels" && (
              <div className="modal-grid">
                <label>Название<input required value={channelForm.name} onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })} /></label>
                <label>URL<input value={channelForm.url} onChange={(e) => setChannelForm({ ...channelForm, url: e.target.value })} /></label>
              </div>
            )}

            {activeSection === "sources" && (
              <div className="modal-grid">
                <label>Название<input required value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} /></label>
                <label>Тип<select value={sourceForm.type} onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}><option value="API">API</option><option value="MANUAL">Ручной ввод</option><option value="IMPORT">Импорт</option></select></label>
                <label className="checkbox-row"><input type="checkbox" checked={sourceForm.is_active} onChange={(e) => setSourceForm({ ...sourceForm, is_active: e.target.checked })} />Активен</label>
              </div>
            )}

            {activeSection === "types" && (
              <div className="modal-grid">
                <label>Название<input required value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} /></label>
                <label>Единица измерения<input required value={typeForm.unit} onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })} /></label>
              </div>
            )}

            {activeSection === "statuses" && (
              <div className="modal-grid">
                <label>Название<input required value={statusForm.name} onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })} /></label>
                <label>Сущность<select value={statusForm.entity_type} onChange={(e) => setStatusForm({ ...statusForm, entity_type: e.target.value })}><option value="campaign">Кампания</option><option value="activity">Активность</option></select></label>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="plain-button" onClick={() => { setModalOpen(false); setEditingItem(null); }}>Отмена</button>
              <button className="primary-button">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
