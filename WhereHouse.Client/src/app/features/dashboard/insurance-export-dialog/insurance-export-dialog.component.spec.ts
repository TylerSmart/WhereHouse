import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import {
  InsuranceClaimItemDto,
  InsuranceClaimPreviewDto,
} from '../../../core/models/insurance.models';
import { InsuranceService } from '../../../core/services/insurance/insurance.service';
import {
  InsuranceExportDialogComponent,
  InsuranceExportDialogData,
} from './insurance-export-dialog.component';

describe('InsuranceExportDialogComponent', () => {
  let component: InsuranceExportDialogComponent;
  let fixture: ComponentFixture<InsuranceExportDialogComponent>;
  let mockInsuranceService: {
    getPreview: ReturnType<typeof vi.fn>;
    exportZip: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockItem: InsuranceClaimItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Sony 65-Inch OLED',
    categoryName: 'Electronics',
    brand: 'Sony',
    modelNumber: 'XR-65A80K',
    serialNumber: 'SN-998811',
    locationFullPath: 'Living Room',
    status: 0,
    condition: 0,
    quantity: 1,
    unit: null,
    purchaseDate: '2025-01-01T00:00:00Z',
    retailer: 'Best Buy',
    purchasePrice: 1700,
    estimatedReplacementValue: 1900,
    effectiveClaimValue: 1900,
    warrantyExpirationDate: null,
    photoCount: 2,
    receiptAndDocCount: 1,
  };

  const mockPreview: InsuranceClaimPreviewDto = {
    generatedAt: '2026-10-18T00:00:00Z',
    scopeDescription: 'All Locations',
    totalItemsCount: 1,
    totalQuantitySum: 1,
    totalPurchaseValue: 1700,
    totalReplacementValue: 1900,
    totalEffectiveClaimValue: 1900,
    totalPhotoCount: 2,
    totalReceiptAndDocCount: 1,
    items: [mockItem],
  };

  const dialogData: InsuranceExportDialogData = {
    availableLocations: [],
    availableCategories: [],
  };

  beforeEach(async () => {
    mockInsuranceService = {
      getPreview: vi.fn().mockReturnValue(of(mockPreview)),
      exportZip: vi
        .fn()
        .mockReturnValue(of(new Blob(['zip-content'], { type: 'application/zip' }))),
    };
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InsuranceExportDialogComponent],
      providers: [
        { provide: InsuranceService, useValue: mockInsuranceService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InsuranceExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and renders claim preview valuation summary', () => {
    expect(component).toBeTruthy();
    expect(mockInsuranceService.getPreview).toHaveBeenCalled();
    expect(component['preview']()?.totalEffectiveClaimValue).toBe(1900);
    expect(component['preview']()?.items.length).toBe(1);
  });

  it('downloads zip when downloadZip() is clicked', () => {
    const mockBlob = new Blob(['zip-content'], { type: 'application/zip' });
    mockInsuranceService.exportZip.mockReturnValue(of(mockBlob));
    const createObjectURLSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi
      .spyOn(window.URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    component.downloadZip();

    expect(mockInsuranceService.exportZip).toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('closes dialog on close()', () => {
    component.close();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
