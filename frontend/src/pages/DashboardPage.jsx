import { useEffect, useState } from "react";

import api from "../api/client";
import { asList } from "../utils/apiData";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    api.get("/analytics/dashboard/").then((res) => setData(res.data));
    api.get("/campaigns/?ordering=-start_date").then((res) => setCampaigns(asList(res.data)));
  }, []);

  if (!data) return <p>Загрузка...</p>;

  const inactiveCampaigns = Math.max(data.campaigns - data.active_campaigns, 0);
  const activePercent = data.campaigns ? Math.round((data.active_campaigns / data.campaigns) * 100) : 0;
  const inactivePercent = data.campaigns ? 100 - activePercent : 0;

  return (
    <>
      <div className="page-title">
        <h1>Главная панель</h1>
      </div>
      <div className="grid-two">
        <section className="panel campaign-summary-panel">
          <div className="inline-heading">
            <h2>Статистика кампаний</h2>
            <span className="muted-text">Всего: {data.campaigns}</span>
          </div>
          <div className="campaign-status-summary">
            <div>
              <span>Активные</span>
              <strong>{data.active_campaigns}</strong>
              <em>{activePercent}%</em>
            </div>
            <div>
              <span>Неактивные</span>
              <strong>{inactiveCampaigns}</strong>
              <em>{inactivePercent}%</em>
            </div>
          </div>
          <div className="campaign-ratio" aria-label={`Активные ${activePercent}%, неактивные ${inactivePercent}%`}>
            <span style={{ width: `${activePercent}%` }} />
          </div>
          <div className="status-breakdown">
            {data.campaign_statuses.map((status) => (
              <div key={status.name}>
                <span>{status.name}</span>
                <b>{status.count}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Последние кампании</h2>
          <div className="simple-list">
            {campaigns.slice(0, 5).map((campaign) => (
              <a key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <strong>{campaign.name}</strong>
                <span>{campaign.status_name} · {campaign.budget} руб.</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
