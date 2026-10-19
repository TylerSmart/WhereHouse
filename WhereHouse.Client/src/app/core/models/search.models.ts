import { ItemDto, ItemStatus, ItemType } from './item.models';
import { LocationNodeType } from './location.models';

export interface SmartSearchParams {
  q?: string | null;
  locationId?: string | null;
  categoryId?: string | null;
  itemType?: ItemType | null;
  status?: ItemStatus | null;
  outOfPlaceOnly?: boolean | null;
  lowStockOnly?: boolean | null;
  attributeName?: string | null;
  attributeValue?: string | null;
  attributeMinNumber?: number | null;
  attributeMaxNumber?: number | null;
  includeArchived?: boolean;
  includeAttachmentText?: boolean;
  ownerUserId?: string | null;
}

export interface LocationSearchHitDto {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  nodeType: LocationNodeType;
  shortCode: string;
  icon: string | null;
  containerStyle: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  colorLabel: string | null;
  isPrivate: boolean;
  fullPath: string;
  itemCount: number;
  childCount: number;
}

export interface SmartSearchResponseDto {
  query: string;
  locations: LocationSearchHitDto[];
  activeItems: ItemDto[];
  archivedItems: ItemDto[];
  totalCount: number;
}
