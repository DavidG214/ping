import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useSession } from "./session";
import { api } from "./api";
import {
  useData,
  Feedback,
  Field,
  AgeSelect,
  ages,
  DataStatus,
  Empty,
} from "./ui";
import type { Resident } from "../shared/contracts";
import { RequestCards, type Outgoing } from "./Resident";
export function StaffDashboard() {
  const { session } = useSession(),
    [tab, setTab] = useState("matching"),
    [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1),
    a = session.actor!;
  return (
    <section className="page-width app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            AUTHORIZED STAFF · HELP DESK {a.shelterId}
          </span>
          <h1>
            {a.role === "safeguarding"
              ? "Safeguarding workspace"
              : "Staff workspace"}
          </h1>
          <p>
            Review carefully. Matching clues do not establish identity or
            permission to disclose.
          </p>
        </div>
        <button className="secondary" onClick={refresh}>
          Refresh workspace ↻
        </button>
      </div>
      <div className="staff-layout">
        <nav className="sections staff-sections" aria-label="Staff tasks">
          {(a.role === "safeguarding"
            ? ["safeguarding"]
            : ["matching", "residents", "register", "assistance"]
          ).map((t) => (
            <button
              key={t}
              aria-pressed={
                tab === t || (a.role === "safeguarding" && t === "safeguarding")
              }
              onClick={() => setTab(t)}
            >
              {
                {
                  matching: "Matching requests",
                  residents: "Local cases",
                  register: "Register resident",
                  assistance: "Needs delivery",
                  safeguarding: "Restricted cases",
                }[t]
              }
            </button>
          ))}
        </nav>
        <div className="staff-content">
          {a.role === "safeguarding" ? (
            <Safeguarding version={version} refresh={refresh} />
          ) : (
            <>
              <div hidden={tab !== "matching"}>
                <Matching version={version} refresh={refresh} />
              </div>
              <div hidden={tab !== "register"}>
                <Registration done={refresh} />
              </div>
              <div hidden={tab !== "residents"}>
                <Cases version={version} refresh={refresh} />
              </div>
              {tab === "assistance" && (
                <Assistance version={version} refresh={refresh} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
function Matching({
  version,
  refresh,
}: {
  version: number;
  refresh: () => void;
}) {
  const feed = useData<any[]>("/staff/matching-feed", version),
    residents = useData<Resident[]>("/staff/residents", version),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Record<string, string>>({});
  async function route(id: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/staff/requests/${id}/deliveries`, {
        residentId: selected[id],
      });
      setSuccess(
        "Request is now available in the resident’s private inbox. Assistance work is queued only if requested.",
      );
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Review against your local residents.</h2>
        <p>
          These are seeker-supplied clues. You can review outstanding requests
          again when someone registers.
        </p>
      </div>
      <Feedback error={error} success={success} />
      <DataStatus state={feed} />
      <DataStatus state={residents} />
      {!feed.data || !residents.data ? null : feed.data.length ? (
        <div className="matching-grid">
          {feed.data.map((q) => (
            <article className="panel" key={q.id}>
              <span className="eyebrow">POSSIBLE MATCH ONLY</span>
              <h3>Looking for {q.targetName}</h3>
              <div className="clues">
                <span>Age range: {ages[q.ageBand]}</span>
                <span>{q.clue || "No shared clue provided"}</span>
                {q.description && <span>{q.description}</span>}
              </div>
              <Field label="Compare a local candidate">
                <select
                  value={selected[q.id] || ""}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [q.id]: e.target.value }))
                  }
                >
                  <option value="">Select a resident</option>
                  {residents.data!.map((r) => (
                    <option disabled={r.safeguarding} key={r.id} value={r.id}>
                      {r.name} · {ages[r.ageBand]}
                      {r.safeguarding ? " · Safeguarding" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {selected[q.id] && (
                <div className="candidate-info">
                  {(() => {
                    const r = residents.data!.find(
                      (r) => r.id === selected[q.id],
                    )!;
                    return (
                      <>
                        <strong>{r.name}</strong>
                        <p>
                          {r.clue || "No shared clue"}
                          {r.description ? " · " + r.description : ""}
                        </p>
                        <small>Preferred language: {r.language}</small>
                      </>
                    );
                  })()}
                </div>
              )}
              <button
                disabled={busy || !selected[q.id]}
                onClick={() => route(q.id)}
              >
                Route possible match →
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No outstanding requests">
          New requests will appear here. Refresh after registration or intake.
        </Empty>
      )}
    </>
  );
}
function AccountCard({
  card,
  close,
}: {
  card: { name: string; code: string };
  close: () => void;
}) {
  return (
    <div className="account-card print-card">
      <span className="brand">PING ◌</span>
      <h3>{card.name}</h3>
      <span className="eyebrow">YOUR ACCOUNT CODE</span>
      <code className="account-code">
        {card.code.match(/.{1,4}/g)?.join("-")}
      </code>
      <p>Keep this card safe. Your PIN is separate.</p>
      <p>Open PING → Check my pings</p>
      <div className="actions no-print">
        <button onClick={() => window.print()}>Print account card</button>
        <button className="secondary" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}
function Registration({ done }: { done: () => void }) {
  const [error, setError] = useState(""),
    [card, setCard] = useState<any>(null),
    [createdId, setCreatedId] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function loadCard(id: string) {
    setBusy(true);
    setError("");
    try {
      setCard(await api(`/staff/residents/${id}/card`));
    } catch {
      setError(
        "Resident registered. The account card could not load. Retry the card below or open this resident in Local cases; do not register them again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    if (f.get("pin") !== f.get("confirm")) {
      setError("The two PIN entries must match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api("/staff/residents", {
        name: f.get("name"),
        ageBand: f.get("ageBand"),
        clue: f.get("clue"),
        description: f.get("description"),
        language: f.get("language"),
        assistance: f.get("assistance") === "on",
        safeguarding: f.get("safeguarding") === "on",
        pin: f.get("pin"),
      });
      form.reset();
      setCreatedId(r.id);
      done();
      await loadCard(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-column">
      <div className="section-heading">
        <h2>Register a fictional resident</h2>
        <p>
          Hand the device to the resident to choose their PIN. Never write it on
          the account card.
        </p>
      </div>
      <Feedback error={error} />
      {card && (
        <AccountCard
          card={card}
          close={() => {
            setCard(null);
            setCreatedId(null);
          }}
        />
      )}
      {createdId && !card && (
        <button disabled={busy} onClick={() => loadCard(createdId)}>
          Retry account card
        </button>
      )}
      {!createdId && (
        <form className="panel form-stack" onSubmit={submit} autoComplete="off">
          <div className="form-grid">
            <Field label="Name or nickname">
              <input name="name" maxLength={80} required />
            </Field>
            <Field label="Approximate age range">
              <AgeSelect />
            </Field>
          </div>
          <Field label="Shared clue (optional)">
            <input
              name="clue"
              maxLength={120}
              placeholder="For example, hometown or school"
            />
          </Field>
          <Field label="Distinguishing description (optional)">
            <textarea name="description" maxLength={240} rows={2} />
          </Field>
          <Field label="Preferred language">
            <input
              name="language"
              maxLength={60}
              defaultValue="English"
              required
            />
          </Field>
          <label className="choice">
            <input name="assistance" type="checkbox" />
            Resident requests volunteer help checking pings
          </label>
          <label className="choice">
            <input name="safeguarding" type="checkbox" />
            Consent concern or another sensitive situation
          </label>
          <small>
            Under-18 and unknown-age cases go to safeguarding automatically.
          </small>
          <div className="form-grid">
            <Field label="Resident-chosen six-digit PIN">
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="Confirm PIN">
              <input
                name="confirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="off"
              />
            </Field>
          </div>
          <button disabled={busy}>
            {busy ? "Registering…" : "Register and create account card →"}
          </button>
        </form>
      )}
    </div>
  );
}
function Cases({ version, refresh }: { version: number; refresh: () => void }) {
  const list = useData<Resident[]>("/staff/residents", version);
  const { data } = list,
    [selected, setSelected] = useState<Resident | null>(null),
    [opened, setOpened] = useState<Resident[]>([]),
    [failure, setFailure] = useState("");
  async function open(r: Resident) {
    try {
      await api(`/staff/residents/${r.id}/open-case`, {});
      setSelected(r);
      setOpened((previous) =>
        previous.some((p) => p.id === r.id) ? previous : [...previous, r],
      );
      setFailure("");
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  return (
    <>
      <Feedback error={failure} />
      <DataStatus state={list} />
      {!data ? null : (
        <div className="case-layout">
          <aside className="panel resident-list">
            <h2>Your local residents</h2>
            {data.map((r) => (
              <button
                className={
                  "resident-row " + (selected?.id === r.id ? "selected" : "")
                }
                key={r.id}
                onClick={() => open(r)}
              >
                <strong>{r.name}</strong>
                <small>
                  {r.safeguarding
                    ? "Safeguarding review"
                    : ages[r.ageBand] + " · " + r.language}
                </small>
              </button>
            ))}
          </aside>
          <div>
            {opened.map((resident) => (
              <div key={resident.id} hidden={selected?.id !== resident.id}>
                <CaseDetail
                  resident={data.find((r) => r.id === resident.id) || resident}
                  refresh={refresh}
                  externalVersion={version}
                />
              </div>
            ))}
            {!selected && (
              <Empty title="Open an authorized local case">
                Selecting a resident records your case access. Cross-shelter
                profiles are not available.
              </Empty>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function CaseDetail({
  resident,
  refresh,
  externalVersion,
}: {
  resident: Resident;
  refresh: () => void;
  externalVersion: number;
}) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [card, setCard] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [assistance, setAssistance] = useState(resident.assistance);
  useEffect(() => {
    setAssistance(resident.assistance);
  }, [resident.assistance, externalVersion]);
  const requests = useData<Outgoing[]>(
    `/staff/residents/${resident.id}/requests`,
    version + externalVersion,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/staff/requests", {
        requesterId: resident.id,
        targetName: f.get("targetName"),
        ageBand: f.get("ageBand"),
        clue: f.get("clue"),
        description: f.get("description"),
        message: f.get("message"),
        seekerName: f.get("seekerName"),
      });
      form.reset();
      setSuccess(
        "Request received. Internal review activity will not appear in the requester’s status.",
      );
      setVersion((v) => v + 1);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    try {
      await api(`/staff/residents/${resident.id}/assistance`, {
        assistance: !assistance,
      });
      setAssistance(!assistance);
      setSuccess("Assistance preference updated at the resident’s request.");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div>
      <div className="panel">
        <h2>{resident.name}</h2>
        <p>
          {resident.clue || "No shared clue"} · {resident.language}
        </p>
        <p className="muted">
          Responsible help desk: {resident.shelterId}. This is not a verified
          physical location.
        </p>
        <button className="secondary small" onClick={toggle}>
          {assistance
            ? "Stop volunteer assistance"
            : "Enable volunteer assistance"}
        </button>
        <small className="block">Change only at the resident’s request.</small>
        <button
          className="secondary small"
          onClick={async () => {
            setError("");
            try {
              setCard(await api(`/staff/residents/${resident.id}/card`));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Show account card
        </button>
      </div>
      <Feedback error={error} success={success} />
      {card && <AccountCard card={card} close={() => setCard(null)} />}
      <h2>Existing requests</h2>
      <DataStatus state={requests} />
      {requests.data &&
        (requests.data.length ? (
          <RequestCards requests={requests.data} />
        ) : (
          <Empty title="No requests yet">
            Use the form below to request contact.
          </Empty>
        ))}
      <details className="new-request">
        <summary>New contact request</summary>
        <form className="panel form-stack" onSubmit={submit}>
          <h2>Request help finding someone</h2>
          <Field label="Who are they looking for?">
            <input name="targetName" maxLength={80} required />
          </Field>
          <Field label="Their approximate age range">
            <AgeSelect />
          </Field>
          <Field label="Shared clue (optional)">
            <input name="clue" maxLength={120} />
          </Field>
          <Field label="Distinguishing description (optional)">
            <textarea name="description" maxLength={240} rows={2} />
          </Field>
          <Field
            label="Requester’s name shown to the recipient"
            hint="Confirm the resident agrees to include this name."
          >
            <input
              name="seekerName"
              defaultValue={resident.name}
              maxLength={80}
              required
            />
          </Field>
          <Field
            label="Message for the recipient"
            hint="Review this message with the requester. It will be delivered privately if staff identify a possible match."
          >
            <textarea name="message" rows={3} maxLength={500} required />
          </Field>
          <button disabled={busy}>
            {busy ? "Saving…" : "Submit contact request →"}
          </button>
        </form>
      </details>
    </div>
  );
}
function Assistance({
  version,
  refresh,
}: {
  version: number;
  refresh: () => void;
}) {
  const tasks = useData<any[]>("/staff/assistance", version);
  const { data } = tasks,
    [details, setDetails] = useState<any>(null),
    [failure, setFailure] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      if (details)
        api("/staff/assistance/" + details.id)
          .then((r) => {
            if (active) setDetails(r);
          })
          .catch(() => {
            if (active) {
              setDetails(null);
              setFailure("This assistance task is no longer available.");
              refresh();
            }
          });
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [details?.id]);
  async function action(id: string, kind: string) {
    setFailure("");
    try {
      await api(`/staff/assistance/${id}/${kind}`, {});
      setDetails(
        kind === "claim" ? await api("/staff/assistance/" + id) : null,
      );
      refresh();
    } catch (e) {
      setDetails(null);
      setFailure((e as Error).message);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Help deliver a private ping.</h2>
        <p>
          Claim one task before opening its message. Claims expire after 10
          minutes so another volunteer can take over.
        </p>
      </div>
      <Feedback error={failure} />
      <DataStatus state={tasks} />
      {details && (
        <div className="panel claimed-message">
          <span className="eyebrow">PRIVATE · ACTIVE ASSISTANCE CLAIM</span>
          <h3>
            {details.kind === "response"
              ? `Approved reply for ${details.name}`
              : `For ${details.name}, from ${details.seekerName}`}
          </h3>
          <p className="quote">{details.message}</p>
          {details.location && (
            <p>
              Separately shared shelter (self-reported):{" "}
              <strong>{details.location.name}</strong> ·{" "}
              {details.location.address}
            </p>
          )}
          <p>
            {details.kind === "response"
              ? "Present this approved reply privately to the requester. Only separately approved shelter information appears here."
              : "Present privately. To reply, the resident signs in with their own code and PIN and approves the preview. Staff cannot consent on their behalf."}
          </p>
          <div className="actions">
            <button onClick={() => action(details.id, "presented")}>
              Mark presented
            </button>
            <button
              className="secondary"
              onClick={() => action(details.id, "release")}
            >
              Release for another volunteer
            </button>
          </div>
          {details.kind === "request" && (
            <Link to="/login">Resident sign in →</Link>
          )}
        </div>
      )}
      {!data ? null : data.length ? (
        <div className="card-list">
          {data.map((t) => (
            <article className="panel queue-item" key={t.id}>
              <div>
                <h3>{t.name}</h3>
                <p>
                  {t.kind === "response"
                    ? "Approved reply"
                    : "Incoming request"}{" "}
                  · {t.language} ·{" "}
                  {t.state === "claimed"
                    ? "Assistance in progress"
                    : "Needs private delivery"}
                </p>
              </div>
              <button
                className="secondary"
                disabled={t.state === "claimed" && !t.mine}
                onClick={() => action(t.id, "claim")}
              >
                {t.mine ? "Open claimed task" : "Claim task"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No deliveries waiting">
          Pings remain in residents’ private inboxes. This queue only adds help
          for people who requested it.
        </Empty>
      )}
    </>
  );
}
function Safeguarding({
  version,
  refresh,
}: {
  version: number;
  refresh: () => void;
}) {
  const cases = useData<any[]>("/staff/safeguarding", version);
  const { data } = cases,
    [failure, setFailure] = useState("");
  return (
    <>
      <div className="notice">
        Restricted review only. No automated reunification, identity
        verification, or location release. Follow your organization’s
        safeguarding process outside this prototype.
      </div>
      <Feedback error={failure} />
      <DataStatus state={cases} />
      {!data ? null : !data.length ? (
        <Empty title="No restricted cases">
          Assigned referrals will appear here.
        </Empty>
      ) : (
        data.map((c) => (
          <article className="panel" key={c.id}>
            <h3>Designated staff review</h3>
            <p className="referral-reference">
              Referral reference: <code>{c.id}</code>
            </p>
            <p>{c.reason}</p>
            <p>
              A claimed parent or a child’s click does not authorize disclosure.
              Record the referral in your organization’s restricted process.
            </p>
            <button
              disabled={c.acknowledged}
              className="secondary"
              onClick={() =>
                api(`/staff/safeguarding/${c.id}/acknowledge`, {})
                  .then(refresh)
                  .catch((e) => setFailure(e.message))
              }
            >
              {c.acknowledged ? "Review acknowledged" : "Acknowledge referral"}
            </button>
          </article>
        ))
      )}
    </>
  );
}
