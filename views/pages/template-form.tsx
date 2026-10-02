"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, LoaderCircle, Save, Upload } from "lucide-react";
import AppShell from "../layouts/app-shell";

type TemplateStatus = "active" | "draft" | "archived";

type TemplateData = {
  id: number;
  name: string;
  emailSubject: string;
  emailFromName: string;
  emailFromEmail: string;
  emailReplyTo: string;
  status: TemplateStatus;
  templateBody: string;
};

type TemplateFormPageProps = {
  mode: "create" | "edit";
  templateId?: string;
};

const emptyTemplate: Omit<TemplateData, "id"> = {
  name: "",
  emailSubject: "",
  emailFromName: "",
  emailFromEmail: "",
  emailReplyTo: "",
  status: "active",
  templateBody: "",
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function TemplateFormPage({ mode, templateId }: TemplateFormPageProps) {
  const router = useRouter();
  const isEditMode = mode === "edit";
  const [formData, setFormData] = useState(emptyTemplate);
  const [htmlUploadStatus, setHtmlUploadStatus] = useState(
    "Upload index.html or any HTML file.",
  );
  const [previewStatus, setPreviewStatus] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditMode || !templateId) {
      return;
    }

    let isMounted = true;

    async function loadTemplate() {
      setIsLoading(true);
      setFormStatus("");

      try {
        const response = await fetch(`/api/templates/${templateId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Template could not be loaded.");
        }

        if (isMounted) {
          const template = result.template as TemplateData;
          setFormData({
            name: template.name,
            emailSubject: template.emailSubject,
            emailFromName: template.emailFromName,
            emailFromEmail: template.emailFromEmail,
            emailReplyTo: template.emailReplyTo || "",
            status: template.status,
            templateBody: template.templateBody,
          });
        }
      } catch (error) {
        if (isMounted) {
          setFormStatus(error instanceof Error ? error.message : "Template could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTemplate();

    return () => {
      isMounted = false;
    };
  }, [isEditMode, templateId]);

  const handleTemplateFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const isHtmlFile =
      file.type === "text/html" ||
      file.name.toLowerCase().endsWith(".html") ||
      file.name.toLowerCase().endsWith(".htm");

    if (!isHtmlFile) {
      setHtmlUploadStatus("Please upload an index.html or .html file.");
      return;
    }

    const fileContent = await file.text();
    updateField("templateBody", fileContent);
    setHtmlUploadStatus(`${file.name} loaded into the template body.`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormStatus("");

    try {
      const response = await fetch(
        isEditMode ? `/api/templates/${templateId}` : "/api/templates",
        {
          method: isEditMode ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Template could not be saved.");
      }

      router.push("/template");
      router.refresh();
    } catch (error) {
      setFormStatus(error instanceof Error ? error.message : "Template could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasTemplateBody = formData.templateBody.trim().length > 0;

  const handlePreviewTemplate = () => {
    if (!hasTemplateBody) {
      return;
    }

    const previewWindow = window.open(
      "",
      "template-preview",
      "width=1040,height=760,resizable=yes,scrollbars=yes",
    );

    if (!previewWindow) {
      setPreviewStatus("Please allow popups to view the template preview.");
      return;
    }

    const previewTitle = formData.emailSubject.trim() || "Untitled email preview";
    const previewFields = [
      ["Template", formData.name.trim() || "Untitled template"],
      ["Subject", previewTitle],
      ["From name", formData.emailFromName.trim() || "Not set"],
      ["From email", formData.emailFromEmail.trim() || "Not set"],
      ["Reply to", formData.emailReplyTo.trim() || "Not set"],
      ["Status", formData.status],
    ];

    previewWindow.document.open();
    previewWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(previewTitle)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #F8FAFC;
        color: #0F172A;
        font-family: Inter, Segoe UI, Arial, sans-serif;
      }
      .preview-shell {
        min-height: 100vh;
        padding: 24px;
      }
      .preview-card {
        max-width: 920px;
        margin: 0 auto;
        overflow: hidden;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        background: #FFFFFF;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      .preview-header {
        border-bottom: 1px solid #E2E8F0;
        background: #F8FAFC;
        padding: 20px;
      }
      .preview-header p {
        margin: 0 0 4px;
        color: #166534;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .preview-header h1 {
        margin: 0;
        color: #0F172A;
        font-size: 24px;
        line-height: 1.3;
      }
      .preview-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        border-bottom: 1px solid #E2E8F0;
        padding: 20px;
      }
      .preview-meta div {
        min-width: 0;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 12px;
      }
      .preview-meta span,
      .preview-meta strong {
        display: block;
      }
      .preview-meta span {
        color: #64748B;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .preview-meta strong {
        overflow-wrap: anywhere;
        color: #0F172A;
        font-size: 14px;
        font-weight: 600;
      }
      .email-frame {
        display: block;
        width: 100%;
        min-height: 620px;
        border: 0;
        background: #FFFFFF;
      }
      @media (max-width: 640px) {
        .preview-shell { padding: 16px; }
        .preview-meta { grid-template-columns: 1fr; }
        .email-frame { min-height: 520px; }
      }
    </style>
  </head>
  <body>
    <main class="preview-shell">
      <section class="preview-card">
        <header class="preview-header">
          <p>Email preview</p>
          <h1>${escapeHtml(previewTitle)}</h1>
        </header>
        <div class="preview-meta">
          ${previewFields
            .map(
              ([label, value]) => `<div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>`,
            )
            .join("")}
        </div>
        <iframe class="email-frame" id="email-preview-frame" sandbox="" title="Email body preview"></iframe>
      </section>
    </main>
  </body>
</html>`);
    previewWindow.document.close();

    const previewFrame = previewWindow.document.getElementById(
      "email-preview-frame",
    ) as HTMLIFrameElement | null;

    if (previewFrame) {
      previewFrame.srcdoc = formData.templateBody;
    }

    previewWindow.focus();
    setPreviewStatus("Preview opened in a popup window.");
  };

  return (
    <AppShell
      actionHref="/template/new"
      actionLabel="New template"
      activeItem="templates"
      description={
        isEditMode
          ? "Update template details and HTML body."
          : "Create a reusable template that can autofill campaign sender details."
      }
      eyebrow="Templates"
      searchPlaceholder="Search templates"
      title={isEditMode ? "Edit template" : "Create template"}
    >
      <section className="campaign-form-layout">
        <form className="dashboard-section campaign-form" onSubmit={handleSubmit}>
          <div className="section-heading campaign-form-heading">
            <div>
              <p className="eyebrow">{isEditMode ? "Edit template" : "New template"}</p>
              <h2>Template details</h2>
              <p>These fields match the campaign autofill data.</p>
            </div>

            <Link className="button-secondary" href="/template">
              <ArrowLeft aria-hidden="true" size={16} />
              Back
            </Link>
          </div>

          {isLoading ? (
            <div className="template-state-message">
              <LoaderCircle aria-hidden="true" className="loading-icon" size={18} />
              Loading template...
            </div>
          ) : (
            <>
              <div className="form-grid">
                <label className="form-field form-field-full" htmlFor="template-name">
                  <span>
                    Template name <b aria-hidden="true">*</b>
                  </span>
                  <input
                    id="template-name"
                    name="name"
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Product update"
                    required
                    type="text"
                    value={formData.name}
                  />
                </label>

                <label className="form-field form-field-full" htmlFor="template-subject">
                  <span>
                    Email subject <b aria-hidden="true">*</b>
                  </span>
                  <input
                    id="template-subject"
                    name="emailSubject"
                    onChange={(event) => updateField("emailSubject", event.target.value)}
                    placeholder="Product update from our team"
                    required
                    type="text"
                    value={formData.emailSubject}
                  />
                </label>

                <label className="form-field" htmlFor="template-from-name">
                  <span>
                    From name <b aria-hidden="true">*</b>
                  </span>
                  <input
                    id="template-from-name"
                    name="emailFromName"
                    onChange={(event) => updateField("emailFromName", event.target.value)}
                    placeholder="Product Team"
                    required
                    type="text"
                    value={formData.emailFromName}
                  />
                </label>

                <label className="form-field" htmlFor="template-from-email">
                  <span>
                    From email <b aria-hidden="true">*</b>
                  </span>
                  <input
                    id="template-from-email"
                    name="emailFromEmail"
                    onChange={(event) => updateField("emailFromEmail", event.target.value)}
                    placeholder="product@example.com"
                    required
                    type="email"
                    value={formData.emailFromEmail}
                  />
                </label>

                <label className="form-field" htmlFor="template-reply-to">
                  <span>Reply to</span>
                  <input
                    id="template-reply-to"
                    name="emailReplyTo"
                    onChange={(event) => updateField("emailReplyTo", event.target.value)}
                    placeholder="support@example.com"
                    type="email"
                    value={formData.emailReplyTo}
                  />
                </label>

                <label className="form-field" htmlFor="template-status">
                  <span>
                    Status <b aria-hidden="true">*</b>
                  </span>
                  <select
                    id="template-status"
                    name="status"
                    onChange={(event) =>
                      updateField("status", event.target.value as TemplateStatus)
                    }
                    required
                    value={formData.status}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                <div className="form-field form-field-full">
                  <span>
                    Template body <b aria-hidden="true">*</b>
                  </span>
                  <label className="json-upload-box html-upload-box" htmlFor="template-html-file">
                    <Upload aria-hidden="true" size={20} />
                    <span>
                      <strong>Add index.html file</strong>
                      <small>{htmlUploadStatus}</small>
                    </span>
                    <input
                      accept=".html,.htm,text/html"
                      id="template-html-file"
                      name="templateHtmlFile"
                      onChange={handleTemplateFileUpload}
                      type="file"
                    />
                  </label>
                  <textarea
                    id="template-body"
                    name="templateBody"
                    onChange={(event) => updateField("templateBody", event.target.value)}
                    placeholder={
                      "Hi {{name}},\n\nHere is the latest update for you.\n\nThanks,\nThe team"
                    }
                    required
                    rows={10}
                    value={formData.templateBody}
                  />
                  <small>Use variables like {"{{name}}"} or {"{{email}}"} for dynamic content later.</small>
                  <div className="template-body-actions">
                    <button
                      className="button-secondary"
                      disabled={!hasTemplateBody}
                      onClick={handlePreviewTemplate}
                      type="button"
                    >
                      <Eye aria-hidden="true" size={16} />
                      View template
                    </button>
                  </div>
                  {previewStatus ? <small>{previewStatus}</small> : null}
                </div>
              </div>

              {formStatus ? <p className="form-status-error">{formStatus}</p> : null}

              <div className="form-actions">
                <Link className="button-secondary" href="/template">
                  Cancel
                </Link>
                <button className="button-primary" disabled={isSaving} type="submit">
                  {isSaving ? (
                    <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                  ) : (
                    <Save aria-hidden="true" size={16} />
                  )}
                  {isSaving
                    ? "Saving..."
                    : isEditMode
                      ? "Update template"
                      : "Submit template"}
                </button>
              </div>
            </>
          )}
        </form>
      </section>
    </AppShell>
  );

  function updateField<K extends keyof typeof emptyTemplate>(
    key: K,
    value: (typeof emptyTemplate)[K],
  ) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  }
}
