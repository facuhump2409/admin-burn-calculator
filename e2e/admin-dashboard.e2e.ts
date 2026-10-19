import { expect, test, type Page } from '@playwright/test';
import type { DashboardData } from '../src/utils/dashboardApi';

const APP_ORIGIN = 'http://127.0.0.1:4176';

const dashboardData: DashboardData = {
  updatedAt: '2026-10-18T18:00:00Z',
  totalAvailable: 0, totalFiltered: 0, page: 1, pageSize: 12, totalPages: 1,
  summary: {
    totalCases: 0, averageAge: 0, averageBurnPercentage: 0, maxBurnPercentage: 0,
    airwayCount: 0, airwayRate: 0, highSeverityCount: 0, highSeverityRate: 0,
    formulaCounts: { parkland: 0, galveston: 0 },
    careSetting: { internacionCount: 0, ambulatorioCount: 0, ambulatorioRate: 0 },
    confirmation: {
      confirmedCount: 0, confirmationRate: 0, avgDeltaTotal: 0,
      meanAbsoluteDeviation: 0, byHospital: [],
    },
  },
  filterOptions: { causalAgents: [], genders: [] },
  breakdowns: {
    gender: [], ageGroups: [], location: [], accidentPlace: [], servicio: [], hospital: [],
    causalAgent: [], careSetting: [], medicationBrand: [], airwayByAgent: [], severity: [],
    formula: [], burnBuckets: [], fluidAveragesBySeverity: [],
  },
  confirmedRows: [], rows: [],
};

async function mockBackend(page: Page) {
  const state = {
    adminAuthenticated: false,
    nextDashboardStatus: 200,
    dashboardRequests: 0,
  };

  await page.clock.install({ time: new Date('2026-10-18T15:00:00-03:00') });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== APP_ORIGIN) {
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    const respond = (status: number, body: unknown = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      body: status === 204 ? undefined : JSON.stringify(body),
    });
    if (url.pathname === '/api/admin-session-status') {
      await respond(state.adminAuthenticated ? 204 : 401);
    } else if (url.pathname === '/api/admin-login') {
      state.adminAuthenticated = true;
      await respond(200, { ok: true });
    } else if (url.pathname === '/api/admin-logout') {
      state.adminAuthenticated = false;
      await respond(204);
    } else if (url.pathname === '/api/dashboard') {
      state.dashboardRequests += 1;
      const status = state.adminAuthenticated ? state.nextDashboardStatus : 401;
      if (status === 401) {
        await route.fulfill({ status: 401, contentType: 'text/plain', body: 'Unauthorized' });
      } else {
        await respond(status, status === 200 ? dashboardData : { error: 'server_error' });
      }
    } else {
      throw new Error(`Unexpected API request in E2E: ${request.method()} ${url.pathname}`);
    }
  });
  return state;
}

test('the root path shows the admin login and uses same-origin API calls', async ({ page }) => {
  await mockBackend(page);
  const statusRequest = page.waitForRequest('**/api/admin-session-status');
  await page.goto('/');
  expect(new URL((await statusRequest).url()).origin).toBe(APP_ORIGIN);
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
});

test('login, link back to the calculator, and logout', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Contraseña admin' }).fill('test-admin-password');
  await page.getByRole('button', { name: 'Entrar al dashboard' }).click();
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calculadora' })).toHaveAttribute('href', 'https://www.regladecuadrantes.com/');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
});

test('admin session expiry on tab return clears the dashboard and returns to its login', async ({ page }) => {
  const backend = await mockBackend(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Contraseña admin' }).fill('test-admin-password');
  await page.getByRole('button', { name: 'Entrar al dashboard' }).click();
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toBeVisible();
  backend.adminAuthenticated = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toHaveCount(0);
});

test('an admin dashboard 401 without a JSON body still returns to login', async ({ page }) => {
  const backend = await mockBackend(page);
  backend.adminAuthenticated = true;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toBeVisible();
  backend.nextDashboardStatus = 401;
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toHaveCount(0);
});

test('the periodic admin session check returns to admin login', async ({ page }) => {
  const backend = await mockBackend(page);
  backend.adminAuthenticated = true;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toBeVisible();
  backend.adminAuthenticated = false;
  await page.clock.fastForward(60000);
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
});

test('a late dashboard response cannot restore an expired admin session', async ({ page }) => {
  const backend = await mockBackend(page);
  backend.adminAuthenticated = true;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toBeVisible();
  let releaseResponse: (() => void) | undefined;
  await page.route('**/api/dashboard*', async (route) => {
    await new Promise<void>((resolve) => { releaseResponse = resolve; });
    await route.fulfill({ json: dashboardData });
  });
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect.poll(() => !!releaseResponse).toBe(true);
  backend.adminAuthenticated = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
  const finished = page.waitForResponse('**/api/dashboard*');
  if (!releaseResponse) throw new Error('Dashboard refresh did not start');
  releaseResponse();
  await (await finished).finished();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /BurnMetrics Admin/ })).toHaveCount(0);
});
