import { z } from 'zod';

export const createRequestSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  unit: z.string().min(1, 'Unit is required'),
  tenant: z.string().min(1),
  tenantEmail: z.string().email(),
  type: z.enum(['preventive', 'corrective', 'emergency']),
  category: z.enum(['ac', 'plumbing', 'electrical', 'common']),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  status: z.enum(['submitted', 'acknowledged', 'in_progress', 'resolved']).default('submitted'),
  priority: z.enum(['normal', 'high', 'critical']).default('normal'),
  date: z.string().min(1),
  photo: z.string().optional(),
  technicianId: z.string().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name (AR) is required'),
  nameEn: z.string().min(1, 'Project name (EN) is required'),
  location: z.string().min(1),
  locationEn: z.string().min(1),
  totalUnits: z.number().int().min(0),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalDays: z.number().int().min(1),
  contractor: z.string().min(1),
  contractorEn: z.string().min(1),
  budget: z.number().min(0),
  status: z.enum(['on_track', 'at_risk', 'delayed', 'completed']).default('on_track'),
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  contractNumber: z.string().optional(),
  consultant: z.string().optional(),
  consultantEn: z.string().optional(),
});

export const projectActivitySchema = z.object({
  activityId: z.string().min(1, 'Activity ID is required'),
  name: z.string().min(1, 'Name (AR) is required'),
  nameEn: z.string().min(1, 'Name (EN) is required'),
  phase: z.enum(['milestone', 'mobilization', 'engineering', 'procurement', 'construction', 'finishing', 'testing']),
  startDay: z.number().int().min(0),
  endDay: z.number().int().min(0),
  duration: z.number().int().min(1),
  percentComplete: z.number().min(0).max(100),
  actualProgress: z.number().min(0).max(100).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'delayed', 'risk']),
  team: z.string().min(1),
  teamEn: z.string().min(1),
  description: z.string().default(''),
  descriptionEn: z.string().default(''),
  actualCost: z.number().min(0).default(0),
  plannedCost: z.number().min(0).default(0),
  changeOrderAmount: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  actualStartDate: z.string().optional(),
  actualEndDate: z.string().optional(),
});

export const projectRiskSchema = z.object({
  name: z.string().min(1, 'Risk name (AR) is required'),
  nameEn: z.string().min(1, 'Risk name (EN) is required'),
  dateRaised: z.string().min(1, 'Date raised is required'),
  responsible: z.string().min(1, 'Responsible person is required'),
  responsibleEn: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  descriptionEn: z.string().default(''),
  deadline: z.string().min(1, 'Deadline is required'),
  reason: z.string().default(''),
  reasonEn: z.string().default(''),
  result: z.enum(['pending', 'in_progress', 'resolved', 'delayed']).default('pending'),
});

export const ipcEntrySchema = z.object({
  projectId: z.string().min(1),
  direction: z.enum(['incoming', 'outgoing']),
  source: z.enum(['contractor', 'consultant']).optional(),
  partyName: z.string().optional(),
  partyNameEn: z.string().optional(),
  reference: z.string().optional(),
  activityId: z.string().optional(),
  amount: z.number().min(0, 'Amount must be non-negative'),
  description: z.string().min(1, 'Description is required'),
  descriptionEn: z.string().optional(),
  status: z.enum(['in_progress', 'delayed', 'completed']),
  dateLogged: z.string().min(1, 'Date is required'),
});

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['super_admin', 'facility_manager', 'technician', 'owner']),
  properties: z.array(z.string()),
});

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Property name (AR) is required'),
  nameEn: z.string().min(1, 'Property name (EN) is required'),
  location: z.string().min(1, 'Location is required'),
  units: z.number().int().min(1, 'Must have at least 1 unit'),
  occupied: z.number().int().min(0).default(0),
  accent: z.string().default('#b86b4b'),
});

export type CreateRequestFormData = z.infer<typeof createRequestSchema>;
export type CreateProjectFormData = z.infer<typeof createProjectSchema>;
export type ProjectActivityFormData = z.infer<typeof projectActivitySchema>;
export type ProjectRiskFormData = z.infer<typeof projectRiskSchema>;
export type IpcEntryFormData = z.infer<typeof ipcEntrySchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;
