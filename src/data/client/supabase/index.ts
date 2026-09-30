import type { DataSource, Session } from '@/data/client/dataSource';
import { supabase } from './client';
import * as M from './mappers';

function guessFileType(fileName: string): 'image' | 'pdf' | 'video' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  return 'other';
}

// Takes the supabase Session object already in hand — never calls supabase.auth.* again.
// This is the fix for the GoTrue internal mutex deadlock: calling supabase.auth.getSession()
// from inside an onAuthStateChange callback acquires the same lock that is already held,
// causing the promise to hang forever.
async function buildSessionFromAuthSession(
  authSession: import('@supabase/supabase-js').Session
): Promise<Session | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, role, tenant_property_id, tenant_unit')
      .eq('id', authSession.user.id)
      .single();
    if (error || !profile) return null;

    const roleMap: Record<string, Session['role']> = {
      tenant: 'tenant', pm_manager: 'pm_manager', pm_viewer: 'pm_viewer', technician: 'technician',
      project_manager: 'pm_manager',
    };
    const role: Session['role'] = roleMap[profile.role] ?? 'management';

    let technicianId: string | undefined;
    if (profile.role === 'technician') {
      const { data: tech } = await supabase.from('technicians').select('id').eq('profile_id', authSession.user.id).single();
      technicianId = tech?.id;
    }

    return {
      userId: authSession.user.id,
      email: authSession.user.email ?? '',
      role,
      managementRole: (role === 'management' || role === 'technician') ? profile.role : undefined,
      name: profile.full_name,
      tenantPropertyId: profile.tenant_property_id ?? undefined,
      tenantUnit: profile.tenant_unit ?? undefined,
      technicianId,
      expiresAt: new Date((authSession.expires_at ?? 0) * 1000).getTime(),
    };
  } catch {
    return null;
  }
}

export const supabaseDataSource: DataSource = {
  auth: {
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return null;
      return buildSessionFromAuthSession(data.session);
    },
    async signInWithPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw { code: 'UNAUTHORIZED', message: error?.message ?? 'Sign in failed' };
      const session = await buildSessionFromAuthSession(data.session);
      if (!session) throw { code: 'UNAUTHORIZED', message: 'No profile found for this account' };
      return session;
    },
    async signOut() { await supabase.auth.signOut(); },
    onAuthStateChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) { cb(null); return; }
        setTimeout(() => {
          buildSessionFromAuthSession(session).then(cb).catch(() => cb(null));
        }, 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async updatePassword(newPassword: string) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw { code: 'VALIDATION', message: error.message };
    },
  },

  properties: {
    async list(params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('properties_with_stats').select('*', { count: 'exact' }).order('name_en');
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return { data: (data ?? []).map(M.mapProperty), total: count ?? 0 };
    },
    async get(id) {
      const { data, error } = await supabase.from('properties_with_stats').select('*').eq('id', id).single();
      M.throwIfError(error);
      return M.mapProperty(data);
    },
    async create(input) {
      const { data, error } = await supabase.from('properties').insert({
        name: input.name, name_en: input.nameEn, location: input.location,
        units: input.units, occupied: input.occupied, accent: input.accent, unit_labels: input.unitLabels ?? [],
      }).select().single();
      M.throwIfError(error);
      return M.mapProperty({ ...data, open_requests: 0, emergency: 0 });
    },
  },

  requests: {
    async list(filters, params) {
      let q = supabase.from('requests').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (filters?.propertyId) q = q.eq('property_id', filters.propertyId);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.tenantId) q = q.eq('tenant_id', filters.tenantId);
      if (filters?.technicianId) q = q.eq('technician_id', filters.technicianId);
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return { data: (data ?? []).map((r) => M.mapRequest(r)), total: count ?? 0 };
    },
    async get(id) {
      const { data: r, error } = await supabase.from('requests').select('*').eq('id', id).single();
      M.throwIfError(error);
      const { data: tl } = await supabase.from('request_timeline_events').select('*').eq('request_id', id).order('created_at');
      return M.mapRequest(r, (tl ?? []).map(M.mapTimelineEvent));
    },
    async create(input) {
      const { data: idRow, error: idErr } = await supabase.rpc('next_request_id');
      M.throwIfError(idErr);
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('requests').insert({
        id: idRow as string,
        property_id: input.propertyId, unit: input.unit,
        tenant_id: sd.session?.user.id ?? null,
        tenant_name: input.tenant, tenant_email: input.tenantEmail,
        type: input.type, category: input.category, description: input.description,
        status: input.status ?? 'submitted', priority: input.priority ?? 'normal',
        photo_url: input.photo ?? null, technician_id: input.technicianId ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapRequest(data, []);
    },
    async update(id, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.priority !== undefined) patch.priority = changes.priority;
      if (changes.technicianId !== undefined) patch.technician_id = changes.technicianId;
      if (changes.description !== undefined) patch.description = changes.description;
      if (changes.photo !== undefined) patch.photo_url = changes.photo;
      const { data, error } = await supabase.from('requests').update(patch).eq('id', id).select().single();
      M.throwIfError(error);
      const { data: tl } = await supabase.from('request_timeline_events').select('*').eq('request_id', id).order('created_at');
      return M.mapRequest(data, (tl ?? []).map(M.mapTimelineEvent));
    },
    async addTimelineEvent(id, event) {
      const { data: sd } = await supabase.auth.getSession();
      const { error } = await supabase.from('request_timeline_events').insert({
        request_id: id, status: event.status, label: event.label,
        actor: event.actor, actor_id: sd.session?.user.id ?? null,
      });
      M.throwIfError(error);
      return supabaseDataSource.requests.get(id);
    },
  },

  technicians: {
    async list() {
      const { data, error } = await supabase.from('technicians').select('*').order('name_en');
      M.throwIfError(error);
      return (data ?? []).map(M.mapTechnician);
    },
  },

  users: {
    async list() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['super_admin', 'facility_manager', 'technician', 'owner', 'pm_manager'])
        .order('full_name');
      M.throwIfError(error);
      const { data: pmRows } = await supabase.from('property_managers').select('profile_id, property_id');
      return (data ?? []).map((r) => M.mapUser({
        ...r, properties: (pmRows ?? []).filter((p) => p.profile_id === r.id).map((p) => p.property_id),
      }));
    },
    async create(input: import('@/data/client/dataSource').CreateUserInput) {
      const { data, error } = await supabase.functions.invoke('provision-user', {
        body: { email: input.email, fullName: input.name, role: input.role, password: input.password },
      });
      if (error) throw { code: 'VALIDATION', message: error.message };
      const userId = (data as { userId: string }).userId;
      if (input.propertyIds?.length) {
        const { error: pmErr } = await supabase
          .from('property_managers')
          .insert(input.propertyIds.map((pid: string) => ({ property_id: pid, profile_id: userId })));
        if (pmErr) throw { code: 'VALIDATION', message: pmErr.message };
      }
      return { ...input, id: userId };
    },
    async provisionTenant(input) {
      const { data, error } = await supabase.functions.invoke('provision-user', { body: input });
      if (error) throw { code: 'VALIDATION', message: error.message };
      return data as { userId: string };
    },
  },

  messages: {
    async list(threadId) {
      const { data, error } = await supabase.from('messages').select('*').eq('thread_id', threadId).order('created_at');
      M.throwIfError(error);
      return (data ?? []).map(M.mapMessage);
    },
    async send(threadId, msg) {
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('messages').insert({
        thread_id: threadId, sender_id: sd.session?.user.id ?? null,
        sender_role: msg.from, text: msg.text, text_en: msg.textEn,
      }).select().single();
      M.throwIfError(error);
      if (msg.from !== 'tenant') {
        await supabase.from('notifications').insert({
          recipient_id: threadId, title: 'رد جديد من الإدارة', body: msg.text.slice(0, 60),
        });
      }
      return M.mapMessage(data);
    },
    async markThreadRead(threadId) {
      const { error } = await supabase.from('messages')
        .update({ read: true })
        .eq('thread_id', threadId)
        .eq('sender_role', 'tenant')
        .eq('read', false);
      M.throwIfError(error);
    },
    async listThreads() {
      const { data, error } = await supabase.from('messages').select('*').order('created_at');
      M.throwIfError(error);
      const byThread = new Map<string, any[]>();
      (data ?? []).forEach((m) => {
        if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, []);
        byThread.get(m.thread_id)!.push(m);
      });
      const threadIds = Array.from(byThread.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, tenant_property_id, tenant_unit')
        .in('id', threadIds);
      const { data: properties } = await supabase.from('properties').select('id, name, name_en');
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const propertyMap = new Map((properties ?? []).map((p: any) => [p.id, p]));
      return threadIds
        .map((threadId) => {
          const messages = byThread.get(threadId)!.map(M.mapMessage);
          const profile = profileMap.get(threadId) as any;
          const property = profile?.tenant_property_id ? propertyMap.get(profile.tenant_property_id) as any : undefined;
          return {
            threadId,
            messages,
            participant: profile ? {
              name: profile.full_name,
              role: profile.role,
              unit: profile.tenant_unit ?? undefined,
              propertyName: property?.name_en ?? undefined,
            } : undefined,
            lastMessageAt: messages[messages.length - 1]?.time,
          };
        })
        .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
    },
  },

  notifications: {
    async list() {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      M.throwIfError(error);
      return (data ?? []).map(M.mapNotification);
    },
    async markAllRead() {
      const { data: sd } = await supabase.auth.getSession();
      const { error } = await supabase.from('notifications').update({ read: true })
        .eq('recipient_id', sd.session?.user.id ?? '').eq('read', false);
      M.throwIfError(error);
    },
    async push() { /* no-op: notifications are generated by server-side triggers */ },
    async listForTenant() { return supabaseDataSource.notifications.list(); },
    async markAllReadForTenant() { return supabaseDataSource.notifications.markAllRead(); },
    async pushForTenant() { /* no-op */ },
  },

  preferences: {
    async get() {
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('preferences').select('*').eq('profile_id', sd.session?.user.id ?? '').single();
      M.throwIfError(error);
      return M.mapPreferences(data);
    },
    async update(changes) {
      const { data: sd } = await supabase.auth.getSession();
      const patch: Record<string, unknown> = {};
      if (changes.immediateEmergency !== undefined) patch.immediate_emergency = changes.immediateEmergency;
      if (changes.dailySummary !== undefined) patch.daily_summary = changes.dailySummary;
      if (changes.smsAlerts !== undefined) patch.sms_alerts = changes.smsAlerts;
      if (changes.requestUpdates !== undefined) patch.request_updates = changes.requestUpdates;
      if (changes.announcements !== undefined) patch.announcements = changes.announcements;
      if (changes.rentReminders !== undefined) patch.rent_reminders = changes.rentReminders;
      const { data, error } = await supabase.from('preferences').update(patch).eq('profile_id', sd.session?.user.id ?? '').select().single();
      M.throwIfError(error);
      return M.mapPreferences(data);
    },
  },

  announcements: {
    async list(propertyId) {
      let q = supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (propertyId) q = q.or(`property_id.eq.${propertyId},property_id.is.null`);
      const { data, error } = await q;
      M.throwIfError(error);
      return (data ?? []).map(M.mapAnnouncement);
    },
    async create(input) {
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('announcements').insert({
        title: input.title, title_en: input.titleEn, body: input.body, body_en: input.bodyEn,
        property_id: input.propertyId === 'all' ? null : input.propertyId,
        created_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapAnnouncement(data);
    },
    async delete(id) {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      M.throwIfError(error);
    },
  },

  leases: {
    async list(propertyId) {
      let q = supabase.from('leases').select('*').order('unit');
      if (propertyId) q = q.eq('property_id', propertyId);
      const { data, error } = await q;
      M.throwIfError(error);
      return (data ?? []).map(M.mapFmUnit);
    },
    async create(input) {
      const { data, error } = await supabase.from('leases').insert({
        property_id: input.propertyId, unit: input.label,
        tenant_name: input.tenant ?? '', tenant_email: input.tenantEmail ?? null,
        term_start: input.leaseStart ?? new Date().toISOString().slice(0, 10),
        term_end: input.leaseEnd ?? new Date().toISOString().slice(0, 10),
        rent: input.rent ?? 0, deposit: 0, rent_status: 'paid', status: input.status,
      }).select().single();
      M.throwIfError(error);
      return M.mapFmUnit(data);
    },
    async update(id, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.tenant !== undefined) patch.tenant_name = changes.tenant;
      if (changes.tenantEmail !== undefined) patch.tenant_email = changes.tenantEmail;
      if (changes.rent !== undefined) patch.rent = changes.rent;
      if (changes.leaseStart !== undefined) patch.term_start = changes.leaseStart;
      if (changes.leaseEnd !== undefined) patch.term_end = changes.leaseEnd;
      const { data, error } = await supabase.from('leases').update(patch).eq('id', id).select().single();
      M.throwIfError(error);
      return M.mapFmUnit(data);
    },
    async delete(id) {
      const { error } = await supabase.from('leases').delete().eq('id', id);
      M.throwIfError(error);
    },
  },

  propertyDocuments: {
    async list(propertyId) {
      const { data, error } = await supabase.from('property_documents').select('*').eq('property_id', propertyId).order('uploaded_at', { ascending: false });
      M.throwIfError(error);
      return (data ?? []).map(M.mapPropertyDocument);
    },
    async upload(propertyId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('property-documents', `${propertyId}/${Date.now()}-${file.name}`, file);
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('property_documents').insert({
        property_id: propertyId, name: file.name, name_en: file.name,
        type: file.name.split('.').pop() ?? 'file', file_url: url, file_path: path,
        uploaded_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapPropertyDocument(data);
    },
    async delete(_propertyId, documentId) {
      const { error } = await supabase.from('property_documents').delete().eq('id', documentId);
      M.throwIfError(error);
    },
  },

  projects: {
    async list(params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('projects').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return { data: (data ?? []).map((r) => M.mapProject(r)), total: count ?? 0 };
    },
    async get(id) {
      const { data: p, error } = await supabase.from('projects').select('*').eq('id', id).single();
      M.throwIfError(error);
      const [{ data: types }, { data: instances }] = await Promise.all([
        supabase.from('project_unit_types').select('*').eq('project_id', id),
        supabase.from('project_unit_instances').select('*').eq('project_id', id),
      ]);
      return M.mapProject(p, (types ?? []).map(M.mapUnitType), (instances ?? []).map(M.mapUnitInstance));
    },
    async create(input) {
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('projects').insert({
        name: input.name, name_en: input.nameEn, location: input.location, location_en: input.locationEn,
        total_units: input.totalUnits, start_date: input.startDate, end_date: input.endDate,
        total_days: input.totalDays, contractor: input.contractor, contractor_en: input.contractorEn,
        budget: input.budget, status: input.status, description: input.description ?? null,
        description_en: input.descriptionEn ?? null, contract_number: input.contractNumber ?? null,
        consultant: input.consultant ?? null, consultant_en: input.consultantEn ?? null,
        created_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      if (input.unitTypes?.length) {
        await supabase.from('project_unit_types').insert(input.unitTypes.map((u) => ({
          project_id: data.id, type: u.type, type_en: u.typeEn, size: u.size,
          bedrooms: u.bedrooms, unit_count: u.unitCount, category: u.category ?? null,
        })));
      }
      return supabaseDataSource.projects.get(data.id);
    },
    async update(id, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name', nameEn: 'name_en', location: 'location', locationEn: 'location_en',
        totalUnits: 'total_units', startDate: 'start_date', endDate: 'end_date', totalDays: 'total_days',
        contractor: 'contractor', contractorEn: 'contractor_en', budget: 'budget', status: 'status',
        description: 'description', descriptionEn: 'description_en', contractNumber: 'contract_number',
        consultant: 'consultant', consultantEn: 'consultant_en',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { error } = await supabase.from('projects').update(patch).eq('id', id);
      M.throwIfError(error);
      return supabaseDataSource.projects.get(id);
    },
    async addUnit(projectId, unit) {
      const { data, error } = await supabase.from('project_unit_types').insert({
        project_id: projectId, type: unit.type, type_en: unit.typeEn, size: unit.size,
        bedrooms: unit.bedrooms, unit_count: unit.unitCount, category: unit.category ?? null,
        image_url: unit.image || null, floor_plan_url: unit.floorPlan || null,
        model_3d_url: unit.model3d || null, brochure_url: unit.brochure || null,
      }).select().single();
      M.throwIfError(error);
      return M.mapUnitType(data);
    },
    async updateUnit(_projectId, unitId, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.type !== undefined) patch.type = changes.type;
      if (changes.typeEn !== undefined) patch.type_en = changes.typeEn;
      if (changes.size !== undefined) patch.size = changes.size;
      if (changes.bedrooms !== undefined) patch.bedrooms = changes.bedrooms;
      if (changes.unitCount !== undefined) patch.unit_count = changes.unitCount;
      if (changes.floorPlan !== undefined) patch.floor_plan_url = changes.floorPlan;
      if (changes.model3d !== undefined) patch.model_3d_url = changes.model3d;
      if (changes.brochure !== undefined) patch.brochure_url = changes.brochure;
      const { data, error } = await supabase.from('project_unit_types').update(patch).eq('id', unitId).select().single();
      M.throwIfError(error);
      return M.mapUnitType(data);
    },
    async deleteUnit(_projectId, unitId) {
      const { error } = await supabase.from('project_unit_types').delete().eq('id', unitId);
      M.throwIfError(error);
    },
    async addUnitInstance(projectId, unit) {
      const { data, error } = await supabase.from('project_unit_instances').insert({
        project_id: projectId, model_id: unit.modelId, label: unit.label, label_en: unit.labelEn,
        floor: unit.floor, status: unit.status, price: unit.price ?? null, space: unit.space ?? null,
        attachment_name: unit.attachmentName ?? null, floor_level: unit.floorLevel ?? null,
        townhouse_type: unit.townhouseType ?? null,
        floor_plan_url: unit.floorPlan || null, model_3d_url: unit.model3d || null, brochure_url: unit.brochure || null,
      }).select().single();
      M.throwIfError(error);
      return M.mapUnitInstance(data);
    },
    async updateUnitInstance(_projectId, unitId, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.price !== undefined) patch.price = changes.price;
      if (changes.space !== undefined) patch.space = changes.space;
      if (changes.floorPlan !== undefined) patch.floor_plan_url = changes.floorPlan;
      if (changes.model3d !== undefined) patch.model_3d_url = changes.model3d;
      if (changes.brochure !== undefined) patch.brochure_url = changes.brochure;
      const { data, error } = await supabase.from('project_unit_instances').update(patch).eq('id', unitId).select().single();
      M.throwIfError(error);
      return M.mapUnitInstance(data);
    },
    async deleteUnitInstance(_projectId, unitId) {
      const { error } = await supabase.from('project_unit_instances').delete().eq('id', unitId);
      M.throwIfError(error);
    },
  },

  activities: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('project_activities').select('*', { count: 'exact' }).eq('project_id', projectId).order('start_day');
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      const ids = (data ?? []).map((a) => a.id);
      const { data: photos } = ids.length ? await supabase.from('activity_photos').select('*').in('activity_id', ids) : { data: [] };
      return {
        data: (data ?? []).map((a) => M.mapActivity(a, (photos ?? []).filter((p) => p.activity_id === a.id).map(M.mapActivityPhoto))),
        total: count ?? 0,
      };
    },
    async create(projectId, activity) {
      const { data, error } = await supabase.from('project_activities').insert({
        project_id: projectId, activity_code: activity.activityId, name: activity.name, name_en: activity.nameEn,
        phase: activity.phase, start_day: activity.startDay, end_day: activity.endDay, duration: activity.duration,
        actual_progress: activity.actualProgress ?? null, status: activity.status,
        team: activity.team, team_en: activity.teamEn, description: activity.description, description_en: activity.descriptionEn,
        actual_cost: activity.actualCost, planned_cost: activity.plannedCost, change_order_amount: activity.changeOrderAmount ?? 0,
        start_date: activity.startDate ?? null, end_date: activity.endDate ?? null,
        actual_start_date: activity.actualStartDate ?? null, actual_end_date: activity.actualEndDate ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapActivity(data, []);
    },
    async update(_projectId, activityId, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name', nameEn: 'name_en', phase: 'phase', startDay: 'start_day', endDay: 'end_day', duration: 'duration',
        actualProgress: 'actual_progress', status: 'status', team: 'team', teamEn: 'team_en',
        description: 'description', descriptionEn: 'description_en', actualCost: 'actual_cost', plannedCost: 'planned_cost',
        changeOrderAmount: 'change_order_amount', startDate: 'start_date', endDate: 'end_date',
        actualStartDate: 'actual_start_date', actualEndDate: 'actual_end_date',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { data, error } = await supabase.from('project_activities').update(patch).eq('id', activityId).select().single();
      M.throwIfError(error);
      const { data: photos } = await supabase.from('activity_photos').select('*').eq('activity_id', activityId);
      return M.mapActivity(data, (photos ?? []).map(M.mapActivityPhoto));
    },
    async delete(_projectId, activityId) {
      const { error } = await supabase.from('project_activities').delete().eq('id', activityId);
      M.throwIfError(error);
    },
    async addPhoto(_projectId, activityId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('activity-photos', `${activityId}/${Date.now()}-${file.name}`, file);
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('activity_photos').insert({
        activity_id: activityId, file_url: url, file_path: path, file_type: guessFileType(file.name), file_name: file.name,
        uploaded_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapActivityPhoto(data);
    },
  },

  documents: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('project_documents').select('*, document_categories(*)', { count: 'exact' }).eq('project_id', projectId).order('uploaded_at', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      return {
        data: (data ?? []).map((r: any) => M.mapProjectDocument(r, M.mapDocumentCategory(r.document_categories))),
        total: count ?? 0,
      };
    },
    async listCategories(projectId) {
      const { data, error } = await supabase.from('document_categories').select('*').eq('project_id', projectId).order('is_default', { ascending: false });
      M.throwIfError(error);
      return (data ?? []).map(M.mapDocumentCategory);
    },
    async upload(projectId, file, categoryId) {
      const { url, path } = await supabaseDataSource.storage.upload('project-documents', `${projectId}/${categoryId}/${Date.now()}-${file.name}`, file);
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('project_documents').insert({
        project_id: projectId, category_id: categoryId, name: file.name, name_en: file.name,
        type: file.name.split('.').pop() ?? 'file', file_url: url, file_path: path,
        uploaded_by: sd.session?.user.id ?? null,
      }).select('*, document_categories(*)').single();
      M.throwIfError(error);
      return M.mapProjectDocument(data, M.mapDocumentCategory((data as any).document_categories));
    },
    async create(projectId, categoryId, doc) {
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('project_documents').insert({
        project_id: projectId, category_id: categoryId, name: doc.name, name_en: doc.nameEn,
        type: doc.type, file_url: null, file_path: null,
        uploaded_by: sd.session?.user.id ?? null,
      }).select('*, document_categories(*)').single();
      M.throwIfError(error);
      return M.mapProjectDocument(data, M.mapDocumentCategory((data as any).document_categories));
    },
    async update(_projectId, documentId, changes) {
      const patch: Record<string, unknown> = {};
      if (changes.name !== undefined) patch.name = changes.name;
      if (changes.nameEn !== undefined) patch.name_en = changes.nameEn;
      if (changes.categoryId !== undefined) patch.category_id = changes.categoryId;
      const { data, error } = await supabase.from('project_documents').update(patch).eq('id', documentId).select('*, document_categories(*)').single();
      M.throwIfError(error);
      return M.mapProjectDocument(data, M.mapDocumentCategory((data as any).document_categories));
    },
    async delete(_projectId, documentId) {
      const { error } = await supabase.from('project_documents').delete().eq('id', documentId);
      M.throwIfError(error);
    },
    async renameCategory(_projectId, categoryId, names) {
      const { error } = await supabase.from('document_categories').update({ name: names.name, name_en: names.nameEn }).eq('id', categoryId);
      M.throwIfError(error);
    },
    async addCategory(projectId, names) {
      const key = names.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) || `custom_${Date.now()}`;
      const { data, error } = await supabase.from('document_categories').insert({
        project_id: projectId, key, name: names.name, name_en: names.nameEn, is_default: false,
      }).select().single();
      M.throwIfError(error);
      return M.mapDocumentCategory(data);
    },
    async removeCategory(_projectId, categoryId) {
      const { error } = await supabase.from('document_categories').delete().eq('id', categoryId);
      if (error) throw { code: 'VALIDATION', message: error.message };
    },
  },

  risks: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('project_risks').select('*', { count: 'exact' }).eq('project_id', projectId).order('date_raised', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      const ids = (data ?? []).map((r) => r.id);
      const { data: photos } = ids.length ? await supabase.from('risk_photos').select('*').in('risk_id', ids) : { data: [] };
      return {
        data: (data ?? []).map((r) => M.mapRisk(r, (photos ?? []).filter((p) => p.risk_id === r.id).map(M.mapActivityPhoto))),
        total: count ?? 0,
      };
    },
    async create(projectId, risk) {
      const { data, error } = await supabase.from('project_risks').insert({
        project_id: projectId, name: risk.name, name_en: risk.nameEn, date_raised: risk.dateRaised,
        responsible: risk.responsible, responsible_en: risk.responsibleEn,
        description: risk.description, description_en: risk.descriptionEn,
        deadline: risk.deadline || null, reason: risk.reason, reason_en: risk.reasonEn, result: risk.result ?? 'pending',
      }).select().single();
      M.throwIfError(error);
      return M.mapRisk(data, []);
    },
    async update(_projectId, riskId, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name', nameEn: 'name_en', dateRaised: 'date_raised', responsible: 'responsible',
        responsibleEn: 'responsible_en', description: 'description', descriptionEn: 'description_en',
        deadline: 'deadline', reason: 'reason', reasonEn: 'reason_en', result: 'result',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { data, error } = await supabase.from('project_risks').update(patch).eq('id', riskId).select().single();
      M.throwIfError(error);
      const { data: photos } = await supabase.from('risk_photos').select('*').eq('risk_id', riskId);
      return M.mapRisk(data, (photos ?? []).map(M.mapActivityPhoto));
    },
    async delete(_projectId, riskId) {
      const { error } = await supabase.from('project_risks').delete().eq('id', riskId);
      M.throwIfError(error);
    },
    async addPhoto(_projectId, riskId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('risk-photos', `${riskId}/${Date.now()}-${file.name}`, file);
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('risk_photos').insert({
        risk_id: riskId, file_url: url, file_path: path, file_type: guessFileType(file.name), file_name: file.name,
        uploaded_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapActivityPhoto(data);
    },
  },

  ipc: {
    async list(projectId, params) {
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize;
      let q = supabase.from('ipc_entries').select('*', { count: 'exact' }).eq('project_id', projectId).order('date_logged', { ascending: false });
      if (pageSize) q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      M.throwIfError(error);
      const ids = (data ?? []).map((e) => e.id);
      const { data: atts } = ids.length ? await supabase.from('ipc_attachments').select('*').in('ipc_entry_id', ids) : { data: [] };
      return {
        data: (data ?? []).map((e) => M.mapIpc(e, (atts ?? []).filter((a) => a.ipc_entry_id === e.id).map(M.mapIpcAttachment))),
        total: count ?? 0,
      };
    },
    async create(projectId, entry) {
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('ipc_entries').insert({
        project_id: projectId, direction: entry.direction, source: entry.source ?? null,
        party_name: entry.partyName ?? null, party_name_en: entry.partyNameEn ?? null, reference: entry.reference ?? null,
        activity_id: entry.activityId ?? null, amount: entry.amount, description: entry.description,
        description_en: entry.descriptionEn ?? null, status: entry.status, date_logged: entry.dateLogged,
        created_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapIpc(data, []);
    },
    async update(_projectId, entryId, changes) {
      const patch: Record<string, unknown> = {};
      const map: Record<string, string> = {
        source: 'source', partyName: 'party_name', partyNameEn: 'party_name_en', reference: 'reference',
        activityId: 'activity_id', amount: 'amount', description: 'description', descriptionEn: 'description_en',
        status: 'status', dateLogged: 'date_logged',
      };
      Object.entries(changes).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      const { data, error } = await supabase.from('ipc_entries').update(patch).eq('id', entryId).select().single();
      M.throwIfError(error);
      const { data: atts } = await supabase.from('ipc_attachments').select('*').eq('ipc_entry_id', entryId);
      return M.mapIpc(data, (atts ?? []).map(M.mapIpcAttachment));
    },
    async delete(_projectId, entryId) {
      const { error } = await supabase.from('ipc_entries').delete().eq('id', entryId);
      M.throwIfError(error);
    },
    async addAttachment(_projectId, entryId, file) {
      const { url, path } = await supabaseDataSource.storage.upload('ipc-attachments', `${entryId}/${Date.now()}-${file.name}`, file);
      const { data: sd } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('ipc_attachments').insert({
        ipc_entry_id: entryId, file_name: file.name, file_type: guessFileType(file.name), file_url: url, file_path: path,
        uploaded_by: sd.session?.user.id ?? null,
      }).select().single();
      M.throwIfError(error);
      return M.mapIpcAttachment(data);
    },
  },

  storage: {
    async upload(bucket, path, file) {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw { code: 'UNKNOWN', message: error.message };
      const isPublic = bucket === 'unit-assets' || bucket === 'avatars';
      if (isPublic) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        return { url: urlData.publicUrl, path: data.path };
      }
      const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(data.path, 60 * 60 * 24 * 7);
      if (signErr) throw { code: 'UNKNOWN', message: signErr.message };
      return { url: signed.signedUrl, path: data.path };
    },
    async remove(bucket, path) {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw { code: 'UNKNOWN', message: error.message };
    },
  },
};
