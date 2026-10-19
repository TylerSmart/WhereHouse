import { DispositionReason, ItemDto } from './item.models';

export interface StageItemRequest {
  isToSell?: boolean;
  targetPrice?: number | null;
  listingNotes?: string | null;
}

export interface ArchiveItemRequest {
  dispositionReason: DispositionReason;
  dispositionNote?: string | null;
  salePrice?: number | null;
}

export interface BulkArchiveRequest {
  itemIds: string[];
  dispositionReason: DispositionReason;
  dispositionNote?: string | null;
  salePrice?: number | null;
}

export interface BulkUnstageRequest {
  itemIds: string[];
}

export interface BulkLifecycleResultDto {
  processedCount: number;
  items: ItemDto[];
}

export interface DeclutterStagingSummaryDto {
  totalStagedCount: number;
  stagedToSellCount: number;
  stagedToDonateCount: number;
  totalTargetResaleValue: number;
  totalEstimatedDonationValue: number;
  items: ItemDto[];
}

export interface DustCollectorItemDto {
  item: ItemDto;
  daysUntouched: number;
  estimatedValue: number;
}

export interface DustCollectorLocationGroupDto {
  locationId: string | null;
  locationName: string;
  locationShortCode: string | null;
  locationFullPath: string;
  itemCount: number;
  groupEstimatedValue: number;
  items: DustCollectorItemDto[];
}

export interface DustCollectorInsightsDto {
  minUntouchedDays: number;
  cutoffDate: string;
  totalItemsCount: number;
  totalEstimatedValue: number;
  locationGroups: DustCollectorLocationGroupDto[];
}

export interface GraveyardSummaryDto {
  totalArchivedCount: number;
  soldCount: number;
  donatedCount: number;
  recycledCount: number;
  brokenTrashedCount: number;
  consumedCount: number;
  totalSaleProceeds: number;
  totalDonatedEstimatedValue: number;
  items: ItemDto[];
}
