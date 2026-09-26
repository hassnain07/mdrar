import type { Property } from '@/types';
import type { PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { simulate } from './latency';
import { genId } from '@/lib/helpers';

export const propertiesMock = {
  async list(params?: PaginationParams): Promise<PaginatedResult<Property>> {
    await simulate();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? db.properties.length;
    const start = (page - 1) * pageSize;
    return { data: db.properties.slice(start, start + pageSize), total: db.properties.length };
  },

  async get(id: string): Promise<Property> {
    await simulate();
    const p = db.properties.find((x) => x.id === id);
    if (!p) throw { code: 'NOT_FOUND', message: `Property ${id} not found` };
    return p;
  },

  async create(input: Omit<Property, 'id' | 'openRequests' | 'emergency'>): Promise<Property> {
    await simulate();
    const property: Property = { ...input, id: genId('prop'), openRequests: 0, emergency: 0 };
    db.properties.push(property);
    persist.properties();
    return property;
  },
};
