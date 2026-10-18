import {
  useEffect,
  useState,
  useId,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { api } from "./api";
export function useData<T>(path: string, version = 0) {
  const [state, setState] = useState<{
    path: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ path, data: null, error: "", loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState((s) => ({
      path,
      data: s.path === path ? s.data : null,
      error: "",
      loading: true,
    }));
    api<T>(path)
      .then((d) => {
        if (active) setState({ path, data: d, error: "", loading: false });
      })
      .catch((e) => {
        if (active)
          setState((s) => ({ ...s, error: e.message, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [path, version, attempt]);
  return {
    ...(state.path === path ? state : { data: null, error: "", loading: true }),
    retry: () => setAttempt((v) => v + 1),
  };
}
export function DataStatus({
  state,
}: {
  state: { data: unknown; error: string; loading: boolean; retry: () => void };
}) {
  if (state.error)
    return (
      <div className="load-error">
        <Feedback error={state.error} />
        <button className="secondary" onClick={state.retry}>
          Retry
        </button>
        {state.data !== null && (
          <small>Showing the last loaded information.</small>
        )}
      </div>
    );
  if (state.loading)
    return state.data === null ? (
      <Loading />
    ) : (
      <p role="status" className="refresh-status">
        Refreshing…
      </p>
    );
  return null;
}
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice" role="status">
          {success}
        </div>
      )}
    </>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol" aria-hidden="true">
        ↗
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <p className="loading" role="status">
      Loading…
    </p>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby": hint ? id + "-hint" : undefined,
      })}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export const ages: Record<string, string> = {
  under_18: "Under 18",
  "18_29": "18–29",
  "30_44": "30–44",
  "45_64": "45–64",
  "65_plus": "65+",
  unknown: "Unknown",
};
export function AgeSelect({
  name = "ageBand",
  value,
  onChange,
  id,
  "aria-describedby": description,
}: {
  name?: string;
  value?: string;
  onChange?: (v: string) => void;
  id?: string;
  "aria-describedby"?: string;
}) {
  return (
    <select
      id={id}
      aria-describedby={description}
      name={name}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      defaultValue={value ? undefined : "unknown"}
    >
      {Object.entries(ages).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
