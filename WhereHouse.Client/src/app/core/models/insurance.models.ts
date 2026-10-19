import { ItemCondition, ItemStatus } from './item.models';

export interface InsuranceClaimFilterParams {
  locationId?: string | null;
  includeSubtree?: boolean;
  categoryId?: string | null;
  minValue?: number | null;
  includeArchived?: boolean;
  includeAttachments?: boolean;
}

export interface InsuranceClaimItemDto {
  id: string;
  shortCode: string;
  name: string;
  categoryName: string | null;
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  locationFullPath: string;
  status: ItemStatus;
  condition: ItemCondition;
  quantity: number;
  unit: string | null;
  purchaseDate: string | null;
  retailer: string | null;
  purchasePrice: number | null;
  estimatedReplacementValue: number | null;
  effectiveClaimValue: number;
  warrantyExpirationDate: string | null;
  photoCount: number;
  receiptAndDocCount: number;
}

export interface InsuranceClaimPreviewDto {
  generatedAt: string;
  scopeDescription: string;
  totalItemsCount: number;
  totalQuantitySum: number;
  totalPurchaseValue: number;
  totalReplacementValue: number;
  totalEffectiveClaimValue: number;
  totalPhotoCount: number;
  totalReceiptAndDocCount: number;
  items: InsuranceClaimItemDto[];
}
