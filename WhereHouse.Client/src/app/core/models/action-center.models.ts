import { MaintenanceScheduleDto } from './maintenance.models';

export const NotificationChannelTypes = {
  Ntfy: 0,
  SlackWebhook: 1,
  Pushover: 2,
  SmtpEmail: 3,
} as const;

export type NotificationChannelType =
  (typeof NotificationChannelTypes)[keyof typeof NotificationChannelTypes];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannelType, string> = {
  [NotificationChannelTypes.Ntfy]: 'ntfy (HTTP)',
  [NotificationChannelTypes.SlackWebhook]: 'Slack Webhook',
  [NotificationChannelTypes.Pushover]: 'Pushover',
  [NotificationChannelTypes.SmtpEmail]: 'Email (SMTP)',
};

export const NotificationEventTypes = {
  TestNotification: 0,
  WeeklyDigest: 1,
  OverdueLoanAlert: 2,
  MaintenanceDueAlert: 3,
  WarrantyReturnExpiryAlert: 4,
  LowStockAlert: 5,
} as const;

export type NotificationEventType =
  (typeof NotificationEventTypes)[keyof typeof NotificationEventTypes];

export const WarrantyOrReturnAlertTypes = {
  ReturnWindow: 0,
  WarrantyExpiration: 1,
} as const;

export type WarrantyOrReturnAlertType =
  (typeof WarrantyOrReturnAlertTypes)[keyof typeof WarrantyOrReturnAlertTypes];

export interface OutOfPlaceItemAlertDto {
  itemId: string;
  shortCode: string;
  name: string;
  homeLocationId?: string | null;
  homeLocationFullPath?: string | null;
  checkedOutByUserId?: string | null;
  checkedOutByUsername?: string | null;
  checkoutNote?: string | null;
  activeLoadoutId?: string | null;
  activeLoadoutName?: string | null;
  checkedOutAt?: string | null;
  daysOut: number;
}

export interface ExternalLoanAlertDto {
  itemId: string;
  shortCode: string;
  name: string;
  homeLocationFullPath?: string | null;
  borrowerName?: string | null;
  borrowerContact?: string | null;
  checkoutNote?: string | null;
  checkedOutAt?: string | null;
  dueAt?: string | null;
  isOverdue: boolean;
  daysUntilDue?: number | null;
}

export interface ExpiringCoverageAlertDto {
  itemId: string;
  shortCode: string;
  name: string;
  brand?: string | null;
  modelNumber?: string | null;
  retailer?: string | null;
  purchasePrice?: number | null;
  homeLocationFullPath?: string | null;
  alertType: WarrantyOrReturnAlertType;
  expirationDate: string;
  daysRemaining: number;
  isExpired: boolean;
  warrantyNotes?: string | null;
}

export interface LowStockItemAlertDto {
  itemId: string;
  shortCode: string;
  name: string;
  categoryName?: string | null;
  homeLocationFullPath?: string | null;
  currentQuantity: number;
  minQuantity: number;
  unit?: string | null;
}

export interface ActionCenterOverviewDto {
  totalAlertsCount: number;
  outOfPlaceCount: number;
  activeLoansCount: number;
  overdueLoansCount: number;
  maintenanceDueCount: number;
  maintenanceOverdueCount: number;
  expiringCoverageCount: number;
  lowStockCount: number;
  outOfPlaceItems: OutOfPlaceItemAlertDto[];
  externalLoans: ExternalLoanAlertDto[];
  dueMaintenanceSchedules: MaintenanceScheduleDto[];
  expiringCoverages: ExpiringCoverageAlertDto[];
  lowStockItems: LowStockItemAlertDto[];
}

export interface NotificationChannelDto {
  id: string;
  ownerId: string;
  name: string;
  channelType: NotificationChannelType;
  isEnabled: boolean;
  isSharedHouseholdChannel: boolean;
  endpointUrl?: string | null;
  hasAccessTokenOrKey: boolean;
  recipientOrUserKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpFromAddress?: string | null;
  smtpUseSsl: boolean;
  notifyOnOverdueLoans: boolean;
  notifyOnMaintenanceDue: boolean;
  notifyOnExpiringWarranties: boolean;
  notifyOnLowStock: boolean;
  enableWeeklyDigest: boolean;
  digestDayOfWeek: number;
  digestHourUtc: number;
  lastTriggeredAt?: string | null;
  lastDeliveryStatus?: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface NotificationDeliveryLogDto {
  id: string;
  channelId: string;
  channelName: string;
  channelType: NotificationChannelType;
  eventType: NotificationEventType;
  subject: string;
  messageBody: string;
  success: boolean;
  responseSummary?: string | null;
  deliveredAt: string;
}

export interface CreateNotificationChannelRequest {
  name: string;
  channelType?: NotificationChannelType;
  isEnabled?: boolean;
  isSharedHouseholdChannel?: boolean;
  endpointUrl?: string | null;
  accessTokenOrKey?: string | null;
  recipientOrUserKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpFromAddress?: string | null;
  smtpUseSsl?: boolean;
  notifyOnOverdueLoans?: boolean;
  notifyOnMaintenanceDue?: boolean;
  notifyOnExpiringWarranties?: boolean;
  notifyOnLowStock?: boolean;
  enableWeeklyDigest?: boolean;
  digestDayOfWeek?: number;
  digestHourUtc?: number;
}

export interface UpdateNotificationChannelRequest {
  name: string;
  channelType?: NotificationChannelType;
  isEnabled?: boolean;
  isSharedHouseholdChannel?: boolean;
  endpointUrl?: string | null;
  accessTokenOrKey?: string | null;
  clearAccessTokenOrKey?: boolean;
  recipientOrUserKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpFromAddress?: string | null;
  smtpUseSsl?: boolean;
  notifyOnOverdueLoans?: boolean;
  notifyOnMaintenanceDue?: boolean;
  notifyOnExpiringWarranties?: boolean;
  notifyOnLowStock?: boolean;
  enableWeeklyDigest?: boolean;
  digestDayOfWeek?: number;
  digestHourUtc?: number;
}

export interface SendNotificationDigestRequest {
  channelId?: string | null;
  coverageWindowDays?: number;
}

export interface NotificationDispatchResultDto {
  channelsTargeted: number;
  successCount: number;
  failureCount: number;
  digestSubject: string;
  digestBodyPreview: string;
  deliveries: NotificationDeliveryLogDto[];
}
