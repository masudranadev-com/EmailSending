"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  LoaderCircle,
  MailCheck,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { encodeCustomerRouteId } from "../../lib/customer-route-id";
import AppShell from "../layouts/app-shell";

type CampaignEmailStatus = "sent" | "failed" | "not_sent" | "sending";

type CampaignEmail = {
  businessName: string;
  canSendFollowUp: boolean;
  customerId: string;
  disabledReason: string;
  email: string;
  emailSubject: string;
  followUpCount: number;
  lastFollowUpAt: string | null;
  mailError: string;
  originalMessageId: string;
  requiresThreadingHeaders: boolean;
  sentAt: string | null;
  status: CampaignEmailStatus;
  statusLabel: string;
};

type CampaignEmailListResponse = {
  campaign: {
    id: number;
    name: string;
    subject: string;
  };
  emails: CampaignEmail[];
  pagination: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
  search: string;
};

type ConversationMessage = {
  body: string;
  createdAt: string;
  errorMessage: string | null;
  failedAt: string | null;
  id: number | null;
  messageType: "initial" | "follow_up";
  parentMessageId: string | null;
  provider: string;
  providerMessageId: string | null;
  referencesHeader: string | null;
  rfcMessageId: string | null;
  sentAt: string | null;
  status: "pending" | "sent" | "failed";
  subject: string;
  threadRootMessageId: string | null;
};

type ConversationResponse = {
  businessName: string;
  customerEmail: string;
  customerId: string;
  messages: ConversationMessage[];
};

type CampaignEmailsPageProps = {
  campaignId: string;
  initialPage: string;
  initialSearch: string;
};

export default function CampaignEmailsPage({
  campaignId,
  initialPage,
  initialSearch,
}: CampaignEmailsPageProps) {
  const router = useRouter();
  const [data, setData] = useState<CampaignEmailListResponse | null>(null);
  const [page, setPage] = useState(readPage(initialPage));
  const [search, setSearch] = useState(initialSearch.trim());
  const [searchInput, setSearchInput] = useState(initialSearch.trim());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(
    null,
  );
  const [followUpCustomer, setFollowUpCustomer] = useState<CampaignEmail | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [conversation, setConversation] = useState<ConversationResponse | null>(null);
  const [conversationCustomer, setConversationCustomer] = useState<CampaignEmail | null>(
    null,
  );
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [conversationError, setConversationError] = useState("");

  const totalRecords = data?.pagination.total || 0;
  const totalPages = data?.pagination.totalPages || 1;
  const currentPage = data?.pagination.page || page;
  const hasSearch = search.trim().length > 0;

  const headingDescription = useMemo(() => {
    if (!data) {
      return "Review campaign recipients, delivery status, and follow-up history.";
    }

    return `${totalRecords} email ${totalRecords === 1 ? "record" : "records"} for ${data.campaign.name}.`;
  }, [data, totalRecords]);

  useEffect(() => {
    void loadEmails(page, search);
  }, [campaignId, page, search]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function loadEmails(nextPage: number, nextSearch: string) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams({
        limit: "50",
        page: String(nextPage),
      });

      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      const response = await fetch(
        `/api/campaigns/${campaignId}/emails?${params.toString()}`,
        { cache: "no-store" },
      );
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.message || "Campaign emails could not be loaded.");
      }

      setData(result);

      if (result.pagination.page !== nextPage) {
        setPage(result.pagination.page);
        updateUrl(result.pagination.page, nextSearch);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Campaign emails could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function updateUrl(nextPage: number, nextSearch: string) {
    const params = new URLSearchParams();

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    const query = params.toString();
    router.replace(`/campaigns/${campaignId}/emails${query ? `?${query}` : ""}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = searchInput.trim();

    setSearch(nextSearch);
    setPage(1);
    updateUrl(1, nextSearch);
  }

  function handleReset() {
    setSearch("");
    setSearchInput("");
    setPage(1);
    updateUrl(1, "");
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    updateUrl(nextPage, search);
  }

  async function handleSendFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!followUpCustomer || isSendingFollowUp) {
      return;
    }

    const shouldSend = window.confirm(
      `Send this follow-up email to ${followUpCustomer.email}?`,
    );

    if (!shouldSend) {
      return;
    }

    setIsSendingFollowUp(true);
    setFollowUpStatus("");

    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/customers/${encodeURIComponent(
          encodeCustomerRouteId(followUpCustomer.customerId),
        )}/follow-up`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: followUpMessage,
          }),
        },
      );
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.message || "Follow-up could not be sent.");
      }

      setToast({ message: "Follow-up sent successfully.", type: "success" });
      setFollowUpStatus("Follow-up sent successfully.");
      setFollowUpMessage("");
      await loadEmails(currentPage, search);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Follow-up could not be sent.";
      setFollowUpStatus(message);
      setToast({ message, type: "error" });
    } finally {
      setIsSendingFollowUp(false);
    }
  }

  async function openConversation(customer: CampaignEmail) {
    setConversationCustomer(customer);
    setConversation(null);
    setConversationError("");
    setIsLoadingConversation(true);

    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/customers/${encodeURIComponent(
          encodeCustomerRouteId(customer.customerId),
        )}/messages`,
        { cache: "no-store" },
      );
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.message || "Conversation could not be loaded.");
      }

      setConversation(result);
    } catch (error) {
      setConversationError(
        error instanceof Error ? error.message : "Conversation could not be loaded.",
      );
    } finally {
      setIsLoadingConversation(false);
    }
  }

  return (
    <AppShell
      activeItem="campaign"
      description={headingDescription}
      eyebrow="Campaign Emails"
      title={data?.campaign.name || "Campaign Emails"}
    >
      <div className="email-page-toolbar">
        <Link className="button-secondary" href="/campaign">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to campaigns
        </Link>
        <div className="email-total-pill">
          <MailCheck aria-hidden="true" size={16} />
          <span>{totalRecords} total</span>
        </div>
      </div>

      <section className="dashboard-section email-search-section">
        <form className="email-search-form" onSubmit={handleSearchSubmit}>
          <label className="form-field" htmlFor="campaign-email-search">
            <span>Email search</span>
            <input
              id="campaign-email-search"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="support@naturalcommerce.com"
              type="search"
              value={searchInput}
            />
          </label>
          <button className="button-primary" disabled={isLoading} type="submit">
            <Search aria-hidden="true" size={16} />
            Search
          </button>
          <button
            className="button-secondary"
            disabled={isLoading && !hasSearch}
            onClick={handleReset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            Reset
          </button>
        </form>
      </section>

      {errorMessage ? <p className="form-status-error">{errorMessage}</p> : null}

      <section className="dashboard-section campaign-email-management">
        <div className="campaign-table-card">
          <table className="campaign-data-table campaign-email-table">
            <caption>Campaign customer email records</caption>
            <thead>
              <tr>
                <th scope="col">Email address</th>
                <th scope="col">Business name</th>
                <th scope="col">Email status</th>
                <th scope="col">Sent date and time</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="template-state-message">
                      <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                      Loading emails...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && data?.emails.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="template-empty-state">
                      <strong>
                        {hasSearch ? "No matching emails found" : "No email records found"}
                      </strong>
                      <span>
                        {hasSearch
                          ? "Try a different full or partial email search."
                          : "This campaign does not have customer records yet."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? data?.emails.map((customer) => (
                    <tr key={customer.customerId}>
                      <td data-label="Email address">
                        <strong>{customer.email}</strong>
                      </td>
                      <td data-label="Business name">{customer.businessName}</td>
                      <td data-label="Email status">
                        <span className={`status-badge ${getStatusClass(customer.status)}`}>
                          {customer.statusLabel}
                        </span>
                      </td>
                      <td data-label="Sent date and time">{formatDate(customer.sentAt)}</td>
                      <td data-label="Actions">
                        <div className="email-row-actions">
                          <button
                            className="button-secondary table-text-action"
                            onClick={() => openConversation(customer)}
                            type="button"
                          >
                            <Eye aria-hidden="true" size={16} />
                            View Conversation
                          </button>
                          <button
                            className="button-primary table-text-action"
                            disabled={!customer.canSendFollowUp}
                            onClick={() => setFollowUpCustomer(customer)}
                            title={
                              customer.canSendFollowUp
                                ? "Send follow-up"
                                : customer.disabledReason
                            }
                            type="button"
                          >
                            <MessageSquare aria-hidden="true" size={16} />
                            Send Follow-Up
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="email-pagination" aria-label="Email pagination">
          <button
            className="button-secondary"
            disabled={isLoading || currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="button-secondary"
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            type="button"
          >
            Next
          </button>
          <strong>{totalRecords} records</strong>
        </div>
      </section>

      {followUpCustomer ? (
        <div className="json-modal-backdrop" role="presentation">
          <form
            aria-labelledby="follow-up-title"
            aria-modal="true"
            className="json-modal follow-up-modal"
            onSubmit={handleSendFollowUp}
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Send Follow-Up</p>
                <h2 id="follow-up-title">{followUpCustomer.email}</h2>
              </div>
              <button
                aria-label="Close follow-up modal"
                className="icon-button"
                disabled={isSendingFollowUp}
                onClick={() => setFollowUpCustomer(null)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="follow-up-body">
              <div className="template-view-meta follow-up-meta">
                <span>
                  <strong>Recipient</strong>
                  {followUpCustomer.email}
                </span>
                <span>
                  <strong>Business</strong>
                  {followUpCustomer.businessName}
                </span>
                <span>
                  <strong>Original subject</strong>
                  {followUpCustomer.emailSubject}
                </span>
                <span>
                  <strong>Delivery mode</strong>
                  {followUpCustomer.requiresThreadingHeaders
                    ? `Threaded reply: ${followUpCustomer.originalMessageId}`
                    : "Brevo API follow-up"}
                </span>
              </div>
              <label className="form-field" htmlFor="follow-up-message">
                <span>
                  Message <b aria-hidden="true">*</b>
                </span>
                <textarea
                  disabled={isSendingFollowUp}
                  id="follow-up-message"
                  maxLength={5000}
                  onChange={(event) => setFollowUpMessage(event.target.value)}
                  required
                  value={followUpMessage}
                />
                <small>{followUpMessage.length} / 5000 characters</small>
              </label>
              {followUpStatus ? (
                <p
                  className={
                    followUpStatus.includes("successfully")
                      ? "form-status-success"
                      : "form-status-error"
                  }
                >
                  {followUpStatus}
                </p>
              ) : null}
            </div>
            <div className="json-modal-actions">
              <button
                className="button-secondary"
                disabled={isSendingFollowUp}
                onClick={() => setFollowUpCustomer(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button-primary"
                disabled={isSendingFollowUp || followUpMessage.trim().length === 0}
                type="submit"
              >
                {isSendingFollowUp ? (
                  <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                ) : (
                  <Send aria-hidden="true" size={16} />
                )}
                {isSendingFollowUp ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {conversationCustomer ? (
        <div className="json-modal-backdrop" role="presentation">
          <section
            aria-labelledby="conversation-title"
            aria-modal="true"
            className="json-modal conversation-modal"
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Conversation</p>
                <h2 id="conversation-title">{conversationCustomer.email}</h2>
              </div>
              <button
                aria-label="Close conversation"
                className="icon-button"
                onClick={() => setConversationCustomer(null)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="conversation-body">
              {isLoadingConversation ? (
                <div className="template-state-message">
                  <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
                  Loading conversation...
                </div>
              ) : null}
              {conversationError ? (
                <p className="form-status-error">{conversationError}</p>
              ) : null}
              {!isLoadingConversation && conversation ? (
                <div className="conversation-timeline">
                  {conversation.messages.map((message, index) => (
                    <article
                      className="conversation-message"
                      key={message.id || `${message.messageType}-${index}`}
                    >
                      <div className="conversation-message-head">
                        <span className="status-badge status-badge-info">
                          {message.messageType === "initial" ? "Original email" : "Follow-up"}
                        </span>
                        <span className={`status-badge ${getMessageStatusClass(message.status)}`}>
                          {formatMessageStatus(message.status)}
                        </span>
                      </div>
                      <h3>{message.subject}</h3>
                      <p className="conversation-date">
                        {formatDate(message.sentAt || message.failedAt || message.createdAt)}
                      </p>
                      <pre>{message.body}</pre>
                      <dl className="conversation-meta-list">
                        <div>
                          <dt>Provider</dt>
                          <dd>{message.provider}</dd>
                        </div>
                        <div>
                          <dt>Provider message ID</dt>
                          <dd>{message.providerMessageId || "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>RFC Message-ID</dt>
                          <dd>{message.rfcMessageId || "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>Parent</dt>
                          <dd>{message.parentMessageId || "None"}</dd>
                        </div>
                        <div>
                          <dt>References</dt>
                          <dd>{message.referencesHeader || "None"}</dd>
                        </div>
                      </dl>
                      {message.errorMessage ? (
                        <p className="form-status-error">{message.errorMessage}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="json-modal-actions">
              <button
                className="button-primary"
                onClick={() => setConversationCustomer(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? (
        <div className={`email-toast email-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </AppShell>
  );
}

function readPage(value: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getStatusClass(status: CampaignEmailStatus) {
  if (status === "sent") {
    return "status-badge-success";
  }

  if (status === "failed") {
    return "status-badge-error";
  }

  if (status === "sending") {
    return "status-badge-info";
  }

  return "status-badge-warning";
}

function getMessageStatusClass(status: ConversationMessage["status"]) {
  if (status === "sent") {
    return "status-badge-success";
  }

  if (status === "failed") {
    return "status-badge-error";
  }

  return "status-badge-warning";
}

function formatMessageStatus(status: ConversationMessage["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
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

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const compactText = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (response.status === 404 && compactText.includes("This page could not be found")) {
    return {
      message:
        "The follow-up API route was not found by the running server. Restart the Next.js server or rebuild/redeploy the app, then try sending the follow-up again.",
    };
  }

  return {
    message:
      compactText.slice(0, 220) ||
      `Request failed with HTTP ${response.status}. The server did not return JSON.`,
  };
}
