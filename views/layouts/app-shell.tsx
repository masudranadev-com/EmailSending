import type { ReactNode } from "react";
import Footer from "./footer";
import Header from "./header";
import Sidebar from "./sidebar";

type AppShellProps = {
  actionHref?: string;
  actionLabel?: string;
  activeItem?: "dashboard" | "campaign" | "customer" | "templates" | "settings";
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  searchPlaceholder?: string;
  title?: string;
};

export default function AppShell({
  actionHref,
  actionLabel,
  activeItem = "dashboard",
  children,
  description,
  eyebrow,
  searchPlaceholder,
  title,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar activeItem={activeItem} />

      <div className="app-content-shell">
        <Header
          actionHref={actionHref}
          actionLabel={actionLabel}
          eyebrow={eyebrow}
          title={title}
          description={description}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="app-main">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
