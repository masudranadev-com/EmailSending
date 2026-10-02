import Link from "next/link";

type LoginPageProps = {
  error?: string;
  nextPath?: string;
};

const loginErrors: Record<string, string> = {
  invalid: "Username or password is incorrect.",
  server: "Login failed. Please check the database connection and try again.",
};

export default function LoginPage({ error, nextPath }: LoginPageProps) {
  const errorMessage = error ? loginErrors[error] : "";
  const safeNextPath = nextPath?.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/dashboard";

  return (
    <main className="auth-page login-page">
      <section className="login-shell" aria-label="Login">
        <div className="login-intro">
          <Link className="login-brand" href="/">
            Email Sending Project
          </Link>
          <div className="status-badge status-badge-success">Secure access</div>
          <h1>Sign in to manage your email campaigns.</h1>
          <p>
            Review campaign performance, prepare recipients, and keep your
            email workflow moving from one professional workspace.
          </p>

          <div className="login-highlights" aria-label="Platform highlights">
            <div>
              <span>Clean</span>
              <p>Focused dashboard experience</p>
            </div>
            <div>
              <span>Ready</span>
              <p>Static today, dynamic later</p>
            </div>
          </div>
        </div>

        <form className="login-card" action="/api/auth/login" method="post">
          <input name="next" type="hidden" value={safeNextPath} />
          <div className="login-card-header">
            <p className="eyebrow">Account login</p>
            <h2>Welcome back</h2>
            <p>Enter your credentials to continue to the dashboard.</p>
          </div>

          {errorMessage ? (
            <p className="form-status-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <label className="form-field" htmlFor="username">
            <span>
              Username <b aria-hidden="true">*</b>
            </span>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="admin"
              autoComplete="username"
              required
            />
            <small>Use the username connected to your campaign account.</small>
          </label>

          <label className="form-field" htmlFor="password">
            <span>
              Password <b aria-hidden="true">*</b>
            </span>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="login-options">
            <label className="remember-option">
              <input type="checkbox" name="remember" />
              <span>Remember me</span>
            </label>
          </div>

          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
