import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

test.beforeEach(async () => {
  if (new URL(process.env.TEST_DATABASE_URL!).pathname !== "/ping_test")
    throw new Error("Dedicated test database required");
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await pool.query("DELETE FROM login_attempts WHERE key LIKE 'demo:%'");
  await pool.end();
});
async function start(page: Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a fictional role" }),
  ).toBeVisible();
}
async function role(page: Page, name: string) {
  await page.goto("/demo");
  await page.getByRole("button", { name, exact: true }).click();
}
async function login(page: Page, who: string, help = false) {
  await page.goto("/demo");
  await page.getByRole("link", { name: "Sign in as " + who }).click();
  await page.getByLabel("Yes, this device is shared").check();
  await page
    .getByLabel(help ? "I need volunteer help" : "I’ll check PING myself")
    .check();
  await page.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp("Hello, " + who) }),
  ).toBeVisible();
}
async function routeJordan(page: Page) {
  await role(page, "Staff B");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Looking for Jordan Rivera",
      exact: true,
    }),
  });
  await card
    .getByLabel("Compare a local candidate")
    .selectOption({ label: "Jordan Rivera · 30–44" });
  await card.getByRole("button", { name: "Route possible match" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Request is now available" }),
  ).toBeVisible();
}

test("background session renewal preserves the demo login choices", async ({
  page,
}) => {
  await start(page);
  await role(page, "Staff B");
  await page.goto("/demo");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/session/activity", async (route) => {
    await gate;
    await route.continue();
  });
  const renewal = page.waitForRequest("**/api/session/activity");
  await page.getByRole("link", { name: "Sign in as Jordan" }).click();
  await renewal;
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("001234");
  await page.getByLabel("Yes, this device is shared").check();
  await page.getByLabel("I’ll check PING myself").check();
  const renewed = page.waitForResponse("**/api/session/activity");
  release();
  await renewed;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expect(page.getByLabel("Yes, this device is shared")).toBeChecked();
  await expect(page.getByLabel("I’ll check PING myself")).toBeChecked();
  await page.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Jordan Rivera." }),
  ).toBeVisible();
});

test("staff creates a contact request, another shelter routes it, and recipient sees exactly the approved message", async ({
  page,
}) => {
  await start(page);
  await role(page, "Staff A");
  await page.getByRole("button", { name: "Local cases", exact: true }).click();
  await page.getByRole("button", { name: /Alex Rivera/ }).click();
  await page.getByText("New contact request", { exact: true }).click();
  await page
    .getByLabel("Who are they looking for?")
    .fill("Jordan browser intake");
  await page.getByLabel("Their approximate age range").selectOption("30_44");
  await page
    .getByLabel("Requester’s name shown to the recipient")
    .fill("Alex, approved name");
  await page
    .getByLabel("Message for the recipient")
    .fill("Please reply only if you want to.");
  await page.getByRole("button", { name: "Submit contact request" }).click();
  await expect(
    page.getByRole("heading", { name: "Looking for Jordan browser intake" }),
  ).toBeVisible();
  await role(page, "Staff B");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Looking for Jordan browser intake",
    }),
  });
  await card
    .getByLabel("Compare a local candidate")
    .selectOption({ label: "Jordan Rivera · 30–44" });
  await card.getByRole("button", { name: "Route possible match" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Request is now available" }),
  ).toBeVisible();
  await login(page, "Jordan");
  await expect(
    page.getByRole("heading", {
      name: "Alex, approved name would like to hear from you.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Please reply only if you want to.", { exact: true }),
  ).toBeVisible();
});

test("incoming assistance can be claimed, released and presented without sending a resident reply", async ({
  page,
}) => {
  await start(page);
  await routeJordan(page);
  await page
    .getByRole("button", { name: "Needs delivery", exact: true })
    .click();
  await page.getByRole("button", { name: "Claim task", exact: true }).click();
  await expect(page.locator(".claimed-message")).toContainText("It's Alex.");
  await page
    .getByRole("button", { name: "Release for another volunteer" })
    .click();
  await expect(page.locator(".claimed-message")).toHaveCount(0);
  await page.getByRole("button", { name: "Claim task", exact: true }).click();
  await page.getByRole("button", { name: "Mark presented" }).click();
  await expect(
    page.getByRole("heading", { name: "No deliveries waiting" }),
  ).toBeVisible();
  await login(page, "Jordan", true);
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toBeVisible();
  await login(page, "Alex");
  await page.getByRole("button", { name: /Requests I’ve made/ }).click();
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Looking for Jordan Rivera",
      exact: true,
    }),
  });
  await expect(card).toContainText("Waiting for a response");
});

test("approved-reply assistance displays only consented text and closes after preference revocation", async ({
  page,
}) => {
  await start(page);
  await login(page, "Alex", true);
  await routeJordan(page);
  await login(page, "Jordan");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("Approved text for Alex");
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reply sent", exact: true }),
  ).toBeVisible();
  await role(page, "Staff A");
  await page
    .getByRole("button", { name: "Needs delivery", exact: true })
    .click();
  await page.getByRole("button", { name: "Claim task", exact: true }).click();
  await expect(page.locator(".claimed-message")).toContainText(
    "Approved text for Alex",
  );
  await expect(page.locator(".claimed-message")).not.toContainText(
    "Lantern Center",
  );
  // Simulate the resident changing their preference through the other authorized desk flow.
  await page.evaluate(async () => {
    const session = await (await fetch("/api/session")).json();
    const residents = await (await fetch("/api/staff/residents")).json();
    const alex = residents.find(
      (r: { name: string }) => r.name === "Alex Rivera",
    );
    const response = await fetch(`/api/staff/residents/${alex.id}/assistance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ assistance: false }),
    });
    if (!response.ok) throw new Error("Preference update failed");
  });
  await expect(page.locator(".claimed-message")).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(page.getByRole("alert")).toContainText("no longer available");
});

test("safeguarding stays a separate acknowledgment-only workspace", async ({
  page,
}) => {
  await start(page);
  await role(page, "Safeguarding staff");
  await expect(
    page.getByRole("heading", { name: "Safeguarding workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Register resident", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Acknowledge referral" }).click();
  await expect(
    page.getByRole("button", { name: "Review acknowledged" }),
  ).toBeDisabled();
  await login(page, "Casey", true);
  await expect(
    page.getByText(
      "Please speak privately with designated safeguarding staff.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toHaveCount(0);
});

test("failed staff feed offers Retry and assistance preference can be changed independently", async ({
  page,
}) => {
  await start(page);
  await page.route("**/api/staff/matching-feed", (route) => route.abort(), {
    times: 1,
  });
  await role(page, "Staff B");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Looking for Jordan Rivera",
      exact: true,
    }),
  ).toBeVisible();
  await login(page, "Sam");
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page
    .getByRole("button", { name: "Ask for volunteer help", exact: true })
    .click();
  await expect(
    page.getByText("A volunteer can help you check replies", { exact: true }),
  ).toBeVisible();
  const session = await page.evaluate(async () =>
    (await fetch("/api/session")).json(),
  );
  expect(session.sharedDevice).toBe(true);
});

test("another tab can sign in after cross-tab logout without reloading or exposing private state", async ({
  page,
  context,
}) => {
  await start(page);
  await login(page, "Sam");
  const credentials = await page.evaluate(
    async () => (await (await fetch("/api/demo/guide")).json()).residents.sam,
  );
  const second = await context.newPage();
  await second.goto("/inbox");
  await expect(
    second.getByRole("heading", { name: "Hello, Sam Chen." }),
  ).toBeVisible();
  let releaseLogout!: () => void;
  let logoutReleased = false;
  let prematureRefreshes = 0;
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  await page.route("**/api/auth/logout", async (route) => {
    await logoutGate;
    await route.continue();
  });
  second.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/session" && !logoutReleased)
      prematureRefreshes++;
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  try {
    await expect(second.getByLabel("Six-digit PIN")).toBeVisible();
    expect(prematureRefreshes).toBe(0);
  } finally {
    logoutReleased = true;
    releaseLogout();
  }
  await expect(page.getByLabel("Six-digit PIN")).toBeVisible();
  await expect(second.getByLabel("Six-digit PIN")).toBeVisible();
  await expect(
    second.getByRole("heading", { name: "Hello, Sam Chen." }),
  ).toHaveCount(0);
  await second.getByLabel("Account code").fill(credentials.code);
  await second.getByLabel("Six-digit PIN").fill(credentials.pin);
  await second.getByLabel("Yes, this device is shared").check();
  await second.getByLabel("I’ll check PING myself").check();
  await second.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    second.getByRole("heading", { name: "Hello, Sam Chen." }),
  ).toBeVisible();
});
