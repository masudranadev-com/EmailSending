"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Clock, FileText, MailCheck, Send, Users } from "lucide-react";
import AppShell from "../layouts/app-shell";

type DashboardCampaign = {
  id: number;
  name: string;
  recipientCount: number;
  scheduleDate: string | null;
  sentAt: string | null;
  status: "running" | "scheduled" | "sent" | "failed" | "cancelled";
  templateName: string;
  createdAt: string;
  updatedAt: string;
};

type DashboardData = {
  listHealth: {
    totalCustomers: number;
    withBusinessInfo: number;
    withStoreLink: number;
  };
  recentCampaigns: DashboardCampaign[];
  stats: {
    activeTemplates: number;
    emailsSent: number;
    failedCampaigns: number;
    runningCampaigns: number;
    scheduledCampaigns: number;
    totalCampaigns: number;
    totalCustomers: number;
    totalTemplates: number;
  };
  upcomingSends: DashboardCampaign[];
};

const defaultDashboard: DashboardData = {
  listHealth: {
    totalCustomers: 0,
    withBusinessInfo: 0,
    withStoreLink: 0,
  },
  recentCampaigns: [],
  stats: {
    activeTemplates: 0,
    emailsSent: 0,
    failedCampaigns: 0,
    runningCampaigns: 0,
    scheduledCampaigns: 0,
    totalCampaigns: 0,
    totalCustomers: 0,
    totalTemplates: 0,
  },
  upcomingSends: [],
};

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData>(defaultDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = (await response.json()) as DashboardData & { message?: string };

        if (!response.ok) {
          throw new Error(data.message || "Dashboard data could not be loaded.");
        }

        setDashboard(data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Dashboard data could not be loaded.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDashboard();
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "Emails sent",
        value: formatNumber(dashboard.stats.emailsSent),
        change: `${formatNumber(dashboard.stats.failedCampaigns)} failed campaigns`,
        icon: Send,
      },
      {
        label: "Campaigns",
        value: formatNumber(dashboard.stats.totalCampaigns),
        change: `${formatNumber(dashboard.stats.runningCampaigns)} running`,
        icon: MailCheck,
      },
      {
        label: "Customers",
        value: formatNumber(dashboard.stats.totalCustomers),
        change: `${formatNumber(dashboard.listHealth.withBusinessInfo)} with details`,
        icon: Users,
      },
      {
        label: "Scheduled",
        value: formatNumber(dashboard.stats.scheduledCampaigns),
        change: `${formatNumber(dashboard.stats.activeTemplates)} active templates`,
        icon: Clock,
      },
    ],
    [dashboard],
  );
  const businessInfoPercent = getPercent(
    dashboard.listHealth.withBusinessInfo,
    dashboard.listHealth.totalCustomers,
  );
  const storeLinkPercent = getPercent(
    dashboard.listHealth.withStoreLink,
    dashboard.listHealth.totalCustomers,
  );

  return (
    <AppShell
      activeItem="dashboard"
      description="Track campaigns, audience growth, and sending performance."
      eyebrow="Overview"
      title="Dashboard"
    >
      <section className="dashboard-grid stats-grid" aria-label="Dashboard stats">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="metric-card" key={stat.label}>
              <div className="metric-icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <div>
                <p>{stat.label}</p>
                <h2>{isLoading ? "..." : stat.value}</h2>
              </div>
              <span>{isLoading ? "Loading" : stat.change}</span>
            </article>
          );
        })}
      </section>

      <section className="dashboard-layout">
        <div className="dashboard-primary">
          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Campaigns</p>
                <h2>Recent activity</h2>
              </div>
              <a className="button-secondary" href="/campaign">
                View all
                <ArrowUpRight aria-hidden="true" size={16} />
              </a>
            </div>

            {error ? <div className="form-status-error">{error}</div> : null}

            <div className="campaign-table" role="table" aria-label="Recent campaigns">
              <div className="campaign-row campaign-row-head" role="row">
                <span role="columnheader">Campaign</span>
                <span role="columnheader">Template</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Recipients</span>
                <span role="columnheader">Date</span>
              </div>

              {isLoading ? (
                <div className="template-state-message">Loading recent campaigns...</div>
              ) : dashboard.recentCampaigns.length === 0 ? (
                <div className="template-empty-state">
                  <strong>No campaigns yet</strong>
                  <span>Create a campaign to see activity here.</span>
                </div>
              ) : (
                dashboard.recentCampaigns.map((campaign) => (
                  <div className="campaign-row" role="row" key={campaign.id}>
                    <span data-label="Campaign" role="cell">
                      <strong>{campaign.name}</strong>
                    </span>
                    <span data-label="Template" role="cell">
                      {campaign.templateName}
                    </span>
                    <span data-label="Status" role="cell">
                      <span className={`status-badge ${getStatusClass(campaign.status)}`}>
                        {formatStatus(campaign.status)}
                      </span>
                    </span>
                    <span data-label="Recipients" role="cell">
                      {formatNumber(campaign.recipientCount)}
                    </span>
                    <span data-label="Date" role="cell">
                      {formatCampaignDate(campaign)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="dashboard-secondary" aria-label="Dashboard side panels">
          <section className="dashboard-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Audience</p>
                <h2>List health</h2>
              </div>
            </div>
            <div className="progress-list">
              <div>
                <span>
                  <strong>Business information</strong>
                  <small>
                    {formatNumber(dashboard.listHealth.withBusinessInfo)} of{" "}
                    {formatNumber(dashboard.listHealth.totalCustomers)}
                  </small>
                </span>
                <div className="progress-track">
                  <div style={{ width: `${businessInfoPercent}%` }} />
                </div>
              </div>
              <div>
                <span>
                  <strong>Store links</strong>
                  <small>{formatNumber(dashboard.listHealth.withStoreLink)} contacts</small>
                </span>
                <div className="progress-track">
                  <div style={{ width: `${storeLinkPercent}%` }} />
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Queue</p>
                <h2>Upcoming sends</h2>
              </div>
            </div>
            {isLoading ? (
              <div className="template-state-message">Loading queue...</div>
            ) : dashboard.upcomingSends.length === 0 ? (
              <div className="template-empty-state">
                <FileText aria-hidden="true" size={20} />
                <strong>No scheduled sends</strong>
                <span>Scheduled campaigns will appear here.</span>
              </div>
            ) : (
              <ul className="schedule-list">
                {dashboard.upcomingSends.map((campaign) => (
                  <li key={campaign.id}>
                    <Clock aria-hidden="true" size={18} />
                    <span>
                      <strong>{campaign.name}</strong>
                      <small>
                        {formatDate(campaign.scheduleDate)} - {formatNumber(campaign.recipientCount)} recipients
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getPercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / total) * 100));
}

function formatCampaignDate(campaign: DashboardCampaign) {
  return formatDate(campaign.sentAt || campaign.scheduleDate || campaign.updatedAt || campaign.createdAt);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: DashboardCampaign["status"]) {
  if (status === "sent") {
    return "Complete";
  }

  if (status === "cancelled") {
    return "Stopped";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClass(status: DashboardCampaign["status"]) {
  if (status === "sent") {
    return "status-badge-success";
  }

  if (status === "running") {
    return "status-badge-info";
  }

  if (status === "scheduled") {
    return "status-badge-warning";
  }

  return "status-badge-error";
}
