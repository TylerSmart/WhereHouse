export type AttributeFieldType = 0 | 1 | 2 | 3;

export const AttributeFieldTypes = {
  Text: 0 as AttributeFieldType,
  Number: 1 as AttributeFieldType,
  Enum: 2 as AttributeFieldType,
  Boolean: 3 as AttributeFieldType,
} as const;

export interface CategoryAttributeTemplateDto {
  id: string;
  categoryId: string;
  name: string;
  fieldType: AttributeFieldType;
  unit: string | null;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
}

export interface CategoryDto {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  attributeTemplates: CategoryAttributeTemplateDto[];
  itemCount: number;
  createdAt: string;
  modifiedAt: string;
}

export interface UpsertCategoryAttributeTemplateRequest {
  id?: string | null;
  name: string;
  fieldType: AttributeFieldType;
  unit?: string | null;
  options?: string[] | null;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface CreateCategoryRequest {
  name: string;
  parentId?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  attributeTemplates?: UpsertCategoryAttributeTemplateRequest[] | null;
}

export interface UpdateCategoryRequest {
  name: string;
  parentId?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  attributeTemplates?: UpsertCategoryAttributeTemplateRequest[] | null;
}
