import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

test.beforeEach(async () => {
  if (new URL(process.env.TEST_DATABASE_URL!).pathname !== "/ping_test")
    throw new Error("Dedicated test database required");
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  // Each browser scenario is an independent simulated network, not a demo-start abuse test.
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
async function login(page: Page, who = "Sam") {
  await page.goto("/demo");
  await page.getByRole("link", { name: "Sign in as " + who }).click();
  await expect(page.getByLabel("Yes, this device is shared")).not.toBeChecked();
  await expect(page.getByLabel("I’ll check PING myself")).not.toBeChecked();
  await page.getByLabel("Yes, this device is shared").check();
  await page.getByLabel("I’ll check PING myself").check();
  await page.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp("Hello, " + who) }),
  ).toBeVisible();
}
test("home actions fit tablet landscape and portrait with large targets", async ({
  page,
}) => {
  for (const [width, height] of [
    [1024, 768],
    [768, 1024],
    [320, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    for (const name of [
      "Check my pings",
      "Request help finding someone",
      "Find a help desk",
    ]) {
      const action = page
        .locator("main")
        .getByRole("link", { name, exact: true });
      await expect(action).toBeInViewport();
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1024)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/home-${width}.png`,
      fullPage: true,
    });
  }
});
test("reply drafts survive refresh, section changes and session revalidation, but clear on handoff", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("Private draft for Sam");
  await page.getByRole("button", { name: "Refresh pings" }).click();
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveValue(
    "Private draft for Sam",
  );
  await page.getByRole("button", { name: /Requests I’ve made/ }).click();
  await page.getByRole("button", { name: /Messages for me/ }).click();
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveValue(
    "Private draft for Sam",
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveValue(
    "Private draft for Sam",
  );
  expect(
    await page.evaluate(() => JSON.stringify([localStorage, sessionStorage])),
  ).not.toContain("Private draft");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Six-digit PIN")).toBeVisible();
  await login(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("Clear this on expiry");
  await page.clock.install();
  await page.clock.fastForward(125000);
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveCount(0);
});
test("failed inbox load stops loading, retries, and failed refresh retains draft", async ({
  page,
}) => {
  await start(page);
  await page.route("**/api/me/inbox", (r) => r.abort(), { times: 1 });
  await login(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply", { exact: true }).fill("Keep this draft");
  await page.route("**/api/me/inbox", (r) => r.abort(), { times: 1 });
  await page.getByRole("button", { name: "Refresh pings" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("preview and edit transfer keyboard focus, then sending offers a clear exit", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const input = page.getByLabel("Your reply", { exact: true });
  await expect(input).toBeFocused();
  await input.fill("I'm safe");
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your reply" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reply sent", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Shelter to share")).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/resident-confirmation.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Done—sign out" }).click();
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");
});
for (const [who, action] of [
  ["Sam", "This isn’t me"],
  ["Taylor", "Don’t respond"],
]) {
  test(`${action} confirms privately and leaves requester status unchanged`, async ({
    page,
  }) => {
    await start(page);
    await login(page, "Alex");
    const before = await page.evaluate(async () =>
      (await fetch("/api/me/requests")).json(),
    );
    await login(page, who);
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirm", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Ping closed" }),
    ).toBeVisible();
    await login(page, "Alex");
    expect(
      await page.evaluate(async () => (await fetch("/api/me/requests")).json()),
    ).toEqual(before);
  });
}
test("staff task navigation wraps at 320px and preserves registration and case drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await start(page);
  await page.getByRole("button", { name: "Staff A", exact: true }).click();
  await page
    .getByRole("button", { name: "Register resident", exact: true })
    .click();
  await page.getByLabel("Name or nickname").fill("Draft resident");
  await page.getByRole("button", { name: "Local cases", exact: true }).click();
  await page.getByRole("button", { name: /Alex Rivera/ }).click();
  await expect(page.getByLabel("Who are they looking for?")).not.toBeVisible();
  await page.getByText("New contact request", { exact: true }).click();
  await page.getByLabel("Who are they looking for?").fill("Draft person");
  await page
    .getByRole("button", { name: "Register resident", exact: true })
    .click();
  await expect(page.getByLabel("Name or nickname")).toHaveValue(
    "Draft resident",
  );
  await page.getByRole("button", { name: "Local cases", exact: true }).click();
  await page.getByRole("button", { name: "Refresh workspace" }).click();
  await expect(page.getByLabel("Who are they looking for?")).toHaveValue(
    "Draft person",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/staff-320.png",
    fullPage: true,
  });
});
test("inactivity warning supports keyboard retry when renewal fails", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.clock.install();
  await page.clock.fastForward(92000);
  const dialog = page.getByRole("alertdialog", { name: "Session ending" });
  const keep = dialog.getByRole("button", { name: "Keep me signed in" });
  await expect(keep).toBeFocused();
  await page.route("**/api/session/activity", (r) => r.abort(), { times: 1 });
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("Could not extend");
  // Renewal uses server wall time; return the simulated browser clock to it.
  await page.clock.setSystemTime(Date.now());
  await keep.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
});
test("directory list comes before map and retries a failed directory fetch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/shelters", (r) => r.abort(), { times: 1 });
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/directory");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const list = page.locator(".shelter-list"),
    map = page.locator(".map");
  await expect(list).toBeVisible();
  expect((await list.boundingBox())!.y).toBeLessThan(
    (await map.boundingBox())!.y,
  );
});

test("each repeated resident login asks independent unselected device and assistance choices", async ({
  page,
}) => {
  await start(page);
  for (const [device, assistance] of [
    [true, true],
    [false, false],
    [true, false],
    [false, true],
  ]) {
    await page.goto("/demo");
    await page.getByRole("link", { name: "Sign in as Sam" }).click();
    for (const choice of [
      "Yes, this device is shared",
      "No, this is my personal device",
      "I’ll check PING myself",
      "I need volunteer help",
    ])
      await expect(page.getByLabel(choice)).not.toBeChecked();
    await page
      .getByLabel(
        device
          ? "Yes, this device is shared"
          : "No, this is my personal device",
      )
      .check();
    await page
      .getByLabel(
        assistance ? "I need volunteer help" : "I’ll check PING myself",
      )
      .check();
    await page.getByRole("button", { name: "Open my pings" }).click();
    await expect(
      page.getByRole("heading", { name: "Hello, Sam Chen." }),
    ).toBeVisible();
    const actual = await page.evaluate(async () => ({
      session: await (await fetch("/api/session")).json(),
      me: await (await fetch("/api/me")).json(),
    }));
    expect(actual.session.sharedDevice).toBe(device);
    expect(actual.me.assistance).toBe(assistance);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");
  }
});

test("canceling a private decision restores focus and shelter editing receives focus", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page
    .getByRole("button", { name: "Don’t respond", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reply", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply", { exact: true }).fill("I'm safe");
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Share a shelter (optional)" })
    .click();
  await expect(page.getByLabel("Shelter to share")).toBeFocused();
  await page.getByLabel("Shelter to share").selectOption("B");
  await page.getByLabel("I am currently at this shelter").check();
  await page
    .getByRole("button", { name: "Preview shelter disclosure" })
    .click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Shelter to share")).toBeFocused();
});

test("refresh updates retained case preferences without clearing its request draft", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Staff A", exact: true }).click();
  await page.getByRole("button", { name: "Local cases", exact: true }).click();
  await page.getByRole("button", { name: /Alex Rivera/ }).click();
  await page.getByText("New contact request", { exact: true }).click();
  await page.getByLabel("Who are they looking for?").fill("Retained draft");
  const id = await page.evaluate(
    async () =>
      (await (await fetch("/api/staff/residents")).json()).find(
        (r: { name: string }) => r.name === "Alex Rivera",
      ).id,
  );
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await pool.query("UPDATE residents SET assistance=true WHERE id=$1", [id]);
  await pool.end();
  await page.getByRole("button", { name: "Refresh workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Stop volunteer assistance" }),
  ).toBeVisible();
  await expect(page.getByLabel("Who are they looking for?")).toHaveValue(
    "Retained draft",
  );
});

test("sign-out clears private content immediately and waits for server acknowledgement before handoff", async ({
  page,
}) => {
  await start(page);
  await login(page);
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/logout", async (route) => {
    await wait;
    await route.continue();
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sam Chen." }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Signing out…" }),
  ).toBeVisible();
  await expect(page.getByLabel("Six-digit PIN")).not.toBeVisible();
  release();
  await expect(page.getByLabel("Six-digit PIN")).toBeVisible();
});

for (const [width, height] of [
  [1024, 768],
  [768, 1024],
]) {
  test(`resident reply and staff workspace fit tablet ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await start(page);
    await login(page);
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page.getByLabel("Your reply", { exact: true }).fill("I'm safe");
    await expect(
      page.getByLabel("Also share a shelter with this requester"),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Preview my reply" }).click();
    await expect(
      page.getByRole("heading", { name: "Review your reply" }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/resident-${width}.png`,
      fullPage: true,
    });
    await page.goto("/demo");
    await page.getByRole("button", { name: "Staff B", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Staff tasks" });
    await expect(nav.getByRole("button")).toHaveCount(4);
    for (const button of await nav.getByRole("button").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/staff-${width}.png`,
      fullPage: true,
    });
  });
}
