import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AttachmentTypes, ItemAttachmentDto } from '../../../core/models/attachment.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { AttachmentService } from '../../../core/services/attachment/attachment.service';
import {
  ItemAttachmentsDialogComponent,
  ItemAttachmentsDialogData,
} from './item-attachments-dialog.component';

describe('ItemAttachmentsDialogComponent', () => {
  let component: ItemAttachmentsDialogComponent;
  let fixture: ComponentFixture<ItemAttachmentsDialogComponent>;
  let mockAttachmentService: {
    getAttachments: ReturnType<typeof vi.fn>;
    uploadAttachment: ReturnType<typeof vi.fn>;
    downloadAttachment: ReturnType<typeof vi.fn>;
    updateAttachment: ReturnType<typeof vi.fn>;
    deleteAttachment: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockItem: ItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Cordless Drill',
    description: null,
    aliases: [],
    tags: [],
    itemType: ItemTypes.Unique,
    status: ItemStatuses.InPlace,
    condition: ItemConditions.Good,
    homeLocationId: null,
    homeLocationName: null,
    homeLocationShortCode: null,
    homeLocationFullPath: null,
    categoryId: null,
    categoryName: null,
    parentItemId: null,
    parentItemName: null,
    brand: null,
    modelNumber: null,
    serialNumber: null,
    currentQuantity: 1,
    unit: null,
    minQuantity: null,
    isLowStock: false,
    isIncompleteKit: false,
    incompleteKitWarnings: [],
    purchaseDate: null,
    retailer: null,
    purchasePrice: null,
    estimatedReplacementValue: null,
    returnWindowEndDate: null,
    warrantyExpirationDate: null,
    warrantyNotes: null,
    isPrivate: false,
    ownerId: 'u-1',
    attributeValues: [],
    childItems: [],
    lastTouchedAt: '2026-10-18T00:00:00Z',
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
    attachmentCount: 1,
  };

  const mockAttachment: ItemAttachmentDto = {
    id: 'att-1',
    itemId: 'itm-1',
    attachmentType: AttachmentTypes.UserManual,
    fileName: 'manual.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 2048,
    notes: 'Official PDF Manual',
    isPrimaryPhoto: false,
    uploadedByUserId: 'u-1',
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
  };

  const dialogData: ItemAttachmentsDialogData = {
    item: mockItem,
  };

  beforeEach(async () => {
    mockAttachmentService = {
      getAttachments: vi.fn().mockReturnValue(of([mockAttachment])),
      uploadAttachment: vi.fn(),
      downloadAttachment: vi.fn(),
      updateAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
    };
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ItemAttachmentsDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: AttachmentService, useValue: mockAttachmentService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemAttachmentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load attachments on init', () => {
    expect(component).toBeTruthy();
    expect(mockAttachmentService.getAttachments).toHaveBeenCalledWith('itm-1');
  });

  it('should format file sizes correctly', () => {
    expect(component.formatFileSize(0)).toBe('0 B');
    expect(component.formatFileSize(1024)).toBe('1.0 KB');
    expect(component.formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('should delete attachment and reload', () => {
    mockAttachmentService.deleteAttachment.mockReturnValue(of(undefined));
    component.deleteAttachment(mockAttachment);
    expect(mockAttachmentService.deleteAttachment).toHaveBeenCalledWith('itm-1', 'att-1');
  });
});
