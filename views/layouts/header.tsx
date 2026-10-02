import Link from "next/link";
import { Bell, Plus, Search } from "lucide-react";

type HeaderProps = {
  actionHref?: string;
  actionLabel?: string;
  eyebrow?: string;
  searchPlaceholder?: string;
  title?: string;
  description?: string;
};

export default function Header({
  actionHref = "/campaign/new",
  actionLabel = "New campaign",
  eyebrow = "Workspace",
  searchPlaceholder = "Search campaigns",
  title = "Dashboard",
  description = "Manage your email sending workspace.",
}: HeaderProps) {
  return (
    <header className="site-header app-header">
      <div className="app-header-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="app-header-actions">
        <label className="header-search" htmlFor="dashboard-search">
          <Search aria-hidden="true" size={18} />
          <input
            id="dashboard-search"
            type="search"
            placeholder={searchPlaceholder}
          />
        </label>

        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell aria-hidden="true" size={20} />
        </button>

        <Link className="button-primary header-create" href={actionHref}>
          <Plus aria-hidden="true" size={18} />
          {actionLabel}
        </Link>
      </div>
    </header>
  );
}
