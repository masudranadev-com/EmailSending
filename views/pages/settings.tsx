"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import AppShell from "../layouts/app-shell";

const settingsTabs = [
  {
    id: "server",
    label: "Server",
    description: "Brevo API and sending limits",
    icon: Server,
  },
  {
    id: "profile",
    label: "Profile",
    description: "Workspace identity and contact defaults",
    icon: UserRound,
  },
  {
    id: "security",
    label: "Security",
    description: "Password, sessions, and access controls",
    icon: ShieldCheck,
  },
] as const;

type SettingsTab = (typeof settingsTabs)[number]["id"];

type SmtpSettings = {
  apiKeyConfigured: boolean;
  apiKeyName: string;
  apiKeyPreview: string;
  dailySendingLimit: string;
  provider: string;
  speedLimitPerMinute: string;
  updatedAt: string;
};

const emptySmtpSettings: SmtpSettings = {
  apiKeyConfigured: false,
  apiKeyName: "BREVO_API_KEY",
  apiKeyPreview: "Not set",
  dailySendingLimit: "",
  provider: "Brevo API",
  speedLimitPerMinute: "",
  updatedAt: "",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("server");

  return (
    <AppShell
      actionHref="/campaign/new"
      actionLabel="New campaign"
      activeItem="settings"
      description="Manage Brevo API delivery, workspace details, and account protection."
      eyebrow="Settings"
      searchPlaceholder="Search settings"
      title="Settings"
    >
      <section className="settings-layout" aria-label="Settings">
        <nav className="settings-subnav" aria-label="Settings sections">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                aria-controls={`${tab.id}-settings-panel`}
                aria-selected={isActive}
                className={
                  isActive
                    ? "settings-subnav-link is-active"
                    : "settings-subnav-link"
                }
                id={`${tab.id}-settings-tab`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" size={20} />
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="settings-panel-shell">
          {activeTab === "server" ? <ServerSettingsPanel /> : null}
          {activeTab === "profile" ? <ProfileSettingsPanel /> : null}
          {activeTab === "security" ? <SecuritySettingsPanel /> : null}
        </div>
      </section>
    </AppShell>
  );
}

function ServerSettingsPanel() {
  const [settings, setSettings] = useState<SmtpSettings>(emptySmtpSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadSmtpSettings();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadSmtpSettings();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function loadSmtpSettings() {
    setIsLoading(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/settings/smtp", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "SMTP settings could not be loaded.");
      }

      setSettings(result.smtp || emptySmtpSettings);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "SMTP settings could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="server-settings-tab"
      className="dashboard-section settings-panel"
      id="server-settings-panel"
      role="tabpanel"
    >
      <div className="section-heading settings-panel-heading">
        <div>
          <p className="eyebrow">Server</p>
          <h2>SMTP server</h2>
          <p>Current SMTP and Brevo values are read from the local .env file.</p>
        </div>
        <span
          className={
            settings.apiKeyConfigured
              ? "status-badge status-badge-success"
              : "status-badge status-badge-warning"
          }
        >
          {settings.apiKeyConfigured ? "Configured" : "Missing API key"}
        </span>
      </div>

      <div className="settings-form">
        {statusMessage ? <p className="form-status-error">{statusMessage}</p> : null}

        <div className="form-grid">
          <label className="form-field form-field-full" htmlFor="brevo-api-key">
            <span>
              API key ({settings.apiKeyName})
            </span>
            <input
              disabled
              id="brevo-api-key"
              name="brevoApiKey"
              type="text"
              value={isLoading ? "Loading..." : settings.apiKeyPreview}
            />
            <small>The key is masked in the browser. Update the value in .env.</small>
          </label>

          <label className="form-field" htmlFor="speed-limit">
            <span>
              Speed Limit per minute
            </span>
            <input
              disabled
              id="speed-limit"
              name="speedLimitPerMinute"
              type="text"
              value={isLoading ? "Loading..." : settings.speedLimitPerMinute || "Not set"}
            />
            <small>Maximum emails to send each minute.</small>
          </label>

          <label className="form-field" htmlFor="daily-sending-limit">
            <span>
              Daily Sending Limit
            </span>
            <input
              disabled
              id="daily-sending-limit"
              name="dailySendingLimit"
              type="text"
              value={isLoading ? "Loading..." : settings.dailySendingLimit || "Not set"}
            />
            <small>Maximum emails to send in one day.</small>
          </label>

          <label className="form-field form-field-full" htmlFor="brevo-provider">
            <span>Provider</span>
            <input
              disabled
              id="brevo-provider"
              name="provider"
              type="text"
              value={isLoading ? "Loading..." : settings.provider}
            />
          </label>
        </div>

        <div className="settings-check-list" aria-label="Brevo setup checks">
          <span>
            <KeyRound aria-hidden="true" size={18} />
            {settings.apiKeyConfigured ? "API key found in .env" : "API key is missing in .env"}
          </span>
          <span>
            <CheckCircle2 aria-hidden="true" size={18} />
            Last read {formatSettingsDate(settings.updatedAt)}
          </span>
        </div>

        <div className="form-actions">
          <button
            className="button-primary"
            disabled={isLoading}
            onClick={loadSmtpSettings}
            type="button"
          >
            {isLoading ? (
              <LoaderCircle aria-hidden="true" className="loading-icon" size={16} />
            ) : (
              <RefreshCw aria-hidden="true" size={16} />
            )}
            {isLoading ? "Refreshing..." : "Refresh from .env"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ProfileSettingsPanel() {
  return (
    <section
      aria-labelledby="profile-settings-tab"
      className="dashboard-section settings-panel"
      id="profile-settings-panel"
      role="tabpanel"
    >
      <div className="section-heading settings-panel-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Workspace profile</h2>
          <p>Set default sender details used in new templates and campaigns.</p>
        </div>
      </div>

      <form className="settings-form" action="/settings">
        <div className="form-grid">
          <label className="form-field" htmlFor="workspace-name">
            <span>
              Workspace name <b aria-hidden="true">*</b>
            </span>
            <input
              defaultValue="Email Sender"
              id="workspace-name"
              name="workspaceName"
              required
              type="text"
            />
          </label>

          <label className="form-field" htmlFor="owner-name">
            <span>
              Owner name <b aria-hidden="true">*</b>
            </span>
            <input
              defaultValue="Marketing Team"
              id="owner-name"
              name="ownerName"
              required
              type="text"
            />
          </label>

          <label className="form-field" htmlFor="default-from-email">
            <span>
              Default from email <b aria-hidden="true">*</b>
            </span>
            <input
              defaultValue="hello@example.com"
              id="default-from-email"
              name="defaultFromEmail"
              required
              type="email"
            />
          </label>

          <label className="form-field" htmlFor="default-reply-to">
            <span>Default reply to</span>
            <input
              defaultValue="support@example.com"
              id="default-reply-to"
              name="defaultReplyTo"
              type="email"
            />
          </label>

          <label className="form-field form-field-full" htmlFor="company-address">
            <span>Company address</span>
            <textarea
              defaultValue="123 Campaign Street, Suite 400&#10;New York, NY 10001"
              id="company-address"
              name="companyAddress"
              rows={4}
            />
            <small>This can be used for footer compliance in outgoing email.</small>
          </label>
        </div>

        <div className="form-actions">
          <button className="button-secondary" type="button">
            Reset
          </button>
          <button className="button-primary" type="submit">
            <Save aria-hidden="true" size={16} />
            Save profile
          </button>
        </div>
      </form>
    </section>
  );
}

function SecuritySettingsPanel() {
  return (
    <section
      aria-labelledby="security-settings-tab"
      className="dashboard-section settings-panel"
      id="security-settings-panel"
      role="tabpanel"
    >
      <div className="section-heading settings-panel-heading">
        <div>
          <p className="eyebrow">Security</p>
          <h2>Account security</h2>
          <p>Manage password requirements and active account protection.</p>
        </div>
        <span className="status-badge status-badge-info">2FA ready</span>
      </div>

      <form className="settings-form" action="/settings">
        <div className="form-grid">
          <label className="form-field" htmlFor="current-password">
            <span>Current password</span>
            <input id="current-password" name="currentPassword" type="password" />
          </label>

          <label className="form-field" htmlFor="new-password">
            <span>New password</span>
            <input id="new-password" name="newPassword" type="password" />
          </label>

          <label className="form-field" htmlFor="session-timeout">
            <span>Session timeout</span>
            <select defaultValue="30" id="session-timeout" name="sessionTimeout">
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="240">4 hours</option>
            </select>
          </label>

          <label className="form-field" htmlFor="login-alerts">
            <span>Login alerts</span>
            <select defaultValue="enabled" id="login-alerts" name="loginAlerts">
              <option value="enabled">Enabled</option>
              <option value="admins">Admins only</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>

        <div className="security-options" aria-label="Security options">
          <label className="settings-toggle">
            <input defaultChecked name="twoFactor" type="checkbox" />
            <span>
              <ShieldCheck aria-hidden="true" size={18} />
              <strong>Two-factor authentication</strong>
              <small>Require a verification code during login.</small>
            </span>
          </label>

          <label className="settings-toggle">
            <input defaultChecked name="apiKeyRotation" type="checkbox" />
            <span>
              <KeyRound aria-hidden="true" size={18} />
              <strong>API key rotation reminder</strong>
              <small>Send an alert when keys have not rotated in 90 days.</small>
            </span>
          </label>
        </div>

        <div className="form-actions">
          <button className="button-secondary" type="button">
            Review sessions
          </button>
          <button className="button-primary" type="submit">
            <Save aria-hidden="true" size={16} />
            Save security
          </button>
        </div>
      </form>
    </section>
  );
}

function formatSettingsDate(value: string) {
  if (!value) {
    return "Not loaded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not loaded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
