let csrf = "";
const retryKeys = new Map<string, string>();
const controllers = new Set<AbortController>();
let generation = 0;
export function clearPrivateRequests() {
  generation++;
  for (const c of controllers) c.abort();
  controllers.clear();
  retryKeys.clear();
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  body?: object,
  method = body ? "POST" : "GET",
): Promise<T> {
  const write = method !== "GET",
    controller = new AbortController();
  const started = generation;
  controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 20000),
    signature = path + JSON.stringify(body);
  const key = retryKeys.get(signature) || crypto.randomUUID();
  if (write) retryKeys.set(signature, key);
  try {
    const response = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: write
        ? {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
            "Idempotency-Key": key,
          }
        : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (started !== generation)
      throw new ApiError("Session changed. Sign in again to continue.", 0);
    if (data.csrf) csrf = data.csrf;
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/auth/"))
        window.dispatchEvent(new Event("ping-expired"));
      throw new ApiError(
        data.error || "Unable to complete this action.",
        response.status,
      );
    }
    retryKeys.delete(signature);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      write
        ? "Send status unknown. Reconnect and check, or retry the same action."
        : "Could not connect to PING. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    controllers.delete(controller);
  }
}
