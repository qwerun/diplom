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
        <div className="report-campaign-selector">
          {campaigns.map((campaign) => (
            <label className="report-campaign-option" key={campaign.id}>
              <input
                type="checkbox"
                checked={selectedCampaigns.includes(String(campaign.id))}
                onChange={() => toggleCampaign(campaign.id)}
              />
              <span>
                <b>{campaign.name}</b>
                <small>{campaign.executor_name ? `Исполнитель: ${campaign.executor_name}` : "Исполнитель не назначен"}</small>
              </span>
            </label>
          ))}
          {campaigns.length === 0 && <div className="empty-state compact-empty">Доступных кампаний нет.</div>}
        </div>
        {error && <p className="form-error">{error}</p>}
      </section>

      <section className="panel">
        <DataTable rows={reports} columns={[
          { key: "campaign_name", title: "Кампании" },
          { key: "generated_by_name", title: "Сформировал" },
          { key: "create_date", title: "Дата" },
          { key: "file_path", title: "Файл", render: (row) => <button className="table-button" onClick={() => downloadReport(row)}>Скачать XLSX</button> },
        ]} />
      </section>
    </>
  );
}
