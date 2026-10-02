import Link from "next/link";

export default function Home() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Home</p>
        <h1>Email Sending Project</h1>
        <p>
          Start with login, then open the dashboard or campaign page when you
          are ready to make the content dynamic.
        </p>
        <div className="home-actions">
          <Link href="/login">Login</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/campaign">Campaign</Link>
        </div>
      </section>
    </main>
  );
}
