import { ItemCondition, ItemDto, ItemStatus, ItemType } from './item.models';

export type CheckoutActionType = 0 | 1 | 2;

export const CheckoutActionTypes = {
  CheckOutInUse: 0 as CheckoutActionType,
  LoanOutExternal: 1 as CheckoutActionType,
  ReturnToHome: 2 as CheckoutActionType,
} as const;

export type LoadoutStatus = 0 | 1;

export const LoadoutStatuses = {
  Ready: 0 as LoadoutStatus,
  ActiveCheckout: 1 as LoadoutStatus,
} as const;

export interface CheckoutLogDto {
  id: string;
  itemId: string;
  itemShortCode: string;
  itemName: string;
  actionType: CheckoutActionType;
  performedByUserId: string;
  performedByUsername: string;
  borrowerName: string | null;
  borrowerContact: string | null;
  projectOrNote: string | null;
  loadoutId: string | null;
  loadoutName: string | null;
  quantityAffected: number;
  quantityConsumed: number | null;
  occurredAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
}

export interface CheckoutItemRequest {
  isExternalLoan?: boolean;
  borrowerName?: string | null;
  borrowerContact?: string | null;
  projectOrNote?: string | null;
  expectedReturnAt?: string | null;
  quantity?: number | null;
}

export interface ReturnItemRequest {
  returnNote?: string | null;
  quantityUsed?: number | null;
  updatedCondition?: ItemCondition | null;
}

export interface BatchCheckoutRequest {
  itemIds: string[];
  isExternalLoan?: boolean;
  borrowerName?: string | null;
  borrowerContact?: string | null;
  projectOrNote?: string | null;
  expectedReturnAt?: string | null;
}

export interface BatchReturnItemEntry {
  itemId: string;
  quantityUsed?: number | null;
}

export interface BatchReturnRequest {
  items: BatchReturnItemEntry[];
  returnNote?: string | null;
}

export interface BatchCheckoutResultDto {
  processedCount: number;
  items: ItemDto[];
}

export interface LoadoutItemDto {
  id: string;
  loadoutId: string;
  itemId: string;
  itemShortCode: string;
  itemName: string;
  itemType: ItemType;
  itemStatus: ItemStatus;
  itemCondition: ItemCondition;
  homeLocationId: string | null;
  homeLocationName: string | null;
  homeLocationShortCode: string | null;
  homeLocationFullPath: string | null;
  containerStyle: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  colorLabel: string | null;
  availableQuantity: number;
  unit: string | null;
  requiredQuantity: number;
  isConsumable: boolean;
  isCurrentlyCheckedOut: boolean;
  quantityCheckedOut: number;
  quantityUsed: number;
  quantityReturned: number;
  hasPreFlightWarning: boolean;
  preFlightWarningMessage: string | null;
  sortOrder: number;
}

export interface LoadoutPickListStopDto {
  locationId: string | null;
  locationName: string;
  locationShortCode: string | null;
  locationFullPath: string;
  containerStyle: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  colorLabel: string | null;
  items: LoadoutItemDto[];
}

export interface LoadoutDto {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: LoadoutStatus;
  lastCheckedOutAt: string | null;
  lastReturnedAt: string | null;
  activeCheckoutNote: string | null;
  isPrivate: boolean;
  ownerId: string;
  totalItemCount: number;
  checkedOutItemCount: number;
  preFlightWarningCount: number;
  preFlightWarnings: string[];
  items: LoadoutItemDto[];
  pickListStops: LoadoutPickListStopDto[];
  createdAt: string;
  modifiedAt: string;
}

export interface UpsertLoadoutItemRequest {
  itemId: string;
  requiredQuantity?: number;
  isConsumable?: boolean;
  sortOrder?: number;
}

export interface CreateLoadoutRequest {
  name: string;
  description?: string | null;
  icon?: string | null;
  isPrivate?: boolean;
  items?: UpsertLoadoutItemRequest[] | null;
}

export interface UpdateLoadoutRequest {
  name: string;
  description?: string | null;
  icon?: string | null;
  isPrivate?: boolean;
  items?: UpsertLoadoutItemRequest[] | null;
}

export interface CheckoutLoadoutRequest {
  checkoutNote?: string | null;
}

export interface PackBackLoadoutItemEntry {
  itemId: string;
  isReturned?: boolean;
  quantityUsed?: number;
  quantityReturned?: number | null;
}

export interface PackBackLoadoutRequest {
  items: PackBackLoadoutItemEntry[];
  returnNote?: string | null;
}
