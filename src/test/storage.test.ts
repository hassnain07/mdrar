import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

describe('storage mock adapter', () => {
  it('uploads a file and returns a blob URL', async () => {
    const { storageMock } = await import('@/data/client/mock/storage.mock');
    const file = new File(['hello'], 'test.png', { type: 'image/png' });
    const { url, path } = await storageMock.upload('activity-photos', 'proj1/test.png', file);
    expect(url).toMatch(/^blob:/);
    expect(path).toBe('proj1/test.png');
  });

  it('removes a file', async () => {
    const { storageMock } = await import('@/data/client/mock/storage.mock');
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    const { path } = await storageMock.upload('project-documents', 'proj1/doc.pdf', file);
    await expect(storageMock.remove('project-documents', path)).resolves.toBeUndefined();
  });
});
