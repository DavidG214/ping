import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { SessionInfo } from "../shared/contracts";
import { api, clearPrivateRequests } from "./api";
type SessionContext = {
  session: SessionInfo;
  setSession: (s: SessionInfo) => void;
  logout: () => Promise<void>;
};
const Context = createContext<SessionContext>(null!);
export const useSession = () => useContext(Context);
const blank: SessionInfo = {
  csrf: "",
  actor: null,
  demo: true,
  hasDemo: false,
};
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo>(blank),
    [ready, setReady] = useState(false),
    [covered, setCovered] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [generation, setGeneration] = useState(0),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  const current = useRef(session);
  current.current = session;
  const channel = useRef<BroadcastChannel | null>(null);
  function lock() {
    clearPrivateRequests();
    current.current = { ...current.current, actor: null };
    setGeneration((v) => v + 1);
    setSession((s) => ({ ...s, actor: null }));
    setCovered(false);
  }
  async function logout() {
    setSigningOut(true);
    localStorage.setItem("ping-locked", "1");
    lock();
    channel.current?.postMessage("lock");
    try {
      const s = await api<SessionInfo>("/auth/logout", {});
      setSession(s);
      localStorage.removeItem("ping-locked");
      // The cookie has now rotated; other tabs must refresh their CSRF token.
      channel.current?.postMessage("lock");
    } catch {
      setError("Signed out on this device. Reconnect before signing in again.");
    } finally {
      setSigningOut(false);
    }
  }
  async function bootstrap() {
    try {
      let s = await api<SessionInfo>("/session");
      if (localStorage.getItem("ping-locked")) {
        s = await api<SessionInfo>("/auth/logout", {});
        localStorage.removeItem("ping-locked");
      }
      setSession(s);
      setError("");
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void bootstrap();
    channel.current = new BroadcastChannel("ping-privacy");
    channel.current.onmessage = async () => {
      lock();
      try {
        const s = await api<SessionInfo>("/session");
        // Learn only public session metadata. A remote login never opens this tab's private UI.
        if (!current.current.actor) setSession({ ...s, actor: null });
      } catch {
        // Stay locked. A failed refresh must never restore private content.
      }
    };
    const expired = () => {
      lock();
      setError("Your session expired. Sign in again to continue.");
    };
    window.addEventListener("ping-expired", expired);
    return () => {
      channel.current?.close();
      window.removeEventListener("ping-expired", expired);
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const s = current.current;
      if (s.actor && (n >= s.idleAt! || n >= s.absoluteAt!)) {
        void logout();
        setError("Your session expired. Sign in again to continue.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let last = 0;
    const activity = () => {
      if (!current.current.actor || Date.now() - last < 15000) return;
      // The warning has an explicit renewal action; keyboard navigation must not dismiss it.
      if (
        current.current.idleAt! - Date.now() <
        (current.current.warningMs || 30000)
      )
        return;
      last = Date.now();
      const csrf = current.current.csrf;
      api<SessionInfo>("/session/activity", {})
        .then((s) => {
          if (
            csrf === current.current.csrf &&
            s.actor?.id === current.current.actor?.id
          )
            setSession(s);
        })
        .catch(() => {});
    };
    const hide = () => {
      if (current.current.actor) {
        document.documentElement.dataset.privateHidden = "true";
        setCovered(true);
      }
    };
    const restore = () => {
      if (!current.current.actor) {
        delete document.documentElement.dataset.privateHidden;
        return;
      }
      setCovered(true);
      const csrf = current.current.csrf;
      api<SessionInfo>("/session")
        .then((s) => {
          if (csrf !== current.current.csrf || !current.current.actor) return;
          if (!s.actor || s.actor.id !== current.current.actor?.id) lock();
          else setSession(s);
          setCovered(false);
          delete document.documentElement.dataset.privateHidden;
        })
        .catch(() => {
          lock();
          delete document.documentElement.dataset.privateHidden;
          setError("Reconnect and sign in before viewing private information.");
        });
    };
    const visible = () =>
      document.visibilityState === "hidden" ? hide() : restore();
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  if (!ready)
    return (
      <main className="startup">
        <span className="brand">
          PING<span className="signal">◌</span>
        </span>
        <h1>Connecting to PING</h1>
        <p>{error || "Opening a private connection…"}</p>
        {error && <button onClick={bootstrap}>Try again</button>}
      </main>
    );
  return (
    <Context.Provider
      value={{
        session,
        setSession: (s) => {
          clearPrivateRequests();
          current.current = s;
          setGeneration((v) => v + 1);
          channel.current?.postMessage("lock");
          setSession(s);
          setError("");
        },
        logout,
      }}
    >
      {error && (
        <div className="global-notice" role="status">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {(covered || signingOut) && (
        <main className="startup">
          <h1>{signingOut ? "Signing out…" : "Checking your session…"}</h1>
        </main>
      )}
      <div
        key={`${generation}:${session.actor?.workspaceId || ""}:${session.actor?.id || "public"}`}
        hidden={covered || signingOut}
        inert={covered || signingOut}
      >
        {children}
      </div>
      {session.actor &&
        session.idleAt! - now < (session.warningMs || 30000) && (
          <SessionWarning
            remaining={Math.max(
              0,
              Math.ceil(
                (Math.min(session.idleAt!, session.absoluteAt!) - now) / 1000,
              ),
            )}
            logout={logout}
            renew={async () => {
              const csrf = current.current.csrf;
              const next = await api<SessionInfo>("/session/activity", {});
              if (current.current.actor && current.current.csrf === csrf)
                setSession(next);
            }}
          />
        )}
    </Context.Provider>
  );
}

function SessionWarning({
  remaining,
  renew,
  logout,
}: {
  remaining: number;
  renew: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    keep = useRef<HTMLButtonElement>(null);
  const [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    node.showModal();
    keep.current?.focus();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="timeout"
      role="alertdialog"
      aria-label="Session ending"
      aria-describedby="session-warning-description"
      onCancel={(e) => e.preventDefault()}
    >
      <strong>Your private session ends soon.</strong>
      <p id="session-warning-description">
        {remaining} seconds remaining. Unsaved text will be cleared.
      </p>
      {failure && <p role="alert">{failure}</p>}
      <div className="actions">
        <button
          ref={keep}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFailure("");
            try {
              await renew();
            } catch {
              setFailure(
                "Could not extend your session. Check your connection and try again, or sign out. The original deadline still applies.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Reconnecting…" : "Keep me signed in"}
        </button>
        <button className="secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    </dialog>
  );
}
