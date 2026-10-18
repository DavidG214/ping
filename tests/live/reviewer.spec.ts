import { test, expect, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the demo", exact: true }).click();
  await page.getByRole("button", { name: "Start my demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a fictional role" }),
  ).toBeVisible();
}

async function login(page: Page, name: string) {
  await page.goto("/demo");
  await page.getByRole("link", { name: "Sign in as " + name }).click();
  for (const label of [
    "Yes, this device is shared",
    "No, this is my personal device",
    "I’ll check PING myself",
    "I need volunteer help",
  ]) {
    await expect(page.getByLabel(label)).not.toBeChecked();
  }
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("001234");
  await page.getByLabel("Yes, this device is shared").check();
  await page.getByLabel("I’ll check PING myself").check();
  await page.getByRole("button", { name: "Open my pings" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp("Hello, " + name) }),
  ).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Check my pings", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Account code")).toHaveValue("");
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");
}

test("README walkthrough: route, exact reply, separate shelter, sign out", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  await expect(page.getByLabel("Your reply", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply", { exact: true }).fill("I'm safe");
  await expect(
    page.getByLabel("Also share a shelter with this requester"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Preview my reply" }).click();
  await expect(
    page.locator(".preview").getByText("I'm safe", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No shelter will be shared.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Send this reply", exact: true })
    .click();
  await expect(page.getByText("Reply sent", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done—sign out" }).click();
  // An empty field also exists behind the pending sign-out curtain. Wait for
  // the visible login screen before a full navigation can interrupt logout.
  await expect(
    page.getByRole("heading", { name: "Check my pings", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Six-digit PIN")).toHaveValue("");

  await login(page, "Alex");
  await page.getByRole("button", { name: "Requests I’ve made" }).click();
  await expect(page.getByText("I'm safe", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No shelter was shared with this reply."),
  ).toBeVisible();
  await expect(page.getByText("Lantern Center", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: testInfo.outputPath("reply-without-shelter.png"),
    fullPage: true,
  });

  await login(page, "Jordan");
  await page
    .getByRole("button", { name: "Share a shelter (optional)" })
    .click();
  await page
    .getByLabel("Shelter to share")
    .selectOption({ label: "Lantern Center" });
  await expect(
    page.getByRole("button", { name: "Preview shelter disclosure" }),
  ).toBeDisabled();
  await page.getByLabel("I am currently at this shelter").check();
  await page
    .getByRole("button", { name: "Preview shelter disclosure" })
    .click();
  await expect(
    page.locator(".preview").getByText("Lantern Center", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Share this shelter", exact: true })
    .click();
  await expect(page.getByText("Shared shelter: Lantern Center")).toBeVisible();

  await login(page, "Alex");
  await page.getByRole("button", { name: "Requests I’ve made" }).click();
  await expect(
    page.getByText("Shared by the sender: Lantern Center"),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Requests I’ve made" }).click();
  await expect(page.getByText("I'm safe", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Shared by the sender: Lantern Center"),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("separately-approved-shelter.png"),
    fullPage: true,
  });
  await signOut(page);
  await page.goBack();
  await expect(
    page.getByText("Shared by the sender: Lantern Center"),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Hello, Alex/ })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("private choices and a directory that works without map tiles", async ({
  page,
}, testInfo) => {
  await start(page);
  await login(page, "Alex");
  const beforeResponse = await page.request.get("/api/me/requests");
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json();

  for (const [name, decision] of [
    ["Sam", "This isn’t me"],
    ["Taylor", "Don’t respond"],
  ]) {
    await login(page, name);
    await page.getByRole("button", { name: decision, exact: true }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByRole("button", { name: decision, exact: true }),
    ).toHaveCount(0);
  }
  await login(page, "Alex");
  const afterResponse = await page.request.get("/api/me/requests");
  expect(afterResponse.status()).toBe(200);
  expect(await afterResponse.json()).toEqual(before);
  await signOut(page);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/directory");
  for (const name of [/Cypress Hall/, /Lantern Center/, /Meadow Commons/]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await page.getByRole("button", { name: /Lantern Center/ }).click();
  await expect(
    page.getByText("Map tiles could not load.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("directory-without-map.png"),
    fullPage: true,
  });
});
