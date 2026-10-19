import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QrCodeDto, QrTargetTypes } from '../../../core/models/qrcode.models';
import { QrCodeService } from '../../../core/services/qrcode/qrcode.service';
import {
  LabelGeneratorDialogComponent,
  LabelGeneratorDialogData,
} from './label-generator-dialog.component';

describe('LabelGeneratorDialogComponent', () => {
  let component: LabelGeneratorDialogComponent;
  let fixture: ComponentFixture<LabelGeneratorDialogComponent>;

  const mockQrCodeService = {
    generateBatch: vi.fn(),
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockData: LabelGeneratorDialogData = {
    availableLocations: [
      {
        id: 'loc-1',
        parentId: null,
        name: 'Garage Shelf',
        shortCode: 'LOC-001',
        nodeType: 0,
        description: null,
        icon: 'location_on',
        containerStyle: null,
        primaryColor: '#006494',
        accentColor: null,
        colorLabel: null,
        isPrivate: false,
        ownerId: 'u-1',
        fullPath: 'Garage Shelf',
        breadcrumbs: [],
        childCount: 0,
        createdAt: '2026-10-18T00:00:00Z',
        modifiedAt: '2026-10-18T00:00:00Z',
      },
    ],
    availableItems: [
      {
        id: 'itm-1',
        shortCode: 'ITM-001',
        name: 'Hammer',
        description: null,
        aliases: [],
        tags: [],
        itemType: 0,
        status: 0,
        condition: 0,
        homeLocationId: 'loc-1',
        homeLocationName: 'Garage Shelf',
        homeLocationShortCode: 'LOC-001',
        homeLocationFullPath: 'Garage Shelf',
        categoryId: null,
        categoryName: null,
        parentItemId: null,
        parentItemName: null,
        brand: 'Stanley',
        modelNumber: null,
        serialNumber: null,
        currentQuantity: 1,
        unit: 'ea',
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
      },
    ],
    preselectedLabels: [
      {
        code: 'BIN-001',
        title: 'Electronics Bin',
        subtitle: 'Storage Closet',
        badgeText: 'BIN',
        primaryColor: null,
        accentColor: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [LabelGeneratorDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: QrCodeService, useValue: mockQrCodeService },
      ],
    });

    fixture = TestBed.createComponent(LabelGeneratorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with preselectedLabels in queue', () => {
    expect(component.printQueue().length).toBe(1);
    expect(component.printQueue()[0].code).toBe('BIN-001');
  });

  it('addLocationToQueue adds selected location to print queue', () => {
    component.addLocationToQueue('loc-1');
    expect(component.printQueue().length).toBe(2);
    expect(component.printQueue()[1].code).toBe('LOC-001');
  });

  it('addItemToQueue adds selected item to print queue', () => {
    component.addItemToQueue('itm-1');
    expect(component.printQueue().length).toBe(2);
    expect(component.printQueue()[1].code).toBe('ITM-001');
  });

  it('mintBlankBatch calls qrcodeService.generateBatch and queues newly minted stickers', () => {
    const mockMinted: QrCodeDto[] = [
      {
        id: 'qr-1',
        token: 'QR-0001',
        targetType: QrTargetTypes.Unassigned,
        labelNote: '2026 stickers',
        printedCount: 1,
        createdByUserId: 'u-1',
        createdAt: '2026-10-18T00:00:00Z',
        modifiedAt: '2026-10-18T00:00:00Z',
      },
      {
        id: 'qr-2',
        token: 'QR-0002',
        targetType: QrTargetTypes.Unassigned,
        labelNote: '2026 stickers',
        printedCount: 1,
        createdByUserId: 'u-1',
        createdAt: '2026-10-18T00:00:00Z',
        modifiedAt: '2026-10-18T00:00:00Z',
      },
    ];
    mockQrCodeService.generateBatch.mockReturnValue(of(mockMinted));

    component.batchCount.set(2);
    component.batchNote.set('2026 stickers');
    component.mintBlankBatch();

    expect(mockQrCodeService.generateBatch).toHaveBeenCalledWith({
      count: 2,
      prefix: 'QR',
      labelNote: '2026 stickers',
    });
    expect(component.printQueue().length).toBe(3);
    expect(component.printQueue()[1].code).toBe('QR-0001');
    expect(component.printQueue()[2].code).toBe('QR-0002');
  });

  it('calculates spacer cells correctly for partial sheet reuse', () => {
    // Avery 5160 has 3 columns
    component.selectedPresetId.set('avery-5160');
    component.startRow.set(2);
    component.startColumn.set(2);

    // (2 - 1) * 3 + (2 - 1) = 4
    expect(component.spacerArray().length).toBe(4);
  });

  it('triggerPrint calls window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      /* no-op for test */
    });
    component.triggerPrint();
    expect(printSpy).toHaveBeenCalled();
  });
});
