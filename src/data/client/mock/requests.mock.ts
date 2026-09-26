import type { Request, RequestStatus, TimelineEvent } from '@/types';
import type { CreateRequestInput, PaginatedResult, PaginationParams } from '@/data/client/dataSource';
import { db, persist } from './db';
import { simulate } from './latency';
import { notificationsMock } from './notifications.mock';

let counter = db.requests.length + 1048;

function genId() { return `REQ-${counter++}`; }

export const requestsMock = {
  async list(
    filters?: { propertyId?: string; status?: RequestStatus; tenantId?: string; technicianId?: string },
    params?: PaginationParams,
  ): Promise<PaginatedResult<Request>> {
    await simulate();
    let data = [...db.requests];
    if (filters?.propertyId) data = data.filter((r) => r.propertyId === filters.propertyId);
    if (filters?.status) data = data.filter((r) => r.status === filters.status);
    if (filters?.tenantId) data = data.filter((r) => r.tenantEmail === filters.tenantId);
    if (filters?.technicianId) data = data.filter((r) => r.technicianId === filters.technicianId);
    const total = data.length;
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? total;
    return { data: data.slice((page - 1) * pageSize, page * pageSize), total };
  },

  async get(id: string): Promise<Request> {
    await simulate();
    const r = db.requests.find((x) => x.id === id);
    if (!r) throw { code: 'NOT_FOUND', message: `Request ${id} not found` };
    return r;
  },

  async create(input: CreateRequestInput): Promise<Request> {
    await simulate();
    const req: Request = { ...input, id: genId(), timeline: [] };
    db.requests.unshift(req);
    persist.requests();
    // Notify management of new request
    const isEmergency = req.type === 'emergency';
    void notificationsMock.push({
      title: isEmergency ? '🚨 طلب طارئ جديد' : 'طلب جديد',
      body: `${req.id} — ${req.description.slice(0, 60)}`,
      emergency: isEmergency,
    });
    return req;
  },

  async update(id: string, changes: Partial<Request>): Promise<Request> {
    await simulate();
    const idx = db.requests.findIndex((r) => r.id === id);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Request ${id} not found` };
    const prev = db.requests[idx];
    db.requests[idx] = { ...prev, ...changes };
    persist.requests();
    // Notify when technician is assigned
    if (changes.technicianId && changes.technicianId !== prev.technicianId) {
      const tech = db.technicians.find((t) => t.id === changes.technicianId);
      void notificationsMock.push({
        title: 'تم تعيين فني',
        body: `${id} — تم تعيين ${tech?.name ?? changes.technicianId}`,
      });
    }
    return db.requests[idx];
  },

  async addTimelineEvent(id: string, event: Omit<TimelineEvent, 'id'>): Promise<Request> {
    await simulate();
    const idx = db.requests.findIndex((r) => r.id === id);
    if (idx === -1) throw { code: 'NOT_FOUND', message: `Request ${id} not found` };
    const newEvent: TimelineEvent = { ...event, id: `te-${Date.now()}` };
    db.requests[idx] = { ...db.requests[idx], timeline: [...db.requests[idx].timeline, newEvent] };
    persist.requests();
    const req = db.requests[idx];
    // Always notify management
    void notificationsMock.push({
      title: `تحديث الطلب ${id}`,
      body: event.label,
      emergency: req.type === 'emergency',
    });
    // Notify the tenant when management/technician updates their request
    if (req.tenantEmail) {
      void notificationsMock.pushForTenant(req.tenantEmail, {
        title: `تحديث طلبك ${id}`,
        body: event.label,
        emergency: req.type === 'emergency',
      });
    }
    return req;
  },
};
