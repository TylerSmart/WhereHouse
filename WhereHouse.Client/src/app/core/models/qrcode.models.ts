import { ItemDto } from './item.models';
import { LocationNodeDto } from './location.models';

export type QrTargetType = 0 | 1 | 2;

export const QrTargetTypes = {
  Unassigned: 0 as QrTargetType,
  LocationNode: 1 as QrTargetType,
  Item: 2 as QrTargetType,
} as const;

export type ScanResolutionType = 0 | 1 | 2 | 3 | 4;

export const ScanResolutionTypes = {
  NotFound: 0 as ScanResolutionType,
  UnassignedQr: 1 as ScanResolutionType,
  LocationNode: 2 as ScanResolutionType,
  Item: 3 as ScanResolutionType,
  PrivateRestricted: 4 as ScanResolutionType,
} as const;

export type BulkAuditOutcomeType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const BulkAuditOutcomeTypes = {
  MovedContainer: 0 as BulkAuditOutcomeType,
  MovedItem: 1 as BulkAuditOutcomeType,
  AuditedPresent: 2 as BulkAuditOutcomeType,
  SkippedPrivate: 3 as BulkAuditOutcomeType,
  SkippedInvalidCycle: 4 as BulkAuditOutcomeType,
  UnassignedQr: 5 as BulkAuditOutcomeType,
  NotFound: 6 as BulkAuditOutcomeType,
} as const;

export interface QrCodeDto {
  id: string;
  token: string;
  targetType: QrTargetType;
  locationNodeId?: string | null;
  locationNodeName?: string | null;
  locationNodeShortCode?: string | null;
  locationNodeFullPath?: string | null;
  itemId?: string | null;
  itemName?: string | null;
  itemShortCode?: string | null;
  labelNote?: string | null;
  printedCount: number;
  boundAt?: string | null;
  lastScannedAt?: string | null;
  createdByUserId: string;
  createdAt: string;
  modifiedAt: string;
}

export interface GenerateQrCodeBatchRequest {
  count?: number;
  prefix?: string | null;
  labelNote?: string | null;
}

export interface BindQrCodeRequest {
  targetType: QrTargetType;
  targetId: string;
  labelNote?: string | null;
}

export interface ScanResolutionDto {
  scannedCode: string;
  resolutionType: ScanResolutionType;
  message: string;
  qrCode?: QrCodeDto | null;
  location?: LocationNodeDto | null;
  childLocations?: LocationNodeDto[] | null;
  locationItems?: ItemDto[] | null;
  item?: ItemDto | null;
}

export interface BulkScanAuditRequest {
  destinationLocationId: string;
  scannedCodes: string[];
}

export interface BulkScanAuditItemResultDto {
  scannedCode: string;
  outcome: BulkAuditOutcomeType;
  message: string;
  entityId?: string | null;
  entityName?: string | null;
  entityShortCode?: string | null;
}

export interface BulkScanAuditResponseDto {
  destinationLocationId: string;
  destinationName: string;
  destinationShortCode: string;
  destinationFullPath: string;
  auditedAt: string;
  movedCount: number;
  auditedPresentCount: number;
  errorOrSkippedCount: number;
  results: BulkScanAuditItemResultDto[];
}

export type LabelPresetId =
  'avery-5160' | 'avery-5163' | 'avery-22806' | 'thermal-2x1' | 'thermal-225x125' | 'thermal-4x6';

export interface LabelPreset {
  id: LabelPresetId;
  name: string;
  category: 'sheet' | 'thermal';
  columns: number;
  rows: number;
  widthInches: number;
  heightInches: number;
  description: string;
}

export interface PrintableLabelItem {
  code: string;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}
