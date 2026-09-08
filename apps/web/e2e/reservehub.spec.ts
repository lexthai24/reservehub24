import { expect, test } from "@playwright/test";

test("member can explore a resource and open the booking flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Good morning, Narin")).toBeVisible();
  await page.getByRole("button", { name: "Explore" }).first().click();
  await expect(page.getByRole("heading", { name: "Explore resources" })).toBeVisible();
  await page.getByRole("button", { name: "View availability" }).first().click();
  await expect(page.getByText(/Book .+/)).toBeVisible();
});
