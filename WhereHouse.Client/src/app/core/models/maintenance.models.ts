export type MaintenanceIntervalUnit = 0 | 1 | 2 | 3;

export const MaintenanceIntervalUnits = {
  Days: 0 as MaintenanceIntervalUnit,
  Weeks: 1 as MaintenanceIntervalUnit,
  Months: 2 as MaintenanceIntervalUnit,
  Years: 3 as MaintenanceIntervalUnit,
} as const;

export const MAINTENANCE_INTERVAL_LABELS: Record<MaintenanceIntervalUnit, string> = {
  0: 'Days',
  1: 'Weeks',
  2: 'Months',
  3: 'Years',
};

export type MaintenanceDueStatus = 0 | 1 | 2 | 3;

export const MaintenanceDueStatuses = {
  UpToDate: 0 as MaintenanceDueStatus,
  DueSoon: 1 as MaintenanceDueStatus,
  Overdue: 2 as MaintenanceDueStatus,
  Paused: 3 as MaintenanceDueStatus,
} as const;

export const MAINTENANCE_DUE_STATUS_LABELS: Record<MaintenanceDueStatus, string> = {
  0: 'Up to Date',
  1: 'Due Soon',
  2: 'Overdue',
  3: 'Paused',
};

export interface MaintenanceScheduleDto {
  id: string;
  itemId: string;
  itemShortCode: string;
  itemName: string;
  itemLocationFullPath: string | null;
  title: string;
  description: string | null;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  lastCompletedAt: string | null;
  nextDueAt: string;
  isActive: boolean;
  dueStatus: MaintenanceDueStatus;
  daysUntilDue: number;
  createdAt: string;
  modifiedAt: string;
}

export interface MaintenanceLogDto {
  id: string;
  scheduleId: string;
  itemId: string;
  itemShortCode: string;
  itemName: string;
  scheduleTitle: string;
  completedAt: string;
  completedByUserId: string;
  completedByUsername: string;
  notes: string | null;
  cost: number | null;
}

export interface MaintenanceSummaryDto {
  totalActiveSchedules: number;
  overdueCount: number;
  dueSoonCount: number;
  upToDateCount: number;
  schedules: MaintenanceScheduleDto[];
  recentLogs: MaintenanceLogDto[];
}

export interface CreateMaintenanceScheduleRequest {
  title: string;
  description?: string | null;
  intervalValue?: number;
  intervalUnit?: MaintenanceIntervalUnit;
  firstDueAt?: string | null;
  lastCompletedAt?: string | null;
}

export interface UpdateMaintenanceScheduleRequest {
  title: string;
  description?: string | null;
  intervalValue?: number;
  intervalUnit?: MaintenanceIntervalUnit;
  nextDueAt?: string | null;
  isActive?: boolean;
}

export interface CompleteMaintenanceTaskRequest {
  notes?: string | null;
  cost?: number | null;
  completedAt?: string | null;
}
