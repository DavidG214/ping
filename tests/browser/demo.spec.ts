import { test, expect, type Page } from "@playwright/test";
async function start(page: Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a fictional role" }),
  ).toBeVisible();
}
async function login(page: Page, name: string) {
  await page.goto("/demo");
  await page
    .getByRole("link", { name: "Sign in as " + name, exact: false })
    .click();
  await page.getByLabel("Yes, this device is shared").check();
  await page.getByLabel("I’ll check PING myself").check();
  await page.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp("Hello, " + name) }),
  ).toBeVisible();
}
test("reviewer completes reply without location, then separately consents to location", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Staff B", exact: true }).click();
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Looking for Jordan Rivera" }),
  });
  await card
    .getByLabel("Compare a local candidate")
    .selectOption({ label: "Jordan Rivera · 30–44" });
  await card.getByRole("button", { name: "Route possible match" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Request is now available" }),
  ).toBeVisible();
  await login(page, "Jordan");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply", { exact: true }).fill("I'm safe");
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await expect(
    page.getByText("No shelter will be shared.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await expect(page.getByText("Reply sent", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/resident-reply.png",
    fullPage: true,
  });
  await login(page, "Alex");
  await page.getByRole("button", { name: "Requests I’ve made" }).click();
  await expect(page.getByText("I'm safe", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No shelter was shared with this reply."),
  ).toBeVisible();
  await expect(page.getByText("Lantern Center", { exact: true })).toHaveCount(
    0,
  );
  await login(page, "Jordan");
  await page
    .getByRole("button", { name: "Share a shelter (optional)" })
    .click();
  await page.getByLabel("Shelter to share").selectOption("B");
  await page.getByLabel("I am currently at this shelter").check();
  await page
    .getByRole("button", { name: "Preview shelter disclosure" })
    .click();
  await expect(page.getByText("Lantern Center", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Share this shelter", exact: true })
    .click();
  await expect(page.getByText("Shared shelter: Lantern Center")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goBack();
  await expect(page.getByText("Shared shelter: Lantern Center")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Hello, Jordan Rivera." }),
  ).toHaveCount(0);
});
test("mobile home and failed map keep an accessible directory", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stay in touch with PING" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/directory");
  await expect(
    page.getByRole("button", { name: /Cypress Hall/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Lantern Center/ }).click();
  await expect(
    page.getByText("Map tiles could not load.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/directory-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("shared-device idle expiry clears the private screen and credentials", async ({
  page,
}) => {
  await start(page);
  await login(page, "Sam");
  await page.clock.install();
  await page.clock.fastForward(125000);
  await expect(
    page.getByRole("heading", { name: "Check my pings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sam Rivera", { exact: false })).toHaveCount(0);
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");
});
test("registration preserves a leading-zero PIN and prints only the code", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Staff A", exact: true }).click();
  await page.getByRole("button", { name: "Register resident" }).click();
  await page.getByLabel("Name or nickname").fill("Morgan Demo");
  await page.getByLabel("Approximate age range").selectOption("18_29");
  await page.getByLabel("Resident-chosen six-digit PIN").fill("001234");
  await page.getByLabel("Confirm PIN").fill("001234");
  await page
    .getByRole("button", { name: "Register and create account card" })
    .click();
  await expect(page.locator(".account-card")).toContainText("Morgan Demo");
  await expect(page.locator(".account-card")).not.toContainText("001234");
  const code = await page.locator(".account-card .account-code").innerText();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Account code").fill(code);
  await page.getByLabel("Six-digit PIN").fill("001234");
  await page.getByLabel("No, this is my personal device").check();
  await page.getByLabel("I need volunteer help").check();
  await page.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Morgan Demo." }),
  ).toBeVisible();
  await expect(
    page.getByText("A volunteer can help you check replies"),
  ).toBeVisible();
});
test("a lost reply response says status unknown and retry sends only once", async ({
  page,
}) => {
  await start(page);
  await login(page, "Sam");
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("This is a fictional reply.");
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await page.route(
    "**/api/deliveries/*/reply",
    async (route) => {
      await route.fetch();
      await route.abort();
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Send status unknown");
  await expect(page.getByText("Reply sent", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await expect(page.getByText("Reply sent", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("This is a fictional reply.", { exact: true }),
  ).toHaveCount(1);
});
test("offline logout clears private content and reconnect requires login", async ({
  page,
  context,
}) => {
  await start(page);
  await login(page, "Sam");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sam Chen." }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");
  await context.setOffline(false);
  await page.goto("/inbox");
  await expect(
    page.getByRole("heading", { name: "Check my pings", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("a successful registration can recover its account card after the card fetch fails", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Staff A", exact: true }).click();
  await page.getByRole("button", { name: "Register resident" }).click();
  await page.getByLabel("Name or nickname").fill("Card Retry Demo");
  await page.getByLabel("Approximate age range").selectOption("18_29");
  await page.getByLabel("Resident-chosen six-digit PIN").fill("001234");
  await page.getByLabel("Confirm PIN").fill("001234");
  await page.route("**/api/staff/residents/*/card", (route) => route.abort(), {
    times: 1,
  });
  await page
    .getByRole("button", { name: "Register and create account card" })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Local cases" }).click();
  await page.getByRole("button", { name: /Card Retry Demo/ }).click();
  await page
    .getByRole("button", { name: "Show account card", exact: true })
    .click();
  await expect(page.locator(".account-card")).toContainText("Card Retry Demo");
  await expect(
    page.getByRole("button", { name: /Card Retry Demo/ }),
  ).toHaveCount(1);
});
