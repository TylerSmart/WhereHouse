export type AttachmentType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const AttachmentTypes = {
  Photo: 0 as AttachmentType,
  ReceiptInvoice: 1 as AttachmentType,
  UserManual: 2 as AttachmentType,
  WarrantyCard: 3 as AttachmentType,
  SpecSheet: 4 as AttachmentType,
  RepairLog: 5 as AttachmentType,
  Other: 6 as AttachmentType,
} as const;

export interface ItemAttachmentDto {
  id: string;
  itemId: string;
  attachmentType: AttachmentType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  notes: string | null;
  isPrimaryPhoto: boolean;
  uploadedByUserId: string;
  createdAt: string;
  modifiedAt: string;
}

export interface UpdateItemAttachmentRequest {
  attachmentType: AttachmentType;
  notes?: string | null;
  isPrimaryPhoto?: boolean;
}
