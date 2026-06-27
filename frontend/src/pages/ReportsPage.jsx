import { useEffect, useState } from "react";

import api from "../api/client";
import DataTable from "../components/DataTable";
import { asList } from "../utils/apiData";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState("");

  function load() {
    api.get("/reports/").then((res) => setReports(asList(res.data)));
    api.get("/campaigns/").then((res) => setCampaigns(asList(res.data)));
  }

  useEffect(load, []);

  async function generate() {
    if (!campaign) return;
    await api.post("/reports/generate/", { campaign });
    load();
  }

  async function downloadReport(row) {
    const response = await api.get(row.file_path.replace("/api", ""), { responseType: "blob" });
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
        <h1>Отчеты</h1>
        <div className="filters">
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            <option value="">Выберите кампанию</option>
            {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button onClick={generate}>Сформировать XLSX</button>
        </div>
      </div>
      <DataTable rows={reports} columns={[
        { key: "campaign_name", title: "Кампания" },
        { key: "create_date", title: "Дата" },
        { key: "file_path", title: "Файл", render: (row) => <button className="table-button" onClick={() => downloadReport(row)}>Скачать XLSX</button> },
      ]} />
    </>
  );
}
