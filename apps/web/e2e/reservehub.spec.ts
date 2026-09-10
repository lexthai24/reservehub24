import { expect, test } from "@playwright/test";

test("member can explore a resource and open the booking flow", async ({ page }) => {
  const user = { id: "user-1", email: "narin@example.com", fullName: "Narin Lim", role: "MEMBER" };
  const resource = { id: "resource-1", name: "Atlas Boardroom", description: "A boardroom", resourceType: "MEETING_ROOM", location: "Bangkok HQ", capacity: 12, timezone: "Asia/Bangkok", status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "UNAUTHORIZED", message: "Authentication required" }) }));
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: user }) }));
  await page.route("**/api/resources**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [resource] }) }));
  await page.route("**/api/bookings/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
  await page.route("**/api/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
  await page.route("**/api/analytics/overview", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { totalBookings: 0, confirmedBookings: 0, activeResources: 1 } }) }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.locator('input[type="email"]').fill("narin@example.com");
  await page.locator('input[type="password"]').fill("Member123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.getByRole("button", { name: "Open account menu" }).last().click();
  await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  await page.getByRole("button", { name: "Spaces" }).click();
  await expect(page.getByRole("heading", { name: "Explore resources" })).toBeVisible();
  await page.getByRole("button", { name: "View availability" }).first().click();
  await expect(page.getByText(/Book .+/)).toBeVisible();
});
