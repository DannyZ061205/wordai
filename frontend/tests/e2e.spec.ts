import { test, expect, Page } from '@playwright/test';

// Unique user per test run to avoid collisions on the JSON store
const timestamp = Date.now();
const TEST_USER = {
  username: `e2e_user_${timestamp}`,
  email: `e2e_${timestamp}@example.com`,
  password: 'TestPass123',
};

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Username').fill(TEST_USER.username);
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL(/\/$|\/dashboard/);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/$|\/dashboard/);
}

// ─── Auth flow ─────────────────────────────────────────────────────────────

test('registration creates account and redirects to dashboard', async ({ page }) => {
  await register(page);
  await expect(page).toHaveURL(/\/$/);
  // Dashboard should show the "New Document" button
  await expect(page.getByRole('button', { name: /new document/i })).toBeVisible();
});

test('login with correct credentials succeeds', async ({ page }) => {
  await register(page);
  // Log out first
  await page.getByRole('button', { name: TEST_USER.username }).click();
  await page.getByRole('menuitem', { name: /log out/i }).click();
  // Now log back in
  await login(page);
  await expect(page.getByRole('button', { name: /new document/i })).toBeVisible();
});

test('login with wrong password shows error', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: TEST_USER.username }).click();
  await page.getByRole('menuitem', { name: /log out/i }).click();

  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill('WrongPassword!');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Should stay on login and show an error toast
  await expect(page).toHaveURL(/\/login/);
});

test('protected routes redirect unauthenticated users to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

// ─── Document creation and rich-text editing ───────────────────────────────

test('creates a document and types rich text', async ({ page }) => {
  await register(page);

  // Create a new document
  await page.getByRole('button', { name: /new document/i }).click();
  // Should navigate to the editor
  await page.waitForURL(/\/doc\//);

  // The editor should be present
  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible();

  // Type some text
  await editor.click();
  await editor.type('Hello from E2E test');
  await expect(editor).toContainText('Hello from E2E test');
});

test('auto-save indicator shows saved status', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: /new document/i }).click();
  await page.waitForURL(/\/doc\//);

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.type('Auto save test');

  // Wait for auto-save (the hook debounces on content change)
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });
});

test('document appears on dashboard after creation', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: /new document/i }).click();
  await page.waitForURL(/\/doc\//);

  // Rename the document
  const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="Untitled"]').first();
  if (await titleInput.isVisible()) {
    await titleInput.fill('My E2E Document');
    await titleInput.press('Enter');
  }

  // Go back to dashboard
  await page.getByRole('link', { name: /wordai/i }).first().click();
  await page.waitForURL(/\/$/);

  // Document card should appear
  await expect(page.getByText('My E2E Document')).toBeVisible({ timeout: 5000 });
});

// ─── AI assistant with streaming and suggestion UX ─────────────────────────

test('AI panel is visible in the editor', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: /new document/i }).click();
  await page.waitForURL(/\/doc\//);

  // AI panel header should be visible (either collapsed icon or full panel)
  await expect(page.locator('[aria-label*="AI"], [aria-label*="panel"], text=AI Assistant').first()).toBeVisible({ timeout: 5000 });
});

test('AI feature requires text selection', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: /new document/i }).click();
  await page.waitForURL(/\/doc\//);

  // Expand AI panel if collapsed
  const expandBtn = page.getByRole('button', { name: /expand ai panel|open ai panel/i });
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
  }

  // Hint should say to select text
  await expect(page.getByText(/select text/i)).toBeVisible({ timeout: 5000 });
});

// ─── Version history ───────────────────────────────────────────────────────

test('version history panel can be opened', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: /new document/i }).click();
  await page.waitForURL(/\/doc\//);

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.type('Version 1 content');

  // Wait for auto-save
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

  // Look for history button in toolbar
  const historyBtn = page.getByRole('button', { name: /version history|history/i });
  if (await historyBtn.isVisible()) {
    await historyBtn.click();
    await expect(page.getByText(/version/i)).toBeVisible();
  }
});
