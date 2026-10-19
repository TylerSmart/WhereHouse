import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';
import {
  CheckoutReturnDialogComponent,
  CheckoutReturnDialogData,
} from './checkout-return-dialog.component';

describe('CheckoutReturnDialogComponent', () => {
  let component: CheckoutReturnDialogComponent;
  let fixture: ComponentFixture<CheckoutReturnDialogComponent>;

  const mockItemInPlace: ItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Cordless Drill',
    description: null,
    aliases: [],
    tags: [],
    itemType: ItemTypes.Unique,
    status: ItemStatuses.InPlace,
    condition: ItemConditions.Good,
    homeLocationId: 'loc-1',
    homeLocationName: 'Garage Shelf',
    homeLocationShortCode: 'LOC-001',
    homeLocationFullPath: 'Garage > Garage Shelf',
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
  };

  const dialogData: CheckoutReturnDialogData = {
    item: mockItemInPlace,
  };

  const mockCheckoutLoadoutService = {
    getItemCheckoutHistory: vi.fn().mockReturnValue(of([])),
    checkoutItem: vi.fn().mockReturnValue(of({ ...mockItemInPlace, status: ItemStatuses.InUse })),
    returnItem: vi.fn().mockReturnValue(of({ ...mockItemInPlace, status: ItemStatuses.InPlace })),
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckoutLoadoutService.getItemCheckoutHistory.mockReturnValue(of([]));
    mockCheckoutLoadoutService.checkoutItem.mockReturnValue(
      of({ ...mockItemInPlace, status: ItemStatuses.InUse }),
    );
    mockCheckoutLoadoutService.returnItem.mockReturnValue(
      of({ ...mockItemInPlace, status: ItemStatuses.InPlace }),
    );

    await TestBed.configureTestingModule({
      imports: [CheckoutReturnDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        {
          provide: CheckoutLoadoutService,
          useValue: mockCheckoutLoadoutService,
        },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutReturnDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates in checkout mode for InPlace items', () => {
    expect(component).toBeTruthy();
    expect(component.isCurrentlyCheckedOut).toBe(false);
  });

  it('submits checkout request', () => {
    component.checkoutMode = 'inUse';
    component.projectOrNote = 'Kitchen Remodel';
    component.submitCheckout();

    expect(mockCheckoutLoadoutService.checkoutItem).toHaveBeenCalledWith(
      'itm-1',
      expect.objectContaining({
        isExternalLoan: false,
        projectOrNote: 'Kitchen Remodel',
      }),
    );
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
