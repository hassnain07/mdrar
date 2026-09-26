import type { DataSource } from '@/data/client/dataSource';
import { authMock } from './auth.mock';
import { propertiesMock } from './properties.mock';
import { requestsMock } from './requests.mock';
import { techniciansMock } from './technicians.mock';
import { usersMock } from './users.mock';
import { messagesMock } from './messages.mock';
import { notificationsMock } from './notifications.mock';
import { preferencesMock } from './preferences.mock';
import { projectsMock } from './projects.mock';
import { activitiesMock } from './activities.mock';
import { documentsMock } from './documents.mock';
import { risksMock } from './risks.mock';
import { ipcMock } from './ipc.mock';
import { announcementsMock } from './announcements.mock';
import { storageMock } from './storage.mock';
import { leasesMock, propertyDocumentsMock } from './leases.mock';

export const mockDataSource: DataSource = {
  auth: authMock,
  properties: propertiesMock,
  requests: requestsMock,
  technicians: techniciansMock,
  users: usersMock,
  messages: messagesMock,
  notifications: notificationsMock,
  preferences: preferencesMock,
  leases: leasesMock,
  propertyDocuments: propertyDocumentsMock,
  projects: projectsMock,
  activities: activitiesMock,
  documents: documentsMock,
  risks: risksMock,
  ipc: ipcMock,
  announcements: announcementsMock,
  storage: storageMock,
};
