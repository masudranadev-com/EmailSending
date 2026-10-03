"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, Filter, MailPlus, Plus, RefreshCw, Search, UsersRound, X } from "lucide-react";
import AppShell from "../layouts/app-shell";
import { parseCustomerJsonFile } from "../../lib/customer-json-files";

type CustomerRecord = {
  id: number;
  email: string;
  information: Record<string, unknown>;
  businessName: string;
  headquarters: string;
  storeLink: string;
  uniqueId: string;
  sourceId: string;
  hasExtraInformation: boolean;
  createdAt: string;
  updatedAt: string;
};

type CustomerStats = {
  total: number;
  withBusinessInfo: number;
  withStoreLink: number;
  addedThisWeek: number;
};

type LookupResult = {
  email: string;
  found: boolean;
  customer: CustomerRecord | null;
};

type LookupResponse = {
  searchedCount: number;
  foundCount: number;
  missingCount: number;
  invalidCount: number;
  duplicateCount: number;
  results: LookupResult[];
};

type CustomerUpdateResponse = {
  message: string;
  submittedCount: number;
  updatedCount: number;
  missingCount: number;
  invalidCount: number;
  duplicateCount: number;
  updatedEmails: string[];
  missingEmails: string[];
};

const defaultStats: CustomerStats = {
  total: 0,
  withBusinessInfo: 0,
  withStoreLink: 0,
  addedThisWeek: 0,
};

export default function CustomerPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [stats, setStats] = useState<CustomerStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addedFilter, setAddedFilter] = useState("all");
  const [mailInput, setMailInput] = useState("");
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [jsonImportSummary, setJsonImportSummary] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [customerUpdateResult, setCustomerUpdateResult] = useState<CustomerUpdateResponse | null>(
    null,
  );
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [activeMailAction, setActiveMailAction] = useState<"lookup" | "update" | null>(null);
  const [hasCopiedLookupJson, setHasCopiedLookupJson] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerInformation, setNewCustomerInformation] = useState("");
  const [addCustomerError, setAddCustomerError] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const isCustomerUpdateInput = mailInput.trimStart().startsWith("[");
  const isMailBusy = isLookingUp || isImportingJson;

  const handleJsonFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    setIsImportingJson(true);
    setLookupError("");
    setJsonImportSummary("");
    setLookupResult(null);
    setCustomerUpdateResult(null);
    try {
      const batches = await Promise.all(files.map(async (file) => {
        try {
          return parseCustomerJsonFile(await file.text());
        } catch (error) {
          throw new Error(`${file.name}: ${error instanceof Error ? error.message : "Could not read file."}`);
        }
      }));
      const records = batches.flat();
      setMailInput(JSON.stringify(records, null, 2));
      setJsonImportSummary(`${files.length} files merged · ${records.length} records. All records and fields preserved.`);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Could not merge JSON files.");
    } finally {
      setIsImportingJson(false);
    }
  };

  const handleDownloadMergedJson = () => {
    try {
      const records = parseCustomerJsonFile(mailInput);
      const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "merged-customers.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Invalid JSON.");
    }
  };

  const fetchCustomers = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/customers", { cache: "no-store" });
      const data = (await response.json()) as {
        customers?: CustomerRecord[];
        stats?: CustomerStats;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "Customer records could not be loaded.");
      }

      setCustomers(data.customers ?? []);
      setStats(data.stats ?? defaultStats);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Customer records could not be loaded.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, []);

  const customerStats = useMemo(
    () => [
      {
        label: "Stored emails",
        value: formatNumber(stats.total),
        helper: "From unique_emails",
        icon: UsersRound,
      },
      {
        label: "Rich profiles",
        value: formatNumber(stats.withBusinessInfo),
        helper: `${formatNumber(stats.addedThisWeek)} added this week`,
        icon: MailPlus,
      },
    ],
    [stats.addedThisWeek, stats.total, stats.withBusinessInfo],
  );

  const filteredCustomers = useMemo(() => {
    const query = emailQuery.trim().toLowerCase();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    return customers.filter((customer) => {
      const searchableText = [
        customer.email,
        customer.businessName,
        customer.headquarters,
        customer.storeLink,
        customer.uniqueId,
        customer.sourceId,
      ]
        .join(" ")
        .toLowerCase();
      const createdAt = new Date(customer.createdAt);
      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "complete" && customer.hasExtraInformation) ||
        (statusFilter === "email-only" && !customer.hasExtraInformation);
      const matchesAdded =
        addedFilter === "all" ||
        (addedFilter === "today" && isSameDay(createdAt, now)) ||
        (addedFilter === "week" && createdAt >= weekStart) ||
        (addedFilter === "older" && createdAt < weekStart);

      return matchesSearch && matchesStatus && matchesAdded;
    });
  }, [addedFilter, customers, emailQuery, statusFilter]);

  const handleProcessMails = async (action: "lookup" | "update") => {
    const isUpdate = action === "update";

    setLookupError("");
    setLookupResult(null);
    setCustomerUpdateResult(null);
    setHasCopiedLookupJson(false);
    setIsLookingUp(true);
    setActiveMailAction(action);

    try {
      const response = await fetch("/api/customers/lookup", {
        method: isUpdate ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isUpdate ? { customersJson: mailInput } : { emails: mailInput }),
      });
      const data = (await response.json()) as (LookupResponse | CustomerUpdateResponse) & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.message || (isUpdate ? "Customer update failed." : "Mail lookup failed."),
        );
      }

      if (isUpdate) {
        setCustomerUpdateResult(data as CustomerUpdateResponse);
        await fetchCustomers(true);
      } else {
        setLookupResult(data as LookupResponse);
      }
    } catch (lookupFailure) {
      setLookupError(
        lookupFailure instanceof Error
          ? lookupFailure.message
          : isUpdate
            ? "Customer update failed."
            : "Mail lookup failed.",
      );
    } finally {
      setIsLookingUp(false);
      setActiveMailAction(null);
    }
  };

  const handleCopyInfo = async () => {
    if (!selectedCustomer) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(selectedCustomer.information, null, 2));
  };

  const handleCopyLookupJson = async () => {
    if (!lookupResult) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(formatLookupJson(lookupResult), null, 2));
    setHasCopiedLookupJson(true);
    window.setTimeout(() => setHasCopiedLookupJson(false), 1800);
  };

  const handleAddCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddCustomerError("");
    setIsAddingCustomer(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newCustomerEmail,
          informationJson: newCustomerInformation,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "Customer could not be added.");
      }

      closeAddCustomerModal();
      await fetchCustomers(true);
    } catch (addFailure) {
      setAddCustomerError(addFailure instanceof Error ? addFailure.message : "Customer could not be added.");
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const openAddCustomerModal = () => {
    setAddCustomerError("");
    setNewCustomerEmail("");
    setNewCustomerInformation("");
    setIsAddCustomerOpen(true);
  };

  const closeAddCustomerModal = () => {
    setIsAddCustomerOpen(false);
    setAddCustomerError("");
    setNewCustomerEmail("");
    setNewCustomerInformation("");
  };

  const openLookupModal = () => {
    setLookupError("");
    setCustomerUpdateResult(null);
    setHasCopiedLookupJson(false);
    setIsLookupOpen(true);
  };

  const openUpdateCustomerModal = () => {
    setMailInput("");
    setJsonImportSummary("");
    setLookupResult(null);
    setLookupError("");
    setCustomerUpdateResult(null);
    setHasCopiedLookupJson(false);
    setIsLookupOpen(true);
  };

  const closeLookupModal = () => {
    setIsLookupOpen(false);
    setLookupError("");
    setCustomerUpdateResult(null);
  };

  return (
    <AppShell
      activeItem="customer"
      description="Review stored unique emails, filter contact data, and look up multiple mail addresses."
      eyebrow="Customers"
      searchPlaceholder="Search customers"
      title="Customer"
    >
      <section className="campaign-kpi-grid customer-kpi-grid" aria-label="Customer summary">
        {customerStats.map((stat) => {
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

      <section className="dashboard-section campaign-management customer-management">
        <div className="section-heading campaign-heading">
          <div>
            <p className="eyebrow">Customer list</p>
            <h2>Unique email information</h2>
            <p>Live records from the unique_emails table.</p>
          </div>
          <div className="campaign-actions">
            <button className="button-secondary" onClick={openLookupModal} type="button">
              <Search aria-hidden="true" size={16} />
              Mail lookup
            </button>
            <button className="button-secondary" onClick={openUpdateCustomerModal} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              Update Customer
            </button>
            <button className="button-primary" onClick={openAddCustomerModal} type="button">
              <Plus aria-hidden="true" size={16} />
              Add new
            </button>
            <button
              className="button-secondary"
              disabled={isRefreshing}
              onClick={() => void fetchCustomers(true)}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="customer-filter-grid" aria-label="Customer filtering options">
          <label className="form-field" htmlFor="customer-email-filter">
            <span>Search</span>
            <input
              id="customer-email-filter"
              onChange={(event) => setEmailQuery(event.target.value)}
              placeholder="Email, business, location, ID"
              type="search"
              value={emailQuery}
            />
          </label>

          <label className="form-field" htmlFor="customer-status-filter">
            <span>Information</span>
            <select
              id="customer-status-filter"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All records</option>
              <option value="complete">With details</option>
              <option value="email-only">Email only</option>
            </select>
          </label>

          <label className="form-field" htmlFor="customer-added-filter">
            <span>Added</span>
            <select
              id="customer-added-filter"
              onChange={(event) => setAddedFilter(event.target.value)}
              value={addedFilter}
            >
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="older">Older</option>
            </select>
          </label>

          <button className="button-secondary customer-filter-button" type="button">
            <Filter aria-hidden="true" size={16} />
            Filter
          </button>
        </div>

        {error ? <div className="form-status-error">{error}</div> : null}

        <div className="campaign-table-card">
          <table className="campaign-data-table customer-data-table">
            <caption>Unique email information table</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Business</th>
                <th scope="col">Headquarters</th>
                <th scope="col">Store Link</th>
                <th scope="col">Added</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="template-state-message">Loading customer records...</div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="template-empty-state">
                      <strong>No customers found</strong>
                      <span>Try another filter or add unique contacts from a campaign.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td data-label="Email">
                      <strong>{customer.email}</strong>
                      <span>{customer.uniqueId || customer.sourceId || "Stored customer"}</span>
                    </td>
                    <td data-label="Business">{customer.businessName || "-"}</td>
                    <td data-label="Headquarters">{customer.headquarters || "-"}</td>
                    <td data-label="Store Link">
                      {customer.storeLink ? (
                        <a href={customer.storeLink} rel="noreferrer" target="_blank">
                          Open store
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td data-label="Added">
                      <strong>{formatDate(customer.createdAt)}</strong>
                      <span>{formatDate(customer.updatedAt)}</span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`status-badge ${
                          customer.hasExtraInformation ? "status-badge-success" : "status-badge-info"
                        }`}
                      >
                        {customer.hasExtraInformation ? "With details" : "Email only"}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="table-actions">
                        <button
                          aria-label={`View ${customer.email}`}
                          className="icon-button"
                          onClick={() => setSelectedCustomer(customer)}
                          type="button"
                        >
                          <Eye aria-hidden="true" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCustomer ? (
        <div className="json-modal-backdrop" role="presentation">
          <section
            aria-labelledby="customer-json-title"
            aria-modal="true"
            className="json-modal"
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Customer information</p>
                <h2 id="customer-json-title">{selectedCustomer.email}</h2>
              </div>
              <button
                aria-label="Close customer information"
                className="icon-button"
                onClick={() => setSelectedCustomer(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <pre className="json-preview-block">
              <code>{JSON.stringify(selectedCustomer.information, null, 2)}</code>
            </pre>

            <div className="json-modal-actions">
              <button className="button-secondary" onClick={handleCopyInfo} type="button">
                <Copy aria-hidden="true" size={16} />
                Copy JSON
              </button>
              <button
                className="button-primary"
                onClick={() => setSelectedCustomer(null)}
                type="button"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isLookupOpen ? (
        <div className="json-modal-backdrop" role="presentation">
          <section
            aria-labelledby="customer-lookup-title"
            aria-modal="true"
            className="json-modal customer-lookup-modal"
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Mail lookup</p>
                <h2 id="customer-lookup-title">Search or update stored mails</h2>
              </div>
              <button
                aria-label="Close mail lookup"
                className="icon-button"
                disabled={isMailBusy}
                onClick={closeLookupModal}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="customer-lookup-modal-body">
              <div className="customer-mail-form">
                <label className="form-field" htmlFor="customer-json-files">
                  <span>Merge customer JSON files</span>
                  <input
                    accept=".json,application/json"
                    aria-describedby="customer-json-files-help"
                    disabled={isMailBusy}
                    id="customer-json-files"
                    multiple
                    onChange={(event) => void handleJsonFiles(event)}
                    type="file"
                  />
                  <small id="customer-json-files-help">
                    Select multiple files at once. Their records replace the text below as one merged JSON array.
                    Nothing is saved until you choose Update customers.
                  </small>
                </label>
                {isImportingJson || jsonImportSummary ? (
                  <div className="lookup-summary" role="status">
                    {isImportingJson ? "Reading and merging JSON files..." : jsonImportSummary}
                  </div>
                ) : null}
                <label className="form-field" htmlFor="customer-mails">
                  <span>Email list or customer update JSON</span>
                  <textarea
                    autoFocus
                    disabled={isMailBusy}
                    aria-describedby={lookupError ? "customer-mail-error" : undefined}
                    id="customer-mails"
                    name="customerMails"
                    onChange={(event) => {
                      setMailInput(event.target.value);
                      setJsonImportSummary("");
                    }}
                    placeholder={
                      "mail1@example.com\nmail2@example.com\n\nOr paste a JSON array containing email, headquarters, mobile_number, store_link, business_name, and seller_name."
                    }
                    rows={10}
                    value={mailInput}
                  />
                  <small>
                    Enter emails to search. Paste a JSON array to add or replace the five supported fields
                    for matching emails only; unmatched emails are skipped.
                  </small>
                </label>

                <div className="customer-mail-actions">
                  <button
                    className="button-secondary"
                    disabled={isMailBusy || !mailInput.trim() || isCustomerUpdateInput}
                    onClick={() => void handleProcessMails("lookup")}
                    type="button"
                  >
                    <Search aria-hidden="true" size={16} />
                    {activeMailAction === "lookup" ? "Searching..." : "Search"}
                  </button>
                  <button
                    className="button-primary"
                    disabled={isMailBusy || !mailInput.trim() || !isCustomerUpdateInput}
                    onClick={() => void handleProcessMails("update")}
                    type="button"
                  >
                    <RefreshCw aria-hidden="true" size={16} />
                    {activeMailAction === "update" ? "Updating..." : "Update customers"}
                  </button>
                  <button
                    className="button-secondary"
                    disabled={isMailBusy || !isCustomerUpdateInput}
                    onClick={handleDownloadMergedJson}
                    type="button"
                  >
                    Download merged JSON
                  </button>
                </div>
              </div>

              {lookupError ? <div className="form-status-error" id="customer-mail-error" role="alert">{lookupError}</div> : null}

              {customerUpdateResult ? (
                <div className="lookup-result-panel" aria-live="polite">
                  <div className="form-status-success">{customerUpdateResult.message}</div>
                  <div className="lookup-summary">
                    <span className="status-badge status-badge-success">
                      {customerUpdateResult.updatedCount} updated
                    </span>
                    <span className="status-badge status-badge-warning">
                      {customerUpdateResult.missingCount} unmatched
                    </span>
                    {customerUpdateResult.invalidCount > 0 ? (
                      <span>{customerUpdateResult.invalidCount} invalid skipped</span>
                    ) : null}
                    {customerUpdateResult.duplicateCount > 0 ? (
                      <span>{customerUpdateResult.duplicateCount} duplicate replaced</span>
                    ) : null}
                  </div>
                  {customerUpdateResult.missingEmails.length > 0 ? (
                    <small>
                      Not updated: {customerUpdateResult.missingEmails.join(", ")}
                    </small>
                  ) : null}
                </div>
              ) : null}

              {lookupResult ? (
                <div className="lookup-result-panel">
                  <div className="lookup-summary-row">
                    <div className="lookup-summary" aria-live="polite">
                      <span className="status-badge status-badge-success">
                        {lookupResult.foundCount} found
                      </span>
                      <span className="status-badge status-badge-warning">
                        {lookupResult.missingCount} missing
                      </span>
                      <span>{lookupResult.searchedCount} valid searched</span>
                      {lookupResult.invalidCount > 0 ? (
                        <span>{lookupResult.invalidCount} invalid skipped</span>
                      ) : null}
                      {lookupResult.duplicateCount > 0 ? (
                        <span>{lookupResult.duplicateCount} duplicate skipped</span>
                      ) : null}
                    </div>
                    <button className="button-secondary" onClick={handleCopyLookupJson} type="button">
                      <Copy aria-hidden="true" size={16} />
                      {hasCopiedLookupJson ? "Copied" : "Copy JSON"}
                    </button>
                  </div>

                  <div className="campaign-table-card customer-lookup-table-card">
                    <table className="campaign-data-table customer-data-table">
                      <caption>Mail lookup results</caption>
                      <thead>
                        <tr>
                          <th scope="col">Email</th>
                          <th scope="col">Status</th>
                          <th scope="col">Business</th>
                          <th scope="col">Headquarters</th>
                          <th scope="col">Store Link</th>
                          <th scope="col">Unique ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lookupResult.results.map((result) => (
                          <tr key={result.email}>
                            <td data-label="Email">
                              <strong>{result.email}</strong>
                              <span>
                                {result.customer ? formatDate(result.customer.updatedAt) : "Not stored"}
                              </span>
                            </td>
                            <td data-label="Status">
                              <span
                                className={`status-badge ${
                                  result.found ? "status-badge-success" : "status-badge-warning"
                                }`}
                              >
                                {result.found ? "Found" : "Missing"}
                              </span>
                            </td>
                            <td data-label="Business">{result.customer?.businessName || "-"}</td>
                            <td data-label="Headquarters">{result.customer?.headquarters || "-"}</td>
                            <td data-label="Store Link">
                              {result.customer?.storeLink ? (
                                <a href={result.customer.storeLink} rel="noreferrer" target="_blank">
                                  Open store
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td data-label="Unique ID">{result.customer?.uniqueId || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {isAddCustomerOpen ? (
        <div className="json-modal-backdrop" role="presentation">
          <section
            aria-labelledby="add-customer-title"
            aria-modal="true"
            className="json-modal customer-add-modal"
            role="dialog"
          >
            <div className="json-modal-header">
              <div>
                <p className="eyebrow">Add customer</p>
                <h2 id="add-customer-title">New unique email</h2>
              </div>
              <button
                aria-label="Close add customer"
                className="icon-button"
                disabled={isAddingCustomer}
                onClick={closeAddCustomerModal}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <form className="customer-add-form" onSubmit={handleAddCustomer}>
              <label className="form-field" htmlFor="new-customer-email">
                <span>
                  Email <b>*</b>
                </span>
                <input
                  autoFocus
                  id="new-customer-email"
                  name="email"
                  onChange={(event) => setNewCustomerEmail(event.target.value)}
                  placeholder="customer@example.com"
                  required
                  type="email"
                  value={newCustomerEmail}
                />
                <small>This email will be stored in unique_emails.</small>
              </label>

              <label className="form-field" htmlFor="new-customer-information">
                <span>Information JSON</span>
                <textarea
                  id="new-customer-information"
                  name="informationJson"
                  onChange={(event) => setNewCustomerInformation(event.target.value)}
                  placeholder={`{\n  "business_name": "Example Company",\n  "headquarters": "New York, NY",\n  "store_link": "https://example.com",\n  "unique_id": "abc12"\n}`}
                  rows={10}
                  value={newCustomerInformation}
                />
                <small>Optional. Leave empty to add only the email address.</small>
              </label>

              {addCustomerError ? <div className="form-status-error">{addCustomerError}</div> : null}

              <div className="json-modal-actions">
                <button
                  className="button-secondary"
                  disabled={isAddingCustomer}
                  onClick={closeAddCustomerModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-primary"
                  disabled={isAddingCustomer || !newCustomerEmail.trim()}
                  type="submit"
                >
                  <Plus aria-hidden="true" size={16} />
                  {isAddingCustomer ? "Adding..." : "Add customer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatLookupJson(lookupResult: LookupResponse) {
  return lookupResult.results.flatMap((result) => {
    if (!result.customer || !hasCopyableInformation(result.customer.information)) {
      return [];
    }

    return [orderCustomerInformation(result.customer.information, result.customer.email)];
  });
}

function hasCopyableInformation(information: Record<string, unknown>) {
  return Object.values(information).some(
    (value) => value !== null && value !== undefined && String(value).trim().length > 0,
  );
}

function orderCustomerInformation(information: Record<string, unknown>, fallbackEmail: string) {
  const ordered: Record<string, unknown> = {};
  const preferredKeys = [
    "id",
    "email",
    "unique_id",
    "store_link",
    "headquarters",
    "business_name",
    "seller_name",
  ];

  for (const key of preferredKeys) {
    const value = key === "email" ? information.email || fallbackEmail : information[key];

    if (value !== null && value !== undefined && String(value).trim().length > 0) {
      ordered[key] = value;
    }
  }

  for (const [key, value] of Object.entries(information)) {
    if (key in ordered || preferredKeys.includes(key)) {
      continue;
    }

    if (value !== null && value !== undefined && String(value).trim().length > 0) {
      ordered[key] = value;
    }
  }

  return ordered;
}
