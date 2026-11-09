"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Mail, Plus, RefreshCw, Upload, Users, UserRoundPlus, UserRoundCheck } from "lucide-react";
import AppShell from "../layouts/app-shell";

type TargetClient = {
  id: number;
  email: string;
  information: Record<string, unknown>;
  status: "new" | "old";
  createdAt: string;
  updatedAt: string;
};

type TargetStats = { total: number; names: number; old: number; new: number };

const emptyStats: TargetStats = { total: 0, names: 0, old: 0, new: 0 };

export default function TargetCustomerPage() {
  const [clients, setClients] = useState<TargetClient[]>([]);
  const [stats, setStats] = useState<TargetStats>(emptyStats);
  const [email, setEmail] = useState("");
  const [informationJson, setInformationJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "old">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  async function loadClients() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/target-clients", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Target customers could not be loaded.");
      setClients(result.clients || []);
      setStats(result.stats || emptyStats);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Target customers could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadClients(); }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesStatus = filter === "all" || client.status === filter;
      const details = Object.values(client.information).map(String).join(" ");
      return matchesStatus && (!term || `${client.email} ${details}`.toLowerCase().includes(term));
    });
  }, [clients, filter, search]);

  async function saveClients(payload: Record<string, unknown>, importing: boolean) {
    importing ? setIsImporting(true) : setIsSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch("/target/create-client", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Target customer could not be saved.");
      setStatusMessage(result.message || "Target customer saved as new.");
      if (!importing) {
        setEmail("");
        setInformationJson("");
      } else {
        setImportJson("");
      }
      await loadClients();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Target customer could not be saved.");
    } finally {
      setIsSaving(false);
      setIsImporting(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let information: Record<string, unknown> = {};
    if (informationJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(informationJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Information must be a JSON object.");
        information = parsed as Record<string, unknown>;
      } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : "Information JSON is invalid.");
        return;
      }
    }
    await saveClients({ email, information }, false);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsed: unknown = JSON.parse(importJson);
      const clientsToImport = Array.isArray(parsed) ? parsed : [parsed];
      if (!clientsToImport.length) throw new Error("Add at least one client to import.");
      await saveClients({ clients: clientsToImport }, true);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Import JSON is invalid.");
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImportJson(await file.text());
      setError("");
    } catch {
      setError("The JSON file could not be read.");
    }
  }

  const summary = [
    { label: "Customer names", value: stats.names, helper: "Distinct names in the target list", icon: Users },
    { label: "Total emails", value: stats.total, helper: "All target customer email addresses", icon: Mail },
    { label: "Old customers", value: stats.old, helper: "Already used in a campaign", icon: UserRoundCheck },
    { label: "New customers", value: stats.new, helper: "Available for a new campaign", icon: UserRoundPlus },
  ];

  return (
    <AppShell activeItem="target-customer" description="Manage the target email list used to build campaign audiences." eyebrow="Customers" title="Target Customer">
      <section className="campaign-kpi-grid" aria-label="Target customer summary">
        {summary.map((item) => {
          const Icon = item.icon;
          return <article className="metric-card campaign-summary-card" key={item.label}>
            <div className="metric-icon" aria-hidden="true"><Icon size={20} /></div>
            <div><p>{item.label}</p><h2>{isLoading ? "..." : new Intl.NumberFormat("en-US").format(item.value)}</h2></div>
            <span>{item.helper}</span>
          </article>;
        })}
      </section>

      <section className="dashboard-layout target-customer-layout">
        <div className="dashboard-primary">
          <section className="dashboard-section campaign-management">
            <div className="section-heading campaign-heading">
              <div><p className="eyebrow">Target list</p><h2>Target customers</h2><p>New records are eligible for Target Clients campaigns. Campaign use changes them to old.</p></div>
              <button className="button-secondary" disabled={isLoading} onClick={() => void loadClients()} type="button"><RefreshCw aria-hidden="true" size={16} />Refresh</button>
            </div>
            <div className="customer-filter-grid">
              <label className="form-field" htmlFor="target-search"><span>Search customers</span><input id="target-search" onChange={(event) => setSearch(event.target.value)} placeholder="Email, business, or name" value={search} /></label>
              <label className="form-field" htmlFor="target-status"><span>Status</span><select id="target-status" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}><option value="all">All customers</option><option value="new">New</option><option value="old">Old</option></select></label>
            </div>
            {error ? <div className="form-status-error" role="alert">{error}</div> : null}
            {statusMessage ? <div className="form-status-success" role="status">{statusMessage}</div> : null}
            <div className="campaign-table-card">
              <table className="campaign-data-table customer-data-table">
                <caption>Target customer email list</caption>
                <thead><tr><th scope="col">Email</th><th scope="col">Customer name</th><th scope="col">Status</th><th scope="col">Added</th></tr></thead>
                <tbody>
                  {isLoading ? <tr><td colSpan={4}>Loading target customers...</td></tr> : filteredClients.length === 0 ? <tr><td colSpan={4}>No target customers match this view.</td></tr> : filteredClients.map((client) => {
                    const name = String(client.information.seller_name || client.information.business_name || client.information.name || "-");
                    return <tr key={client.id}><td data-label="Email"><strong>{client.email}</strong></td><td data-label="Customer name">{name}</td><td data-label="Status"><span className={`status-badge ${client.status === "new" ? "status-badge-success" : "status-badge-info"}`}>{client.status === "new" ? "New" : "Old"}</span></td><td data-label="Added">{formatDate(client.createdAt)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="dashboard-aside target-customer-forms">
          <section className="dashboard-section">
            <div className="section-heading"><div><p className="eyebrow">Add one</p><h2>New target customer</h2><p>Saved as new in target_clients only.</p></div></div>
            <form className="form-grid" onSubmit={handleCreate}>
              <label className="form-field form-field-full" htmlFor="target-email"><span>Email <b aria-hidden="true">*</b></span><input autoComplete="email" id="target-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
              <label className="form-field form-field-full" htmlFor="target-information"><span>Information JSON</span><textarea id="target-information" onChange={(event) => setInformationJson(event.target.value)} placeholder={'{\n  "business_name": "Example Company",\n  "seller_name": "Example"\n}'} rows={7} value={informationJson} /><small>Optional customer details.</small></label>
              <button className="button-primary form-field-full" disabled={isSaving || !email.trim()} type="submit"><Plus aria-hidden="true" size={16} />{isSaving ? "Saving..." : "Add customer"}</button>
            </form>
          </section>

          <section className="dashboard-section">
            <div className="section-heading"><div><p className="eyebrow">Bulk import</p><h2>Import customers</h2><p>Import a JSON array or one customer object. Imported records are marked new.</p></div></div>
            <form className="form-grid" onSubmit={handleImport}>
              <label className="json-upload-box form-field-full" htmlFor="target-import-file"><Upload aria-hidden="true" size={20} /><span><strong>Choose JSON file</strong><small>Records can include email and customer details.</small></span><input accept=".json,application/json" id="target-import-file" onChange={handleFile} type="file" /></label>
              <label className="form-field form-field-full" htmlFor="target-import-json"><span>Customer JSON</span><textarea id="target-import-json" onChange={(event) => setImportJson(event.target.value)} placeholder={'[\n  { "email": "one@example.com", "business_name": "Example" }\n]'} rows={8} value={importJson} /></label>
              <button className="button-primary form-field-full" disabled={isImporting || !importJson.trim()} type="submit"><Upload aria-hidden="true" size={16} />{isImporting ? "Importing..." : "Import customers"}</button>
            </form>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
