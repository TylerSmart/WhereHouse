import { AttributeFieldType } from './category.models';

export type ItemType = 0 | 1 | 2 | 3;

export const ItemTypes = {
  Unique: 0 as ItemType,
  Quantity: 1 as ItemType,
  Kit: 2 as ItemType,
  Nested: 3 as ItemType,
} as const;

export type ItemStatus = 0 | 1 | 2 | 3 | 4 | 5;

export const ItemStatuses = {
  InPlace: 0 as ItemStatus,
  InUse: 1 as ItemStatus,
  LoanedOut: 2 as ItemStatus,
  StagedToSell: 3 as ItemStatus,
  StagedToDonate: 4 as ItemStatus,
  Archived: 5 as ItemStatus,
} as const;

export type ItemCondition = 0 | 1 | 2 | 3 | 4;

export const ItemConditions = {
  New: 0 as ItemCondition,
  Excellent: 1 as ItemCondition,
  Good: 2 as ItemCondition,
  Fair: 3 as ItemCondition,
  Broken: 4 as ItemCondition,
} as const;

export type DispositionReason = 0 | 1 | 2 | 3 | 4;

export const DispositionReasons = {
  Sold: 0 as DispositionReason,
  Donated: 1 as DispositionReason,
  Recycled: 2 as DispositionReason,
  BrokenTrashed: 3 as DispositionReason,
  Consumed: 4 as DispositionReason,
} as const;

export const DISPOSITION_REASON_LABELS: Record<DispositionReason, string> = {
  0: 'Sold',
  1: 'Donated',
  2: 'Recycled / Scrapped',
  3: 'Broken / Trashed',
  4: 'Consumed / Depleted',
};

export interface ItemAttributeValueDto {
  id: string;
  attributeTemplateId: string | null;
  attributeName: string;
  fieldType: AttributeFieldType;
  unit: string | null;
  value: string;
}

export interface ItemChildSummaryDto {
  id: string;
  shortCode: string;
  name: string;
  itemType: ItemType;
  status: ItemStatus;
  condition: ItemCondition;
  currentQuantity: number;
  unit: string | null;
  minQuantity: number | null;
  isLowStock: boolean;
  homeLocationFullPath: string | null;
}

export interface ItemDto {
  id: string;
  shortCode: string;
  name: string;
  description: string | null;
  aliases: string[];
  tags: string[];
  itemType: ItemType;
  status: ItemStatus;
  condition: ItemCondition;
  homeLocationId: string | null;
  homeLocationName: string | null;
  homeLocationShortCode: string | null;
  homeLocationFullPath: string | null;
  categoryId: string | null;
  categoryName: string | null;
  parentItemId: string | null;
  parentItemName: string | null;
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  currentQuantity: number;
  unit: string | null;
  minQuantity: number | null;
  isLowStock: boolean;
  isIncompleteKit: boolean;
  incompleteKitWarnings: string[];
  purchaseDate: string | null;
  retailer: string | null;
  purchasePrice: number | null;
  estimatedReplacementValue: number | null;
  returnWindowEndDate: string | null;
  warrantyExpirationDate: string | null;
  warrantyNotes: string | null;
  isPrivate: boolean;
  ownerId: string;
  attributeValues: ItemAttributeValueDto[];
  childItems: ItemChildSummaryDto[];
  lastTouchedAt: string;
  createdAt: string;
  modifiedAt: string;
  attachmentCount?: number;
  primaryPhotoAttachmentId?: string | null;
  barcodeNumber?: string | null;
  checkedOutByUserId?: string | null;
  checkedOutByUsername?: string | null;
  checkedOutToBorrower?: string | null;
  checkedOutBorrowerContact?: string | null;
  checkoutNote?: string | null;
  checkedOutAt?: string | null;
  checkoutDueAt?: string | null;
  isOverdueLoan?: boolean;
  activeLoadoutId?: string | null;
  activeLoadoutName?: string | null;
  stagingTargetPrice?: number | null;
  stagingListingNotes?: string | null;
  stagedAt?: string | null;
  dispositionReason?: DispositionReason | null;
  dispositionNote?: string | null;
  salePrice?: number | null;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  archivedByUsername?: string | null;
}

export interface UpsertItemAttributeValueRequest {
  attributeTemplateId?: string | null;
  attributeName: string;
  fieldType: AttributeFieldType;
  unit?: string | null;
  value: string;
}

export interface CreateItemRequest {
  name: string;
  itemType?: ItemType;
  homeLocationId?: string | null;
  categoryId?: string | null;
  parentItemId?: string | null;
  shortCode?: string | null;
  description?: string | null;
  aliases?: string[] | null;
  tags?: string[] | null;
  condition?: ItemCondition;
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  barcodeNumber?: string | null;
  currentQuantity?: number;
  unit?: string | null;
  minQuantity?: number | null;
  purchaseDate?: string | null;
  retailer?: string | null;
  purchasePrice?: number | null;
  estimatedReplacementValue?: number | null;
  returnWindowEndDate?: string | null;
  warrantyExpirationDate?: string | null;
  warrantyNotes?: string | null;
  isPrivate?: boolean;
  attributeValues?: UpsertItemAttributeValueRequest[] | null;
}

export interface UpdateItemRequest {
  name: string;
  itemType: ItemType;
  homeLocationId?: string | null;
  categoryId?: string | null;
  parentItemId?: string | null;
  description?: string | null;
  aliases?: string[] | null;
  tags?: string[] | null;
  status?: ItemStatus;
  condition?: ItemCondition;
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  barcodeNumber?: string | null;
  currentQuantity?: number;
  unit?: string | null;
  minQuantity?: number | null;
  purchaseDate?: string | null;
  retailer?: string | null;
  purchasePrice?: number | null;
  estimatedReplacementValue?: number | null;
  returnWindowEndDate?: string | null;
  warrantyExpirationDate?: string | null;
  warrantyNotes?: string | null;
  isPrivate?: boolean;
  attributeValues?: UpsertItemAttributeValueRequest[] | null;
}

export interface AdjustItemQuantityRequest {
  delta?: number | null;
  absoluteQuantity?: number | null;
}

export interface BulkUpdateItemsRequest {
  itemIds: string[];
  updateHomeLocation?: boolean;
  targetHomeLocationId?: string | null;
  updateCategory?: boolean;
  targetCategoryId?: string | null;
  addTags?: string[] | null;
  removeTags?: string[] | null;
}

export interface BulkUpdateItemsResultDto {
  updatedCount: number;
  updatedItems: ItemDto[];
}
