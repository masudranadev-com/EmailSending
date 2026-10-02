"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Send, Upload } from "lucide-react";
import AppShell from "../layouts/app-shell";

type TemplateOption = {
  id: number;
  name: string;
  emailSubject: string;
  emailFromName: string;
  emailFromEmail: string;
  emailReplyTo: string;
  status: "active" | "draft" | "archived";
};

export default function CampaignNewPage() {
  const router = useRouter();
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  const [campaignName, setCampaignName] = useState("");
  const [contactsJson, setContactsJson] = useState("");
  const [jsonUploadStatus, setJsonUploadStatus] = useState(
    "Upload a .json file or paste contacts manually.",
  );
  const [emailSubject, setEmailSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateLoadStatus, setTemplateLoadStatus] = useState("");
  const [isCheckingContacts, setIsCheckingContacts] = useState(false);
  const [contactsCheckStatus, setContactsCheckStatus] = useState("");
  const [isUnique, setIsUnique] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    setCampaignName(`${formatter.format(new Date())} (Target)`);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      setIsLoadingTemplates(true);
      setTemplateLoadStatus("");

      try {
        const response = await fetch("/api/templates", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Templates could not be loaded.");
        }

        if (isMounted) {
          setTemplates(result.templates || []);
        }
      } catch (error) {
        if (isMounted) {
          setTemplateLoadStatus(
            error instanceof Error ? error.message : "Templates could not be loaded.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplates(false);
        }
      }
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleTemplateChange(event: ChangeEvent<HTMLSelectElement>) {
    const templateId = event.target.value;
    const template = templates.find((item) => String(item.id) === templateId);

    setSelectedTemplate(templateId);

    if (!template) {
      return;
    }

    setEmailSubject(template.emailSubject);
    setFromName(template.emailFromName);
    setFromEmail(template.emailFromEmail);
    setReplyTo(template.emailReplyTo);
  }

  async function handleContactsFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const invalidFile = files.find((file) => !file.name.toLowerCase().endsWith(".json"));

    if (invalidFile) {
      setJsonUploadStatus(`${invalidFile.name} is not a valid .json file.`);
      setContactsJson("");
      setIsUnique(false);
      return;
    }

    try {
      let mergedContacts = [];

      if (contactsJson.trim()) {
        const existingJson = JSON.parse(contactsJson);
        mergedContacts = Array.isArray(existingJson) ? existingJson : [existingJson];
      }

      for (const file of files) {
        const fileText = await file.text();
        const parsedJson = JSON.parse(fileText);
        const contacts = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

        mergedContacts.push(...contacts);
      }

      setContactsJson(JSON.stringify(mergedContacts, null, 2));
      setIsUnique(false);
      setContactsCheckStatus("");
      setJsonUploadStatus(
        `${files.length} new file(s) added. ${mergedContacts.length} total contact item(s) merged.`,
      );
    } catch {
      setIsUnique(false);
      setJsonUploadStatus(
        "One or more uploaded files, or the current contacts text, contain invalid JSON.",
      );
    }
  }

  async function handleContactsCheck() {
    setIsCheckingContacts(true);
    setContactsCheckStatus("Checking contacts against unique emails...");
    setIsUnique(false);

    try {
      const response = await fetch("/api/contacts/check", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ contactsJson }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Contacts could not be checked.");
      }

      setContactsJson(result.contactsJson || "[]");
      setIsUnique(true);
      setContactsCheckStatus(
        [
          `${result.keptCount} new contact(s) remain.`,
          `${result.existingCount} existing email(s) removed.`,
          result.invalidCount ? `${result.invalidCount} invalid item(s) skipped.` : "",
          result.duplicateCount ? `${result.duplicateCount} duplicate item(s) skipped.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (error) {
      setIsUnique(false);
      setContactsCheckStatus(
        error instanceof Error ? error.message : "Contacts could not be checked.",
      );
    } finally {
      setIsCheckingContacts(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("");

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          campaignName,
          contactsJson,
          emailSubject,
          fromEmail,
          fromName,
          isUnique,
          is_unique: String(isUnique),
          replyTo,
          scheduleAt: sendMode === "scheduled" && scheduleAt ? new Date(scheduleAt).toISOString() : "",
          sendMode,
          templateId: selectedTemplate,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Campaign could not be created.");
      }

      setSubmitStatus(result.message || "Campaign created successfully.");
      router.push("/campaign");
    } catch (error) {
      setSubmitStatus(
        error instanceof Error ? error.message : "Campaign could not be created.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      activeItem="campaign"
      description="Create a campaign, import contacts, select a template, and choose when to send."
      eyebrow="Campaigns"
      title="Create campaign"
    >
      <section className="campaign-form-layout">
        <form className="dashboard-section campaign-form" onSubmit={handleSubmit}>
          <div className="section-heading campaign-form-heading">
            <div>
              <p className="eyebrow">New campaign</p>
              <h2>Campaign details</h2>
              <p>Add the basic sending information for this campaign.</p>
            </div>

            <Link className="button-secondary" href="/campaign">
              <ArrowLeft aria-hidden="true" size={16} />
              Back
            </Link>
          </div>

          <div className="form-grid">
            <label className="form-field form-field-full" htmlFor="campaign-name">
              <span>
                Campaign name <b aria-hidden="true">*</b>
              </span>
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                id="campaign-name"
                name="campaignName"
                placeholder="29 Jul, 2026 (Target)"
                required
                type="text"
              />
            </label>

            <div className="form-field form-field-full">
              <span>
                Contacts import in JSON <b aria-hidden="true">*</b>
              </span>
              <label className="json-upload-box" htmlFor="contacts-file">
                <Upload aria-hidden="true" size={20} />
                <span>
                  <strong>Upload JSON file</strong>
                  <small>{jsonUploadStatus}</small>
                </span>
                <input
                  accept=".json,application/json"
                  id="contacts-file"
                  multiple
                  name="contactsFile"
                  onChange={handleContactsFileUpload}
                  type="file"
                />
              </label>
              <textarea
                id="contacts-json"
                name="contactsJson"
                onChange={(event) => {
                  setContactsJson(event.target.value);
                  setIsUnique(false);
                  setContactsCheckStatus("");
                }}
                placeholder={'[\n  { "email": "name@example.com", "name": "John Doe" }\n]'}
                required
                rows={8}
                value={contactsJson}
              />
              <input name="is_unique" type="hidden" value={String(isUnique)} />
              <small>
                Upload one or more JSON files. Arrays are merged together, and
                single objects are added as contacts.
              </small>
              <div className="contacts-check-row">
                <button
                  className="button-secondary"
                  disabled={isCheckingContacts || contactsJson.trim().length === 0}
                  onClick={handleContactsCheck}
                  type="button"
                >
                  {isCheckingContacts ? (
                    <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                  ) : null}
                  {isCheckingContacts ? "Checking..." : "Check"}
                </button>
                {contactsCheckStatus ? <small>{contactsCheckStatus}</small> : null}
              </div>
            </div>

            <label className="form-field form-field-full" htmlFor="template">
              <span>
                Select template <b aria-hidden="true">*</b>
              </span>
              <select
                id="template"
                name="templateId"
                onChange={handleTemplateChange}
                required
                disabled={isLoadingTemplates || templates.length === 0}
                value={selectedTemplate}
              >
                <option value="" disabled>
                  {isLoadingTemplates ? "Loading templates..." : "Choose a template"}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {templateLoadStatus ? <small>{templateLoadStatus}</small> : null}
              {!isLoadingTemplates && templates.length === 0 && !templateLoadStatus ? (
                <small>No templates found. Add a template first from the Templates page.</small>
              ) : null}
            </label>

            <label className="form-field" htmlFor="email-subject">
              <span>
                Email subject <b aria-hidden="true">*</b>
              </span>
              <input
                id="email-subject"
                name="emailSubject"
                onChange={(event) => setEmailSubject(event.target.value)}
                placeholder="Fresh updates from our team"
                required
                type="text"
                value={emailSubject}
              />
            </label>

            <label className="form-field" htmlFor="from-name">
              <span>
                From name <b aria-hidden="true">*</b>
              </span>
              <input
                id="from-name"
                name="fromName"
                onChange={(event) => setFromName(event.target.value)}
                placeholder="Marketing Team"
                required
                type="text"
                value={fromName}
              />
            </label>

            <label className="form-field" htmlFor="from-email">
              <span>
                From email <b aria-hidden="true">*</b>
              </span>
              <input
                id="from-email"
                name="fromEmail"
                onChange={(event) => setFromEmail(event.target.value)}
                placeholder="hello@example.com"
                required
                type="email"
                value={fromEmail}
              />
            </label>

            <label className="form-field" htmlFor="reply-to">
              <span>Reply to</span>
              <input
                id="reply-to"
                name="replyTo"
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="support@example.com"
                type="email"
                value={replyTo}
              />
            </label>
          </div>

          <fieldset className="schedule-options">
            <legend>Schedule</legend>
            <label className="schedule-option">
              <input
                checked={sendMode === "now"}
                name="sendMode"
                onChange={() => setSendMode("now")}
                type="radio"
                value="now"
              />
              <span>
                <strong>Send now</strong>
                <small>Start sending immediately after submit.</small>
              </span>
            </label>
            <label className="schedule-option">
              <input
                checked={sendMode === "scheduled"}
                name="sendMode"
                onChange={() => setSendMode("scheduled")}
                type="radio"
                value="scheduled"
              />
              <span>
                <strong>Schedule later</strong>
                <small>Set a date and time for this campaign.</small>
              </span>
            </label>
          </fieldset>

          <label
            className="form-field schedule-date"
            hidden={sendMode !== "scheduled"}
            htmlFor="schedule-at"
          >
            <span>Schedule date and time</span>
            <input
              disabled={sendMode !== "scheduled"}
              id="schedule-at"
              name="scheduleAt"
              onChange={(event) => setScheduleAt(event.target.value)}
              required={sendMode === "scheduled"}
              type="datetime-local"
              value={scheduleAt}
            />
          </label>

          {submitStatus ? <p className="form-status-error">{submitStatus}</p> : null}

          <div className="form-actions">
            <Link className="button-secondary" href="/campaign">
              Cancel
            </Link>
            <button
              className="button-primary"
              disabled={isCheckingContacts || isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
              ) : (
                <Send aria-hidden="true" size={16} />
              )}
              {isSubmitting ? "Submitting..." : "Submit campaign"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
