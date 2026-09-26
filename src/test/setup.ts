import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom doesn't implement URL.createObjectURL — mock it
global.URL.createObjectURL = vi.fn((file: Blob) => `blob:mock/${(file as File).name ?? 'file'}`);
global.URL.revokeObjectURL = vi.fn();
