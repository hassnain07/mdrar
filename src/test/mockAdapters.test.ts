import { describe, it, expect, beforeEach } from 'vitest';

// Reset localStorage before each test so tables reload from seed
beforeEach(() => {
  localStorage.clear();
});

describe('requests mock adapter', () => {
  it('creates and retrieves a request', async () => {
    // Dynamic import so localStorage is clear before module initialises db
    const { mockDataSource } = await import('@/data/client/mock/index');
    const input = {
      propertyId: 'jazly',
      unit: 'A-101',
      tenant: 'Test Tenant',
      tenantEmail: 'test@example.com',
      type: 'corrective' as const,
      category: 'plumbing' as const,
      description: 'Leaking pipe',
      status: 'submitted' as const,
      priority: 'normal' as const,
      date: '2024-01-01',
    };
    const created = await mockDataSource.requests.create(input);
    expect(created.id).toBeTruthy();
    expect(created.description).toBe('Leaking pipe');

    const fetched = await mockDataSource.requests.get(created.id);
    expect(fetched.id).toBe(created.id);
  });

  it('updates a request', async () => {
    const { mockDataSource } = await import('@/data/client/mock/index');
    const { data } = await mockDataSource.requests.list();
    const first = data[0];
    const updated = await mockDataSource.requests.update(first.id, { status: 'resolved' });
    expect(updated.status).toBe('resolved');
  });

  it('persists requests across re-instantiation', async () => {
    const { mockDataSource } = await import('@/data/client/mock/index');
    const created = await mockDataSource.requests.create({
      propertyId: 'jazly', unit: 'B-202', tenant: 'T', tenantEmail: 't@t.com',
      type: 'emergency' as const, category: 'electrical' as const,
      description: 'Power outage', status: 'submitted' as const,
      priority: 'critical' as const, date: '2024-06-01',
    });
    // Re-import (simulates reload — same localStorage)
    const { db } = await import('@/data/client/mock/db');
    const found = db.requests.find((r) => r.id === created.id);
    expect(found).toBeTruthy();
  });

  it('throws NOT_FOUND for missing request', async () => {
    const { mockDataSource } = await import('@/data/client/mock/index');
    await expect(mockDataSource.requests.get('nonexistent-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('projects mock adapter', () => {
  it('creates a project and seeds activities', async () => {
    const { mockDataSource } = await import('@/data/client/mock/index');
    const project = await mockDataSource.projects.create({
      name: 'مشروع اختبار', nameEn: 'Test Project',
      location: 'الرياض', locationEn: 'Riyadh',
      totalUnits: 10, startDate: '2024-01-01', endDate: '2025-01-01',
      totalDays: 365, contractor: 'مقاول', contractorEn: 'Contractor',
      budget: 1000000, status: 'on_track' as const,
    });
    expect(project.id).toBeTruthy();
    const activities = await mockDataSource.activities.list(project.id);
    expect(activities.data.length).toBeGreaterThan(0);
  });

  it('updates a project', async () => {
    const { mockDataSource } = await import('@/data/client/mock/index');
    const { data } = await mockDataSource.projects.list();
    const first = data[0];
    const updated = await mockDataSource.projects.update(first.id, { status: 'completed' });
    expect(updated.status).toBe('completed');
  });
});

describe('activities mock adapter', () => {
  it('creates, updates, and deletes an activity', async () => {
    const { mockDataSource } = await import('@/data/client/mock/index');
    const { data: projects } = await mockDataSource.projects.list();
    const projectId = projects[0].id;

    const activity = await mockDataSource.activities.create(projectId, {
      activityId: 'TEST-01', name: 'نشاط اختبار', nameEn: 'Test Activity',
      phase: 'construction' as const, startDay: 0, endDay: 10, duration: 10,
      percentComplete: 0, status: 'not_started' as const,
      team: 'فريق', teamEn: 'Team', description: '', descriptionEn: '',
      actualCost: 0, plannedCost: 5000,
    });
    expect(activity.nameEn).toBe('Test Activity');

    const updated = await mockDataSource.activities.update(projectId, activity.id, { percentComplete: 50 });
    expect(updated.percentComplete).toBe(50);

    await mockDataSource.activities.delete(projectId, activity.id);
    const { data } = await mockDataSource.activities.list(projectId);
    expect(data.find((a) => a.id === activity.id)).toBeUndefined();
  });
});
