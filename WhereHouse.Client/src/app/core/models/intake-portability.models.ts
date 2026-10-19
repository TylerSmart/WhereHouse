import { ItemCondition, ItemDto, ItemType } from './item.models';

export interface BarcodeProductLookupDto {
  barcode: string;
  found: boolean;
  source: string;
  name?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  description?: string | null;
  suggestedCategoryName?: string | null;
  matchedCategoryId?: string | null;
  suggestedItemType: ItemType;
  suggestedUnit?: string | null;
  existingItemId?: string | null;
  existingItemShortCode?: string | null;
}

export interface RapidIntakeItemRequest {
  name: string;
  homeLocationId?: string | null;
  categoryId?: string | null;
  itemType?: ItemType;
  condition?: ItemCondition;
  currentQuantity?: number;
  unit?: string | null;
  minQuantity?: number | null;
  barcodeNumber?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  description?: string | null;
  tags?: string[] | null;
  purchasePrice?: number | null;
  isPrivate?: boolean;
  bindQrToken?: string | null;
}

export interface RapidBatchIntakeRequest {
  defaultHomeLocationId?: string | null;
  defaultCategoryId?: string | null;
  defaultIsPrivate?: boolean;
  items: RapidIntakeItemRequest[];
}

export interface RapidBatchIntakeResponseDto {
  createdCount: number;
  createdItems: ItemDto[];
}

export type PortabilityEntityType = 0 | 1 | 2;

export const PortabilityEntityTypes = {
  Items: 0 as PortabilityEntityType,
  Locations: 1 as PortabilityEntityType,
  Categories: 2 as PortabilityEntityType,
} as const;

export type ImportRowAction = 0 | 1 | 2 | 3;

export const ImportRowActions = {
  Create: 0 as ImportRowAction,
  Update: 1 as ImportRowAction,
  Skip: 2 as ImportRowAction,
  Error: 3 as ImportRowAction,
} as const;

export interface CategoryAttributeTemplateExportRecord {
  name: string;
  fieldType: number;
  unit?: string | null;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
}

export interface CategoryExportRecord {
  name: string;
  description?: string | null;
  icon?: string | null;
  attributeTemplates: CategoryAttributeTemplateExportRecord[];
}

export interface LocationExportRecord {
  shortCode: string;
  name: string;
  parentShortCode?: string | null;
  nodeType: number;
  description?: string | null;
  icon?: string | null;
  containerStyle?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  colorLabel?: string | null;
  isPrivate: boolean;
}

export interface ItemAttributeExportRecord {
  attributeName: string;
  fieldType: number;
  unit?: string | null;
  value: string;
}

export interface ItemExportRecord {
  shortCode: string;
  name: string;
  itemType: ItemType;
  status: number;
  condition: ItemCondition;
  homeLocationShortCode?: string | null;
  categoryName?: string | null;
  parentItemShortCode?: string | null;
  description?: string | null;
  aliases: string[];
  tags: string[];
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  barcodeNumber?: string | null;
  currentQuantity: number;
  unit?: string | null;
  minQuantity?: number | null;
  purchaseDate?: string | null;
  retailer?: string | null;
  purchasePrice?: number | null;
  estimatedReplacementValue?: number | null;
  returnWindowEndDate?: string | null;
  warrantyExpirationDate?: string | null;
  warrantyNotes?: string | null;
  isPrivate: boolean;
  attributeValues: ItemAttributeExportRecord[];
}

export interface WhereHouseExportBundleDto {
  formatVersion: string;
  exportedAt: string;
  categories: CategoryExportRecord[];
  locations: LocationExportRecord[];
  items: ItemExportRecord[];
}

export interface CsvImportRequest {
  entityType: PortabilityEntityType;
  csvContent: string;
  dryRun?: boolean;
  updateExisting?: boolean;
  columnMapping?: Record<string, string> | null;
}

export interface JsonImportRequest {
  jsonContent: string;
  dryRun?: boolean;
  updateExisting?: boolean;
}

export interface ImportRowPreviewDto {
  rowNumber: number;
  entityType: string;
  identifier: string;
  name: string;
  action: ImportRowAction;
  message: string;
}

export interface ImportResultDto {
  dryRun: boolean;
  totalRowsProcessed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  rows: ImportRowPreviewDto[];
}
