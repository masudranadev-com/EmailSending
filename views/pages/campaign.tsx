"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CircleAlert,
  CalendarClock,
  LoaderCircle,
  MailCheck,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import AppShell from "../layouts/app-shell";

type CampaignStatus = "pending" | "running" | "scheduled" | "sent" | "failed" | "cancelled";

type CampaignItem = {
  id: number;
  dailyLimitReached: boolean;
  dailySendingLimit: number;
  failureReason: string;
  failedCount: number;
  name: string;
  nextBatchAt: string | null;
  pendingCount: number;
  recipientCount: number;
  sendDate: string | null;
  sendError: string | null;
  sendingCount: number;
  sentCount: number;
  status: CampaignStatus;
  subject: string;
  templateName: string;
  createdAt: string;
  updatedAt: string;
};

type CampaignStats = {
  audienceContacts: number;
  cancelled: number;
  running: number;
  scheduled: number;
  total: number;
};

const defaultStats: CampaignStats = {
  audienceContacts: 0,
  cancelled: 0,
  running: 0,
  scheduled: 0,
  total: 0,
};

const filters: Array<{ label: string; value: "all" | CampaignStatus }> = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Complete", value: "sent" },
  { label: "Failed", value: "failed" },
  { label: "Stopped", value: "cancelled" },
];

export default function CampaignPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [stats, setStats] = useState<CampaignStats>(defaultStats);
  const [activeFilter, setActiveFilter] = useState<"all" | CampaignStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingCampaign, setEditingCampaign] = useState<CampaignItem | null>(null);
  const [failedCampaign, setFailedCampaign] = useState<CampaignItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionCampaignId, setActionCampaignId] = useState<number | null>(null);

  const campaignStats = useMemo(
    () => [
      {
        label: "Total campaigns",
        value: String(stats.total),
        helper: "Stored campaigns",
        icon: Send,
      },
      {
        label: "Total recipients",
        value: String(stats.audienceContacts),
        helper: "Across all campaigns",
        icon: Users,
      },
      {
        label: "Running",
        value: String(stats.running),
        helper: "Sending now",
        icon: MailCheck,
      },
      {
        label: "Scheduled",
        value: String(stats.scheduled),
        helper: "Queued for later",
        icon: CalendarClock,
      },
    ],
    [stats],
  );
  const filteredCampaigns = useMemo(
    () =>
      activeFilter === "all"
        ? campaigns
        : campaigns.filter((campaign) => campaign.status === activeFilter),
    [activeFilter, campaigns],
  );

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    const shouldRefresh = campaigns.some(
      (campaign) => campaign.status === "running" || campaign.status === "scheduled",
    );

    if (!shouldRefresh) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCampaigns({ silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [campaigns]);

  async function loadCampaigns(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setIsLoading(true);
    }

    setErrorMessage("");

    try {
      const response = await fetch("/api/campaigns", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Campaigns could not be loaded.");
      }

      setCampaigns(result.campaigns || []);
      setStats(result.stats || defaultStats);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Campaigns could not be loaded.",
      );
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  function openEditModal(campaign: CampaignItem) {
    setEditingCampaign(campaign);
    setEditName(campaign.name);
    setEditStatus("");
  }

  function closeEditModal() {
    setEditingCampaign(null);
    setEditName("");
    setEditStatus("");
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCampaign) {
      return;
    }

    setIsSavingEdit(true);
    setEditStatus("");

    try {
      const response = await fetch(`/api/campaigns/${editingCampaign.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: editName }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Campaign name could not be updated.");
      }

      await loadCampaigns();
      closeEditModal();
    } catch (error) {
      setEditStatus(
        error instanceof Error ? error.message : "Campaign name could not be updated.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteCampaign(campaign: CampaignItem) {
    const shouldDelete = window.confirm(`Delete "${campaign.name}" campaign?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingId(campaign.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Campaign could not be deleted.");
      }

      await loadCampaigns();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Campaign could not be deleted.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRunCampaign(campaign: CampaignItem) {
    setActionCampaignId(campaign.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/run`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Campaign could not be run.");
      }

      await loadCampaigns();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Campaign could not be run.");
    } finally {
      setActionCampaignId(null);
    }
  }

  async function handleStopCampaign(campaign: CampaignItem) {
    setActionCampaignId(campaign.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/stop`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Campaign could not be stopped.");
      }

      await loadCampaigns();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Campaign could not be stopped.",
      );
    } finally {
      setActionCampaignId(null);
    }
  }

  return (
    <AppShell
      activeItem="campaign"
      description="Create campaigns, manage recipient lists, and prepare scheduled sends."
      eyebrow="Campaigns"
      title="Campaign"
    >
      <section className="campaign-kpi-grid" aria-label="Campaign summary">
        {campaignStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="metric-card campaign-summary-card" key={stat.label}>
              <div className="metric-icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <div>
                <p>{stat.label}</p>
                <h2>{stat.value}</h2>
              </div>
              <span>{stat.helper}</span>
            </article>
          );
        })}
      </section>

      <section className="dashboard-section campaign-management">
        <div className="section-heading campaign-heading">
          <div>
            <p className="eyebrow">Campaign list</p>
            <h2>All campaigns</h2>
            <p>Campaign data is loaded from the MySQL campaign table.</p>
          </div>

          <div className="campaign-actions">
            <Link className="button-primary" href="/campaign/new">
              <Plus aria-hidden="true" size={16} />
              New campaign
            </Link>
          </div>
        </div>

        <div className="campaign-filters" aria-label="Campaign quick filters">
          {filters.map((filter) => (
            <button
              className={`filter-chip ${activeFilter === filter.value ? "is-active" : ""}`}
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {errorMessage ? <p className="form-status-error">{errorMessage}</p> : null}

        <div className="campaign-table-card">
          <table className="campaign-data-table">
            <caption>Campaign performance and scheduling table</caption>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Status</th>
                <th scope="col">Recipients</th>
                <th scope="col">Template</th>
                <th scope="col">Subject</th>
                <th scope="col">Send date</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="template-state-message">
                      <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                      Loading campaigns...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="template-empty-state">
                      <strong>No campaigns found</strong>
                      <span>Create a campaign or choose a different status filter.</span>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? filteredCampaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td data-label="Campaign">
                    <strong>{campaign.name}</strong>
                  </td>
                  <td data-label="Status">
                    {campaign.status === "failed" ? (
                      <button
                        className={`status-badge status-badge-button ${getStatusClass(
                          campaign.status,
                        )}`}
                        onClick={() => setFailedCampaign(campaign)}
                        type="button"
                      >
                        {formatStatus(campaign.status)}
                      </button>
                    ) : (
                      <span className={`status-badge ${getStatusClass(campaign.status)}`}>
                        {formatStatus(campaign.status)}
                      </span>
                    )}
                  </td>
                  <td data-label="Recipients">
                    <div className="campaign-progress-cell">
                      <div className="campaign-progress-summary">
                        <strong>
                          {campaign.sentCount} / {campaign.recipientCount}
                        </strong>
                        <span>{formatRecipientProgress(campaign)}</span>
                      </div>
                      <div
                        aria-label={`${campaign.sentCount} of ${campaign.recipientCount} recipients sent`}
                        aria-valuemax={campaign.recipientCount}
                        aria-valuemin={0}
                        aria-valuenow={campaign.sentCount}
                        className="campaign-progress-bar"
                        role="progressbar"
                      >
                        <span
                          style={{
                            width: `${readProgressPercent(campaign)}%`,
                          }}
                        />
                      </div>
                      {campaign.nextBatchAt && campaign.pendingCount > 0 ? (
                        <div className="campaign-reset-row">
                          <span>
                            Reset: {formatExactDate(campaign.nextBatchAt)}
                          </span>
                          <button
                            className="button-secondary campaign-urgent-button"
                            disabled={actionCampaignId === campaign.id}
                            onClick={() => handleRunCampaign(campaign)}
                            type="button"
                          >
                            {actionCampaignId === campaign.id ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="loading-icon"
                                size={16}
                              />
                            ) : (
                              <RotateCcw aria-hidden="true" size={16} />
                            )}
                            Start urgent
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Template">{campaign.templateName}</td>
                  <td data-label="Subject">{campaign.subject}</td>
                  <td data-label="Send date">{formatDate(campaign.sendDate)}</td>
                  <td data-label="Created">{formatDate(campaign.createdAt)}</td>
                  <td data-label="Actions">
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${campaign.name}`}
                        onClick={() => openEditModal(campaign)}
                      >
                        <Pencil aria-hidden="true" size={16} />
                      </button>
                      <Link
                        aria-label={`View emails for ${campaign.name}`}
                        className="button-secondary table-text-action"
                        href={`/campaigns/${campaign.id}/emails`}
                        title="View emails"
                      >
                        <MailCheck aria-hidden="true" size={16} />
                        View Emails
                      </Link>
                      <button
                        className="icon-button icon-button-danger"
                        type="button"
                        aria-label={`Delete ${campaign.name}`}
                        disabled={deletingId === campaign.id}
                        onClick={() => handleDeleteCampaign(campaign)}
                      >
                        {deletingId === campaign.id ? (
                          <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                        ) : (
                          <Trash2 aria-hidden="true" size={16} />
                        )}
                      </button>
                      {campaign.status === "running" ? (
                        <button
                          aria-label={`Stop ${campaign.name}`}
                          className="icon-button icon-button-danger"
                          disabled={actionCampaignId === campaign.id}
                          onClick={() => handleStopCampaign(campaign)}
                          title="Stop campaign"
                          type="button"
                        >
                          {actionCampaignId === campaign.id ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="loading-icon"
                              size={16}
                            />
                          ) : (
                            <Square aria-hidden="true" size={16} />
                          )}
                        </button>
                      ) : null}
                      {canRunCampaign(campaign.status) ? (
                        <button
                          aria-label={`Run ${campaign.name}`}
                          className="icon-button icon-button-success"
                          disabled={actionCampaignId === campaign.id}
                          onClick={() => handleRunCampaign(campaign)}
                          title="Run campaign"
                          type="button"
                        >
                          {actionCampaignId === campaign.id ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="loading-icon"
                              size={16}
                            />
                          ) : (
                            <Play aria-hidden="true" size={16} />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {editingCampaign ? (
        <div className="json-modal-backdrop" role="presentation">
          <form
            aria-labelledby="campaign-edit-title"
            aria-modal="true"
            className="json-modal campaign-edit-modal"
            onSubmit={handleEditSubmit}
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Edit campaign</p>
                <h2 id="campaign-edit-title">Campaign name</h2>
              </div>
              <button
                aria-label="Close campaign edit"
                className="icon-button"
                onClick={closeEditModal}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <div className="campaign-edit-body">
              <label className="form-field" htmlFor="campaign-edit-name">
                <span>
                  Campaign name <b aria-hidden="true">*</b>
                </span>
                <input
                  id="campaign-edit-name"
                  name="name"
                  onChange={(event) => setEditName(event.target.value)}
                  required
                  type="text"
                  value={editName}
                />
                <small>Only the campaign name can be edited after creation.</small>
              </label>
              {editStatus ? <p className="form-status-error">{editStatus}</p> : null}
            </div>

            <div className="json-modal-actions">
              <button className="button-secondary" onClick={closeEditModal} type="button">
                Cancel
              </button>
              <button className="button-primary" disabled={isSavingEdit} type="submit">
                {isSavingEdit ? (
                  <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                ) : (
                  <Pencil aria-hidden="true" size={16} />
                )}
                {isSavingEdit ? "Saving..." : "Save name"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {failedCampaign ? (
        <div className="json-modal-backdrop" role="presentation">
          <section
            aria-labelledby="campaign-failure-title"
            aria-modal="true"
            className="json-modal campaign-failure-modal"
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Failure reason</p>
                <h2 id="campaign-failure-title">{failedCampaign.name}</h2>
              </div>
              <button
                aria-label="Close failure reason"
                className="icon-button"
                onClick={() => setFailedCampaign(null)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <div className="campaign-failure-body">
              <div className="campaign-failure-summary">
                <CircleAlert aria-hidden="true" size={20} />
                <span>
                  <strong>{failedCampaign.sendError || "Campaign failed"}</strong>
                  <small>{formatDate(failedCampaign.updatedAt)}</small>
                </span>
              </div>
              <pre>{failedCampaign.failureReason || "No failure reason was recorded."}</pre>
            </div>

            <div className="json-modal-actions">
              <button
                className="button-primary"
                onClick={() => setFailedCampaign(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function getStatusClass(status: string) {
  if (status === "sent" || status === "running") {
    return "status-badge-success";
  }

  if (status === "scheduled" || status === "pending") {
    return "status-badge-warning";
  }

  if (status === "cancelled") {
    return "status-badge-info";
  }

  return "status-badge-error";
}

function formatStatus(status: string) {
  if (status === "sent") {
    return "Complete";
  }

  if (status === "cancelled") {
    return "Stopped";
  }

  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function canRunCampaign(status: CampaignStatus) {
  return status === "sent" || status === "cancelled" || status === "failed";
}

function readProgressPercent(campaign: CampaignItem) {
  if (campaign.recipientCount < 1) {
    return 0;
  }

  return Math.round((campaign.sentCount / campaign.recipientCount) * 100);
}

function formatRecipientProgress(campaign: CampaignItem) {
  const details = [
    `${campaign.pendingCount} pending`,
    campaign.failedCount > 0 ? `${campaign.failedCount} failed` : "",
    campaign.sendingCount > 0 ? `${campaign.sendingCount} sending now` : "",
  ].filter(Boolean);
  const limit =
    campaign.dailySendingLimit > 0
      ? `Limit ${campaign.dailySendingLimit}/day`
      : "No daily limit";

  return [limit, ...details].join(" | ");
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
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatExactDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
