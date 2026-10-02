import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Send,
  Settings,
  UsersRound,
} from "lucide-react";

type SidebarProps = {
  activeItem?: "dashboard" | "campaign" | "customer" | "templates" | "settings";
};

const navigationItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    id: "dashboard",
  },
  {
    href: "/campaign",
    label: "Campaigns",
    icon: Send,
    id: "campaign",
  },
  {
    href: "/customer",
    label: "Customer",
    icon: UsersRound,
    id: "customer",
  },
  {
    href: "/template",
    label: "Templates",
    icon: FileText,
    id: "templates",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    id: "settings",
  },
] as const;

export default function Sidebar({ activeItem = "dashboard" }: SidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Sidebar navigation">
      <Link className="sidebar-brand" href="/dashboard">
        <span className="brand-mark" aria-hidden="true">
          <Mail size={20} />
        </span>
        <span>
          <strong>Email Sender</strong>
          <small>Campaign manager</small>
        </span>
      </Link>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeItem;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "sidebar-link is-active" : "sidebar-link"}
              href={item.href}
              key={item.id}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-status">
        <div className="status-badge status-badge-success">Active</div>
        <p>Campaign workspace is ready for your dynamic data.</p>
      </div>

      <form action="/api/auth/logout" className="sidebar-logout-form" method="post">
        <button className="sidebar-link sidebar-logout" type="submit">
          <LogOut aria-hidden="true" size={20} />
          <span>Logout</span>
        </button>
      </form>
    </aside>
  );
}
