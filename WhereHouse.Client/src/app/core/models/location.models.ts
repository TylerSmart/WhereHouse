export type LocationNodeType = 0 | 1;

export const LocationNodeTypes = {
  FixedLocation: 0 as LocationNodeType,
  MovableContainer: 1 as LocationNodeType,
} as const;

export interface LocationBreadcrumbDto {
  id: string;
  name: string;
  shortCode: string;
  nodeType: LocationNodeType;
}

export interface LocationNodeDto {
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
  ownerId: string;
  fullPath: string;
  breadcrumbs: LocationBreadcrumbDto[];
  childCount: number;
  itemCount?: number;
  createdAt: string;
  modifiedAt: string;
  coverAttachmentId?: string | null;
}

export interface LocationTreeNodeDto {
  id: string;
  parentId: string | null;
  name: string;
  nodeType: LocationNodeType;
  shortCode: string;
  icon: string | null;
  containerStyle: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  colorLabel: string | null;
  isPrivate: boolean;
  ownerId: string;
  fullPath: string;
  children: LocationTreeNodeDto[];
  coverAttachmentId?: string | null;
}

export interface CreateLocationNodeRequest {
  name: string;
  nodeType: LocationNodeType;
  parentId?: string | null;
  description?: string | null;
  shortCode?: string | null;
  icon?: string | null;
  containerStyle?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  colorLabel?: string | null;
  isPrivate?: boolean;
}

export interface UpdateLocationNodeRequest {
  name: string;
  nodeType: LocationNodeType;
  description?: string | null;
  icon?: string | null;
  containerStyle?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  colorLabel?: string | null;
  isPrivate?: boolean;
}

export interface MoveLocationNodeRequest {
  newParentId: string | null;
}
