import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DashboardApiError,
  fetchAdminSessionStatus,
  fetchDashboardData,
  loginAdmin,
  logoutAdmin,
} from './dashboardApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dashboard admin API helpers', () => {
  it('logs in to the same-origin admin endpoint by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginAdmin('secret')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin-login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      })
    );
  });

  it('reports admin session status from 204 and 401 responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAdminSessionStatus()).resolves.toBe(true);
    await expect(fetchAdminSessionStatus()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin-session-status',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('preserves HTTP 401 even when the dashboard error is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })));
    const result = fetchDashboardData();
    await expect(result).rejects.toBeInstanceOf(DashboardApiError);
    await expect(result).rejects.toMatchObject({ status: 401 });
  });

  it('does not treat unexpected session responses as an expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await expect(fetchAdminSessionStatus()).rejects.toMatchObject({ status: 200 });
  });

  it('fetches dashboard data with filters encoded as query params', async () => {
    const data = {
      updatedAt: '2026-01-01T00:00:00.000Z',
      totalAvailable: 1,
      totalFiltered: 1,
      page: 2,
      pageSize: 12,
      totalPages: 2,
      summary: {
        totalCases: 1,
        averageAge: 4,
        averageBurnPercentage: 12,
        maxBurnPercentage: 12,
        airwayCount: 0,
        airwayRate: 0,
        highSeverityCount: 0,
        highSeverityRate: 0,
        formulaCounts: { parkland: 0, galveston: 1 },
      },
      filterOptions: { causalAgents: ['Fuego'], genders: ['Femenino'] },
      breakdowns: {
        gender: [],
        ageGroups: [],
        location: [],
        accidentPlace: [],
        servicio: [],
        hospital: [],
        causalAgent: [],
        careSetting: [],
        medicationBrand: [],
        airwayByAgent: [],
        severity: [],
        formula: [],
        burnBuckets: [],
        fluidAveragesBySeverity: [],
      },
      rows: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDashboardData({ gender: 'Femenino', formula: 'galveston', page: 2 })
    ).resolves.toEqual(data);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard?gender=Femenino&formula=galveston&page=2',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
  });

  it('logs out using the admin logout endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(logoutAdmin()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin-logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('throws API-specific errors when login fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(loginAdmin('bad')).rejects.toThrow('admin_login_failed_invalid_password');
  });
});
