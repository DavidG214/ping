import { useState, useEffect, lazy, Suspense, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { api } from "./api";
import { useSession } from "./session";
import { Feedback, Field, Loading, DataStatus, useData } from "./ui";
import type { SessionInfo } from "../shared/contracts";
import { ResidentDashboard } from "./Resident";
import { StaffDashboard } from "./Staff";
const Directory = lazy(() => import("./Directory"));
export function App() {
  const { session, logout } = useSession();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="demo-banner">
        <span className="dot" /> FICTIONAL DEMONSTRATION{" "}
        <span className="banner-detail">
          · No real emergency services or personal records
        </span>
      </div>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="PING home">
          PING
          <span className="signal" aria-hidden="true">
            ◌
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {session.actor ? (
            <>
              <NavLink
                to={session.actor.role === "resident" ? "/inbox" : "/staff"}
              >
                {session.actor.role === "resident"
                  ? "My pings"
                  : "Staff workspace"}
              </NavLink>
              <button onClick={logout}>Sign out</button>
            </>
          ) : (
            <NavLink to="/directory">Help desks</NavLink>
          )}
        </nav>
      </header>
      {!online && (
        <div className="global-notice" role="status">
          You’re offline. New pings cannot be exchanged. Ask help-desk staff
          about paper intake; reconnect to check replies.
        </div>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/directory"
            element={
              <Suspense fallback={<Loading />}>
                <Directory />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={<Login key={window.location.search} />}
          />
          <Route path="/help" element={<Help />} />
          <Route path="/demo" element={<Demo />} />
          <Route
            path="/inbox"
            element={
              session.actor?.role === "resident" ? (
                <ResidentDashboard />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/staff"
            element={
              session.actor && session.actor.role !== "resident" ? (
                <StaffDashboard />
              ) : (
                <Navigate to="/login?staff=1" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
function Home() {
  return (
    <section className="task-home">
      <h1>Stay in touch with PING</h1>
      <p>
        Check a private message or ask a help desk to help you find someone.
      </p>
      <div className="home-actions">
        <Link className="button" to="/login">
          Check my pings <span aria-hidden="true">→</span>
        </Link>
        <Link className="button secondary" to="/help">
          Request help finding someone <span aria-hidden="true">→</span>
        </Link>
        <Link className="button secondary" to="/directory">
          Find a help desk <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="home-secondary">
        <Link to="/login?staff=1">Staff sign in</Link>
        <Link to="/demo">Try the demo</Link>
      </div>
    </section>
  );
}
export function Login() {
  const { session, setSession } = useSession(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const staff = params.has("staff"),
    who = params.get("as");
  const [code, setCode] = useState(""),
    [pin, setPin] = useState(""),
    [shared, setShared] = useState(""),
    [assistance, setAssistance] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (who && session.hasDemo)
      api("/demo/guide")
        .then((g) => {
          const p = g.residents[who];
          if (p) {
            setCode(p.code);
            setPin(p.pin);
          }
        })
        .catch((e) => setError(e.message));
  }, [who, session.hasDemo]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<SessionInfo>(
        staff ? "/auth/staff" : "/auth/resident",
        staff
          ? { username: code, password: pin, sharedDevice: shared === "yes" }
          : {
              code,
              pin,
              sharedDevice: shared === "yes",
              assistance: assistance === "help",
            },
      );
      setPin("");
      setCode("");
      setSession(data);
      navigate(staff ? "/staff" : "/inbox", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="narrow-page login-page">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <span className="eyebrow">
        {staff ? "AUTHORIZED STAFF" : "YOUR PRIVATE SPACE"}
      </span>
      <h1>{staff ? "Staff sign in" : "Check my pings"}</h1>
      <p className="lead">
        {staff
          ? "Use the account provided by your organization."
          : "Use the code on your account card and the PIN you chose."}
      </p>
      {who && (
        <div className="notice">
          Fictional demo credentials filled in for {who}. Choose both
          preferences below to continue.
        </div>
      )}
      <Feedback error={error} />
      <form onSubmit={submit} className="panel form-stack" autoComplete="off">
        <Field label={staff ? "Username" : "Account code"}>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={staff ? 150 : 40}
            placeholder={
              staff ? "Your staff username" : "XXXX-XXXX-XXXX-XXXX-XXXX"
            }
          />
        </Field>
        <Field label={staff ? "Password" : "Six-digit PIN"}>
          <input
            required
            type="password"
            inputMode={staff ? "text" : "numeric"}
            pattern={staff ? undefined : "[0-9]{6}"}
            minLength={staff ? 1 : 6}
            maxLength={staff ? 200 : 6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <fieldset>
          <legend>Are you using a shared device?</legend>
          <label className="choice">
            <input
              type="radio"
              name="device"
              value="yes"
              required
              checked={shared === "yes"}
              onChange={() => setShared("yes")}
            />
            Yes, this device is shared
          </label>
          <label className="choice">
            <input
              type="radio"
              name="device"
              value="no"
              checked={shared === "no"}
              onChange={() => setShared("no")}
            />
            No, this is my personal device
          </label>
          <small>
            Your choice applies to this session. All sessions expire.
          </small>
        </fieldset>
        {!staff && (
          <fieldset>
            <legend>How will you check for replies?</legend>
            <label className="choice">
              <input
                type="radio"
                name="assistance"
                required
                checked={assistance === "self"}
                onChange={() => setAssistance("self")}
              />
              I’ll check PING myself
            </label>
            <label className="choice">
              <input
                type="radio"
                name="assistance"
                checked={assistance === "help"}
                onChange={() => setAssistance("help")}
              />
              I need volunteer help
            </label>
            <small>
              This preference stays saved after you sign out. You can change it
              later.
            </small>
          </fieldset>
        )}
        <button disabled={busy}>
          {busy
            ? "Signing in…"
            : "Open my " + (staff ? "workspace" : "pings") + " →"}
        </button>
      </form>
      <p className="center">
        <Link to="/help">Lost your code or forgotten your PIN?</Link>
      </p>
      {!session.hasDemo && (
        <p className="center">
          Reviewing PING? <Link to="/demo">Start the fictional demo.</Link>
        </p>
      )}
    </section>
  );
}
function Help() {
  return (
    <section className="narrow-page">
      <span className="eyebrow">A PERSON CAN HELP</span>
      <h1>Start at a help desk.</h1>
      <p className="lead">
        A volunteer can register you, help you request contact, or arrange help
        checking your inbox.
      </p>
      <div className="panel">
        <h2>No phone or ID required</h2>
        <p>
          Choose a name or nickname and a six-digit PIN. We give you an
          account-code card. Keep your PIN separate; do not choose a birthday or
          other personal information.
        </p>
        <Link className="button" to="/directory">
          Find a help desk ↗
        </Link>
      </div>
      <div className="panel">
        <h2>Lost your account details?</h2>
        <p>
          Ask designated staff for a private account review. A name or birthday
          alone cannot recover an account. Staff will explain the review
          process; there is no automatic reset in this demo.
        </p>
        <h3>Children and sensitive situations</h3>
        <p>
          Designated safeguarding staff handle these cases outside the ordinary
          contact flow. A claimed relationship does not authorize disclosure or
          reunification.
        </p>
      </div>
      <p className="muted">
        No connection? New pings cannot be exchanged. Ask staff about paper
        intake. This fictional prototype is not an emergency service.
      </p>
    </section>
  );
}
function Demo() {
  const { session, setSession } = useSession(),
    navigate = useNavigate();
  const [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const guideState = useData<any>(
    session.hasDemo ? "/demo/guide" : "/session",
    version,
  );
  const guide = guideState.data;
  async function start() {
    setBusy(true);
    setError("");
    try {
      if (session.hasDemo) await api("/demo/reset", {});
      const r = await api("/demo/start", {});
      setSession(r);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function staff(role: string) {
    setBusy(true);
    try {
      setSession(await api("/demo/role", { role }));
      navigate("/staff");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-width app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE REVIEWER WALKTHROUGH</span>
          <h1>One message. Your own demo.</h1>
          <p>
            Your fictional workspace is separate from other reviewers and
            expires after 24 hours.
          </p>
        </div>
        <button
          disabled={busy}
          className={session.hasDemo ? "secondary" : ""}
          onClick={start}
        >
          {busy
            ? "Preparing…"
            : session.hasDemo
              ? "Reset my demo"
              : "Start my demo →"}
        </button>
      </div>
      <Feedback error={error} />
      {session.hasDemo && <DataStatus state={guideState} />}
      <div className="walkthrough">
        <article>
          <span className="step-number">01</span>
          <h3>Route a possible match</h3>
          <p>
            Alex at Cypress Hall is looking for Jordan. Open staff B, find the
            Jordan request, and route it to the local Jordan candidate.
          </p>
        </article>
        <article>
          <span className="step-number">02</span>
          <h3>Reply as Jordan</h3>
          <p>
            Sign in as Jordan, answer both questions, and preview “I'm safe.”
            Leave shelter sharing off.
          </p>
        </article>
        <article>
          <span className="step-number">03</span>
          <h3>Check Alex’s pings</h3>
          <p>
            The reply contains no shelter. Return as Jordan to separately
            preview and share a shelter if you choose.
          </p>
        </article>
      </div>
      {session.hasDemo && guide?.residents ? (
        <>
          <div className="section-heading">
            <h2>Choose a fictional role</h2>
            <p>
              Resident shortcuts fill in demo credentials; they still use the
              normal login flow.
            </p>
          </div>
          <div className="role-grid">
            {Object.entries(guide.residents).map(([key, r]: [string, any]) => (
              <article className="panel" key={key}>
                <span className="eyebrow">
                  RESIDENT · HELP DESK {r.shelterId}
                </span>
                <h3>{r.name}</h3>
                <p>
                  {key === "alex"
                    ? "The requester"
                    : key === "jordan"
                      ? "The possible match"
                      : key === "sam"
                        ? "Wrong-person example"
                        : key === "taylor"
                          ? "Silent-decline example"
                          : "Safeguarding example"}
                </p>
                <Link className="button secondary" to={"/login?as=" + key}>
                  Sign in as {r.name.split(" ")[0]} →
                </Link>
                <details>
                  <summary>Fictional credentials</summary>
                  <code className="account-code">
                    {r.code.match(/.{1,4}/g)?.join("-")}
                  </code>
                  <p>Demo PIN: {r.pin}</p>
                </details>
              </article>
            ))}
          </div>
          <div className="staff-switch">
            <h3>Volunteer workspaces</h3>
            <div className="actions">
              {["A", "B", "C"].map((s) => (
                <button
                  disabled={busy}
                  className="secondary"
                  key={s}
                  onClick={() => staff(s)}
                >
                  Staff {s}
                </button>
              ))}
              <button
                disabled={busy}
                className="secondary"
                onClick={() => staff("safeguarding")}
              >
                Safeguarding staff
              </button>
            </div>
            <p className="muted">
              Staff controls only enter roles in your own fictional workspace.
              No real accounts or disaster records are connected.
            </p>
          </div>
        </>
      ) : (
        <div className="panel">
          <h2>Ready when you are.</h2>
          <p>
            Start your demo to create persisted fictional records. You can also
            register another fictional adult at Staff A and create a new
            request.
          </p>
        </div>
      )}
      <div className="notice">
        Direct delivery means a message is available when the resident opens
        PING. There are no text messages, emails, or phone notifications.
      </div>
    </section>
  );
}
