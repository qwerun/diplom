import { useEffect, useState } from "react";

import api from "../api/client";
import DataTable from "../components/DataTable";
import { asList } from "../utils/apiData";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [error, setError] = useState("");

  function load() {
    api.get("/reports/").then((res) => setReports(asList(res.data)));
    api.get("/campaigns/").then((res) => setCampaigns(asList(res.data)));
  }

  useEffect(load, []);

  function toggleCampaign(id) {
    const value = String(id);
    setSelectedCampaigns((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  }

  function selectAllCampaigns() {
    setSelectedCampaigns(campaigns.map((campaign) => String(campaign.id)));
  }

  function clearSelection() {
    setSelectedCampaigns([]);
  }

  async function generate() {
    if (selectedCampaigns.length === 0) {
      setError("Выберите хотя бы одну кампанию.");
      return;
    }
    setError("");
    try {
      await api.post("/reports/generate/", { campaigns: selectedCampaigns });
      setSelectedCampaigns([]);
      load();
    } catch (requestError) {
      setError(requestError.response?.data?.campaigns || "Не удалось сформировать отчет.");
    }
  }

  async function downloadReport(row) {
    const response = await api.get(`/reports/${row.id}/xlsx/`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report_${row.id}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="section-label">Отчётность</span>
          <h1>Отчеты</h1>
        </div>
        <button className="primary-button" onClick={generate}>Сформировать XLSX</button>
      </div>

      <section className="panel">
        <div className="section-heading">
          <span className="section-label">Состав отчета</span>
          <h2>Выберите одну или несколько кампаний</h2>
        </div>
        <details className="report-campaign-select">
          <summary>
            <span>{selectedCampaigns.length > 0 ? `Выбрано кампаний: ${selectedCampaigns.length}` : "Выберите кампании"}</span>
            <small>Доступно: {campaigns.length}</small>
          </summary>
          <div className="report-select-dropdown">
            <div className="report-selection-toolbar">
              <span>Выбрано: <strong>{selectedCampaigns.length}</strong> из {campaigns.length}</span>
              <div>
                <button type="button" className="plain-button small" onClick={selectAllCampaigns} disabled={campaigns.length === 0}>Выбрать все</button>
                <button type="button" className="plain-button small" onClick={clearSelection} disabled={selectedCampaigns.length === 0}>Снять выбор</button>
              </div>
            </div>
            <div className="report-campaign-selector">
              {campaigns.map((campaign) => {
                const selected = selectedCampaigns.includes(String(campaign.id));
                return (
                  <label className={`report-campaign-option${selected ? " selected" : ""}`} key={campaign.id}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCampaign(campaign.id)}
                    />
                    <span>
                      <b>{campaign.name}</b>
                      <small>{campaign.executor_name ? `Исполнитель: ${campaign.executor_name}` : "Исполнитель не назначен"}</small>
                    </span>
                  </label>
                );
              })}
              {campaigns.length === 0 && <div className="empty-state compact-empty">Доступных кампаний нет.</div>}
            </div>
          </div>
        </details>
        {error && <p className="form-error">{error}</p>}
      </section>

      <section className="panel">
        <DataTable rows={reports} columns={[
          { key: "campaign_names", title: "Кампании", render: (row) => row.campaign_names?.join(", ") || row.campaign_name || "—" },
          { key: "generated_by_name", title: "Сформировал" },
          { key: "create_date", title: "Дата" },
          { key: "file_path", title: "Файл", render: (row) => <button className="table-button" onClick={() => downloadReport(row)}>Скачать XLSX</button> },
        ]} />
      </section>
    </>
  );
}
