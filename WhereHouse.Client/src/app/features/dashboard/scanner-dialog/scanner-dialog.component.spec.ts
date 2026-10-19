import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  BulkAuditOutcomeTypes,
  BulkScanAuditResponseDto,
  QrTargetTypes,
  ScanResolutionDto,
  ScanResolutionTypes,
} from '../../../core/models/qrcode.models';
import { QrCodeService } from '../../../core/services/qrcode/qrcode.service';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';
import { ScannerDialogComponent, ScannerDialogData } from './scanner-dialog.component';

describe('ScannerDialogComponent', () => {
  let component: ScannerDialogComponent;
  let fixture: ComponentFixture<ScannerDialogComponent>;

  const mockQrCodeService = {
    resolveScan: vi.fn(),
    bindQrCode: vi.fn(),
    bulkMoveAudit: vi.fn(),
  };

  const mockCheckoutLoadoutService = {
    checkoutItem: vi.fn(),
    returnItem: vi.fn(),
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockData: ScannerDialogData = {
    initialCode: 'BIN-001',
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
        primaryColor: null,
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
        name: 'Drill',
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
        brand: 'Bosch',
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
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockRes: ScanResolutionDto = {
      scannedCode: 'BIN-001',
      resolutionType: ScanResolutionTypes.LocationNode,
      message: 'Container found',
      location: mockData.availableLocations[0],
      locationItems: [mockData.availableItems[0]],
    };
    mockQrCodeService.resolveScan.mockReturnValue(of(mockRes));

    TestBed.configureTestingModule({
      imports: [ScannerDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: QrCodeService, useValue: mockQrCodeService },
        { provide: CheckoutLoadoutService, useValue: mockCheckoutLoadoutService },
      ],
    });

    fixture = TestBed.createComponent(ScannerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes and executes scan if initialCode is provided', () => {
    expect(mockQrCodeService.resolveScan).toHaveBeenCalledWith('BIN-001');
    expect(component.resolution()).not.toBeNull();
    expect(component.resolution()?.resolutionType).toBe(ScanResolutionTypes.LocationNode);
  });

  it('executeBind calls qrcodeService.bindQrCode and re-scans', () => {
    component.bindTargetType.set(QrTargetTypes.LocationNode);
    component.bindTargetId.set('loc-1');
    mockQrCodeService.bindQrCode.mockReturnValue(of({}));

    component.executeBind();

    expect(mockQrCodeService.bindQrCode).toHaveBeenCalledWith('BIN-001', {
      targetType: QrTargetTypes.LocationNode,
      targetId: 'loc-1',
      labelNote: null,
    });
  });

  it('executeAuditScan calls qrcodeService.bulkMoveAudit and updates auditLog', () => {
    component.auditDestinationId.set('loc-1');
    component.auditCodeInput.set('ITM-001');

    const mockAuditRes: BulkScanAuditResponseDto = {
      destinationLocationId: 'loc-1',
      destinationName: 'Garage Shelf',
      destinationShortCode: 'LOC-001',
      destinationFullPath: 'Garage Shelf',
      auditedAt: '2026-10-18T00:00:00Z',
      movedCount: 1,
      auditedPresentCount: 0,
      errorOrSkippedCount: 0,
      results: [
        {
          scannedCode: 'ITM-001',
          outcome: BulkAuditOutcomeTypes.MovedItem,
          message: 'Moved item into Garage Shelf',
        },
      ],
    };
    mockQrCodeService.bulkMoveAudit.mockReturnValue(of(mockAuditRes));

    component.executeAuditScan();

    expect(mockQrCodeService.bulkMoveAudit).toHaveBeenCalledWith({
      destinationLocationId: 'loc-1',
      scannedCodes: ['ITM-001'],
    });
    expect(component.auditLog().length).toBe(1);
    expect(component.totalMovedCount()).toBe(1);
  });

  it('printLocationLabel closes dialog with printLabel action', () => {
    component.printLocationLabel(mockData.availableLocations[0]);
    expect(mockDialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'printLabel',
      }),
    );
  });
});
