"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  FileText,
  LoaderCircle,
  MailCheck,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import AppShell from "../layouts/app-shell";

type TemplateStatus = "active" | "draft" | "archived";

type TemplateItem = {
  id: number;
  name: string;
  emailSubject: string;
  emailFromName: string;
  emailFromEmail: string;
  emailReplyTo: string;
  status: TemplateStatus;
  templateBody: string;
  updatedAt: string;
};

export default function TemplatePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const templateStats = useMemo(
    () => [
      {
        label: "Total templates",
        value: String(templates.length),
        helper: "Saved in database",
        icon: FileText,
      },
      {
        label: "Active templates",
        value: String(templates.filter((template) => template.status === "active").length),
        helper: "Available in campaigns",
        icon: MailCheck,
      },
      {
        label: "Draft templates",
        value: String(templates.filter((template) => template.status === "draft").length),
        helper: "Need review",
        icon: Pencil,
      },
      {
        label: "Archived",
        value: String(templates.filter((template) => template.status === "archived").length),
        helper: "Hidden from normal use",
        icon: Copy,
      },
    ],
    [templates],
  );

  async function loadTemplates() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/templates", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Templates could not be loaded.");
      }

      setTemplates(result.templates || []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Templates could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTemplate(template: TemplateItem) {
    const shouldDelete = window.confirm(`Delete "${template.name}" template?`);

    if (!shouldDelete) {
      return;
    }

    setIsDeletingId(template.id);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Template could not be deleted.");
      }

      setTemplates((current) => current.filter((item) => item.id !== template.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Template could not be deleted.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <AppShell
      actionHref="/template/new"
      actionLabel="New template"
      activeItem="templates"
      description="Create and manage reusable email template defaults."
      eyebrow="Templates"
      searchPlaceholder="Search templates"
      title="Templates"
    >
      <section className="campaign-kpi-grid" aria-label="Template summary">
        {templateStats.map((stat) => {
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
            <p className="eyebrow">Template list</p>
            <h2>All templates</h2>
            <p>Template data is loaded from the MySQL templates table.</p>
          </div>

          <Link className="button-primary" href="/template/new">
            <Plus aria-hidden="true" size={16} />
            New template
          </Link>
        </div>

        {errorMessage ? <p className="form-status-error">{errorMessage}</p> : null}

        <div className="campaign-table-card">
          <table className="campaign-data-table template-data-table">
            <caption>Email template table</caption>
            <thead>
              <tr>
                <th scope="col">Template</th>
                <th scope="col">Subject</th>
                <th scope="col">From name</th>
                <th scope="col">From email</th>
                <th scope="col">Reply to</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="template-state-message">
                      <LoaderCircle aria-hidden="true" className="loading-icon" size={18} />
                      Loading templates...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && templates.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="template-empty-state">
                      <strong>No templates found</strong>
                      <span>Create your first template to show data here.</span>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? templates.map((template) => (
                    <tr key={template.id}>
                      <td data-label="Template">
                        <strong>{template.name}</strong>
                      </td>
                      <td data-label="Subject">{template.emailSubject}</td>
                      <td data-label="From name">{template.emailFromName}</td>
                      <td data-label="From email">{template.emailFromEmail}</td>
                      <td data-label="Reply to">{template.emailReplyTo || "Not set"}</td>
                      <td data-label="Status">
                        <span className={`status-badge ${getStatusClass(template.status)}`}>
                          {formatStatus(template.status)}
                        </span>
                      </td>
                      <td data-label="Updated">{formatDate(template.updatedAt)}</td>
                      <td data-label="Actions">
                        <div className="table-actions">
                          <Link
                            aria-label={`Edit ${template.name}`}
                            className="icon-button"
                            href={`/template/${template.id}/edit`}
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </Link>
                          <button
                            aria-label={`Delete ${template.name}`}
                            className="icon-button icon-button-danger"
                            disabled={isDeletingId === template.id}
                            onClick={() => handleDeleteTemplate(template)}
                            type="button"
                          >
                            {isDeletingId === template.id ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="loading-icon"
                                size={16}
                              />
                            ) : (
                              <Trash2 aria-hidden="true" size={16} />
                            )}
                          </button>
                          <button
                            aria-label={`View ${template.name}`}
                            className="icon-button"
                            onClick={() => setSelectedTemplate(template)}
                            type="button"
                          >
                            <Eye aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTemplate ? (
        <div className="json-modal-backdrop" role="presentation">
          <section
            aria-labelledby="template-view-title"
            aria-modal="true"
            className="json-modal template-view-modal"
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Template view</p>
                <h2 id="template-view-title">{selectedTemplate.name}</h2>
              </div>
              <button
                aria-label="Close template view"
                className="icon-button"
                onClick={() => setSelectedTemplate(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="template-view-meta">
              <span>
                <strong>Subject</strong>
                {selectedTemplate.emailSubject}
              </span>
              <span>
                <strong>From</strong>
                {selectedTemplate.emailFromName} ({selectedTemplate.emailFromEmail})
              </span>
              <span>
                <strong>Reply to</strong>
                {selectedTemplate.emailReplyTo || "Not set"}
              </span>
              <span>
                <strong>Status</strong>
                {formatStatus(selectedTemplate.status)}
              </span>
            </div>

            <iframe
              className="template-view-frame"
              sandbox=""
              srcDoc={selectedTemplate.templateBody}
              title={`${selectedTemplate.name} preview`}
            />

            <div className="json-modal-actions">
              <Link
                className="button-secondary"
                href={`/template/${selectedTemplate.id}/edit`}
              >
                <Pencil aria-hidden="true" size={16} />
                Edit
              </Link>
              <button
                className="button-primary"
                onClick={() => setSelectedTemplate(null)}
                type="button"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function getStatusClass(status: TemplateStatus) {
  if (status === "active") {
    return "status-badge-success";
  }

  if (status === "archived") {
    return "status-badge-error";
  }

  return "status-badge-warning";
}

function formatStatus(status: TemplateStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string) {
  if (!value) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
