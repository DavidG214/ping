import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";
import { useSession } from "./session";
import { useData, Feedback, Field, DataStatus, Empty } from "./ui";
import type { Resident, Shelter } from "../shared/contracts";
type Reply = {
  text: string;
  location: { name: string; address: string; selfReported: boolean } | null;
};
type Ping = {
  id: string;
  state: string;
  seekerName: string;
  message: string;
  targetName: string;
  clue: string;
  response: Reply | null;
};
export type Outgoing = {
  id: string;
  targetName: string;
  createdAt: string;
  message: string;
  status: string;
  response: Reply | null;
};
export function RequestCards({ requests }: { requests: Outgoing[] }) {
  return (
    <div className="card-list">
      {requests.map((r) => (
        <article className="panel request-card" key={r.id}>
          <div className="card-heading">
            <h3>Looking for {r.targetName}</h3>
            <span className={"badge " + (r.response ? "success" : "")}>
              {r.status}
            </span>
          </div>
          <small>
            Requested{" "}
            {new Date(r.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </small>
          <p className="quote">{r.message}</p>
          {r.response ? (
            <div className="approved-response">
              <span className="eyebrow">APPROVED REPLY</span>
              <p>{r.response.text}</p>
              {r.response.location ? (
                <div className="location-disclosure">
                  <strong>
                    Shared by the sender: {r.response.location.name}
                  </strong>
                  <span>{r.response.location.address}</span>
                  <small>
                    Self-reported shelter; not independently verified.
                  </small>
                </div>
              ) : (
                <small>No shelter was shared with this reply.</small>
              )}
            </div>
          ) : (
            <p className="muted">
              You’ll see a response here only if someone chooses to send one.
              PING does not show matching or reading activity.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
export function ResidentDashboard() {
  const [version, setVersion] = useState(0),
    [tab, setTab] = useState("inbox"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [changing, setChanging] = useState(false),
    [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  const profile = useData<Resident>("/me", version),
    inbox = useData<Ping[]>("/me/inbox", version),
    outgoing = useData<Outgoing[]>("/me/requests", version);
  async function toggle() {
    if (!profile.data) return;
    setBusy(true);
    try {
      await api(
        "/me/preferences",
        { assistance: !profile.data.assistance },
        "PATCH",
      );
      setChanging(false);
      setVersion((v) => v + 1);
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
          <span className="eyebrow">YOUR PRIVATE SPACE</span>
          <h1>{profile.data ? `Hello, ${profile.data.name}.` : "My pings"}</h1>
          <p>Contact happens on your terms. A reply is always your choice.</p>
        </div>
        <button className="secondary" onClick={() => setVersion((v) => v + 1)}>
          Refresh pings ↻
        </button>
      </div>
      <Feedback error={error} />
      <DataStatus state={profile} />
      {notice && (
        <div ref={noticeRef} tabIndex={-1} className="notice" role="status">
          {notice}
        </div>
      )}
      {profile.data && (
        <div className="assistance-preference">
          <div>
            <strong>
              {profile.data?.assistance
                ? "A volunteer can help you check replies"
                : "You’re checking PING yourself"}
            </strong>
            <p>This setting stays saved when you sign out.</p>
          </div>
          <button
            disabled={busy || !profile.data}
            className="secondary small"
            aria-expanded={changing}
            onClick={() => setChanging(!changing)}
          >
            Change
          </button>
          {changing && (
            <div className="preference-change">
              <p>
                {profile.data.assistance
                  ? "Stop volunteer help checking replies?"
                  : "Ask a volunteer to help check replies?"}
              </p>
              <button disabled={busy} onClick={toggle}>
                {profile.data.assistance
                  ? "I’ll check myself"
                  : "Ask for volunteer help"}
              </button>
            </div>
          )}
        </div>
      )}
      {profile.data?.safeguarding && (
        <div className="notice">
          Please speak privately with designated safeguarding staff. This
          account cannot use ordinary reply or shelter-sharing actions.
        </div>
      )}
      <div className="sections" aria-label="My pings">
        <button aria-pressed={tab === "inbox"} onClick={() => setTab("inbox")}>
          Messages for me <span>{inbox.data?.length || 0}</span>
        </button>
        <button
          aria-pressed={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
        >
          Requests I’ve made <span>{outgoing.data?.length || 0}</span>
        </button>
      </div>
      <div hidden={tab !== "inbox"}>
        <DataStatus state={inbox} />
        {inbox.data &&
          (inbox.data.length ? (
            <div className="card-list">
              {inbox.data.map((p) => (
                <PingCard
                  key={p.id}
                  ping={p}
                  done={(message) => {
                    if (message) setNotice(message);
                    setVersion((v) => v + 1);
                  }}
                />
              ))}
            </div>
          ) : (
            <Empty title="No pings to show">
              Any message routed to you will appear here. Check again later or
              ask a volunteer for help.
            </Empty>
          ))}
      </div>
      <div hidden={tab !== "outgoing"}>
        <DataStatus state={outgoing} />
        {outgoing.data &&
          (outgoing.data.length ? (
            <RequestCards requests={outgoing.data} />
          ) : (
            <Empty title="No requests yet">
              A volunteer can help you request contact.{" "}
              <Link to="/directory">Find a help desk.</Link>
            </Empty>
          ))}
      </div>
    </section>
  );
}
function PingCard({
  ping,
  done,
}: {
  ping: Ping;
  done: (message?: string) => void;
}) {
  const { logout } = useSession();
  const [editing, setEditing] = useState(false),
    [sent, setSent] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null),
    shelterEditor = useRef<HTMLSelectElement>(null),
    canceled = useRef(false),
    previewHeading = useRef<HTMLHeadingElement>(null),
    confirmationButton = useRef<HTMLButtonElement>(null),
    sentHeading = useRef<HTMLHeadingElement>(null),
    replyButton = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState(""),
    [share, setShare] = useState(false),
    [shelterId, setShelter] = useState(""),
    [attest, setAttest] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const shelterState = useData<Shelter[]>("/shelters"),
    shelters = shelterState.data;
  const locationOnly = ping.state === "replied" || !!sent;
  useEffect(() => {
    if (preview) previewHeading.current?.focus();
    else if (confirmation) confirmationButton.current?.focus();
    else if (sent && !editing) sentHeading.current?.focus();
    else if (editing)
      (locationOnly ? shelterEditor.current : editor.current)?.focus();
    else if (canceled.current) {
      canceled.current = false;
      replyButton.current?.focus();
    }
  }, [preview, confirmation, editing, sent]);
  async function act(path: string, body: object, complete = false) {
    setBusy(true);
    setError("");
    try {
      const r = await api(`/deliveries/${ping.id}/${path}`, body);
      if (complete) {
        setPreview(null);
        setEditing(false);
        setText("");
        setShare(false);
        setShelter("");
        setAttest(false);
        if (path === "decision")
          done(
            "Ping closed. The requester has not been told about your choice.",
          );
        else {
          setSent(path === "location" ? "Shelter shared" : "Reply sent");
          done();
        }
      }
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function makePreview() {
    const p = await act(
      locationOnly ? "location-preview" : "preview",
      locationOnly
        ? { shelterId, atShelter: attest }
        : {
            text,
            shelterId: share ? shelterId : null,
            atShelter: share && attest,
          },
    );
    if (p) setPreview(p);
  }
  return (
    <article className="panel ping-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">A PRIVATE REQUEST</span>
          <h2>{ping.seekerName} would like to hear from you.</h2>
        </div>
        <span className="badge">
          {locationOnly ? "Answered" : "Your choice"}
        </span>
      </div>
      <p className="quote">{ping.message}</p>
      <p className="muted">
        Staff identified a possible match, not a verified identity. Intended for{" "}
        {ping.targetName}
        {ping.clue ? ` · ${ping.clue}` : ""}.
      </p>
      <Feedback error={error} />
      {sent && (
        <div className="notice">
          <h3 ref={sentHeading} tabIndex={-1}>
            {sent}
          </h3>
          <p>Your approved information has been sent.</p>
        </div>
      )}
      {locationOnly && (
        <div className="actions">
          <button onClick={logout}>Done—sign out</button>
          {!ping.response?.location && (
            <button
              className="secondary"
              aria-expanded={editing}
              onClick={() => setEditing(!editing)}
            >
              Share a shelter (optional)
            </button>
          )}
        </div>
      )}
      {locationOnly && (
        <div className="approved-response">
          <strong>You approved this reply</strong>
          <p>{ping.response?.text}</p>
          {ping.response?.location ? (
            <p>Shared shelter: {ping.response.location.name}</p>
          ) : (
            <p>No shelter shared.</p>
          )}
        </div>
      )}
      {editing && (!locationOnly || !ping.response?.location) && (
        <>
          {preview ? (
            <div className="preview">
              <span className="eyebrow">EXACTLY WHAT WILL BE SHARED</span>
              <h3 ref={previewHeading} tabIndex={-1}>
                {locationOnly ? "Shelter disclosure" : "Review your reply"}
              </h3>
              {preview.disclosure.text && (
                <p className="quote">{preview.disclosure.text}</p>
              )}
              {preview.disclosure.location ? (
                <div className="location-disclosure">
                  <strong>{preview.disclosure.location.name}</strong>
                  <span>{preview.disclosure.location.address}</span>
                  <small>You report that you are at this shelter.</small>
                </div>
              ) : (
                <p className="privacy-note">No shelter will be shared.</p>
              )}
              <p>
                This goes only to this requester and explicitly authorized case
                staff. Once sent, it cannot be taken back in this demo.
              </p>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      locationOnly ? "location" : "reply",
                      { token: preview.token },
                      true,
                    )
                  }
                >
                  {busy
                    ? "Sending…"
                    : locationOnly
                      ? "Share this shelter"
                      : "Send this reply"}
                </button>
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => setPreview(null)}
                >
                  Go back
                </button>
              </div>
            </div>
          ) : (
            <div className="reply-form">
              {!locationOnly && (
                <Field
                  label="Your reply"
                  hint="Only this message is sent. Avoid including a location unless you intend to share it."
                >
                  <textarea
                    ref={editor}
                    maxLength={500}
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="For example: I’m safe."
                  />
                </Field>
              )}
              {!locationOnly ? (
                <label className="choice shelter-choice">
                  <input
                    type="checkbox"
                    checked={share}
                    onChange={(e) => {
                      setShare(e.target.checked);
                      setAttest(false);
                    }}
                  />
                  <span>
                    <strong>Also share a shelter with this requester</strong>
                    <small>
                      Optional, separate permission. Off by default.
                    </small>
                  </span>
                </label>
              ) : (
                <h3>Share a shelter separately</h3>
              )}
              {(share || locationOnly) && (
                <div className="location-fields">
                  <DataStatus state={shelterState} />
                  <Field label="Shelter to share">
                    <select
                      ref={shelterEditor}
                      value={shelterId}
                      onChange={(e) => {
                        setShelter(e.target.value);
                        setAttest(false);
                      }}
                    >
                      <option value="">Choose a shelter</option>
                      {shelters?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="choice">
                    <input
                      type="checkbox"
                      checked={attest}
                      onChange={(e) => setAttest(e.target.checked)}
                    />
                    I am currently at this shelter and want this requester to
                    know.
                  </label>
                  <small>
                    Your affiliated help desk is not automatically your
                    location. Staying elsewhere? Reply without sharing a
                    shelter.
                  </small>
                </div>
              )}
              <button
                disabled={
                  busy ||
                  (!locationOnly && !text.trim()) ||
                  ((share || locationOnly) && (!shelterId || !attest))
                }
                onClick={makePreview}
              >
                {busy
                  ? "Preparing preview…"
                  : locationOnly
                    ? "Preview shelter disclosure"
                    : "Preview my reply →"}
              </button>
            </div>
          )}
        </>
      )}
      {!locationOnly && (
        <div className="private-actions">
          <p>You don’t have to respond. These choices are kept private.</p>
          {confirmation ? (
            <div className="notice">
              <p>
                {confirmation === "decline"
                  ? "Close this ping without replying?"
                  : "Report that this request is not for you?"}{" "}
                The requester will still see “Waiting for a response.”
              </p>
              <div className="actions">
                <button
                  ref={confirmationButton}
                  disabled={busy}
                  className="secondary"
                  onClick={() =>
                    act("decision", { decision: confirmation }, true)
                  }
                >
                  Confirm
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    canceled.current = true;
                    setConfirmation("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="actions">
              <button
                ref={replyButton}
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                Reply
              </button>
              <button
                disabled={busy}
                className="text-button"
                onClick={() => {
                  setEditing(false);
                  setPreview(null);
                  setConfirmation("decline");
                }}
              >
                Don’t respond
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setPreview(null);
                  setConfirmation("wrong_person");
                }}
              >
                This isn’t me
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
