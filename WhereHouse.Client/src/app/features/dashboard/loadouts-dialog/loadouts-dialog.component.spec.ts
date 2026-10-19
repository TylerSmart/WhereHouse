import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { LoadoutDto, LoadoutStatuses } from '../../../core/models/checkout-loadout.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';
import { LoadoutsDialogComponent, LoadoutsDialogData } from './loadouts-dialog.component';

describe('LoadoutsDialogComponent', () => {
  let component: LoadoutsDialogComponent;
  let fixture: ComponentFixture<LoadoutsDialogComponent>;

  const mockItem: ItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Tent',
    description: null,
    aliases: [],
    tags: [],
    itemType: ItemTypes.Unique,
    status: ItemStatuses.InPlace,
    condition: ItemConditions.Good,
    homeLocationId: 'loc-1',
    homeLocationName: 'Bin 1',
    homeLocationShortCode: 'BIN-1',
    homeLocationFullPath: 'Garage > Bin 1',
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

  const mockLoadout: LoadoutDto = {
    id: 'ld-1',
    name: 'Weekend Camping',
    description: 'Camp gear',
    icon: 'camping',
    status: LoadoutStatuses.Ready,
    lastCheckedOutAt: null,
    lastReturnedAt: null,
    activeCheckoutNote: null,
    isPrivate: false,
    ownerId: 'u-1',
    totalItemCount: 1,
    checkedOutItemCount: 0,
    preFlightWarningCount: 0,
    preFlightWarnings: [],
    items: [],
    pickListStops: [],
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
  };

  const dialogData: LoadoutsDialogData = {
    availableItems: [mockItem],
  };

  const mockCheckoutLoadoutService = {
    cartItems: signal<ItemDto[]>([]),
    getLoadouts: vi.fn().mockReturnValue(of([mockLoadout])),
    getActiveCheckouts: vi.fn().mockReturnValue(of([])),
    createLoadout: vi.fn(),
    deleteLoadout: vi.fn(),
    checkoutLoadout: vi.fn(),
    packBackLoadout: vi.fn(),
    batchCheckout: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckoutLoadoutService.getLoadouts.mockReturnValue(of([mockLoadout]));
    mockCheckoutLoadoutService.getActiveCheckouts.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [LoadoutsDialogComponent],
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

    fixture = TestBed.createComponent(LoadoutsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads and displays loadouts', () => {
    expect(component).toBeTruthy();
    expect(component.loadouts().length).toBe(1);
    expect(component.loadouts()[0].name).toBe('Weekend Camping');
  });

  it('switches to loans tab and loads active loans', () => {
    component.switchTabToLoans();
    expect(component.activeTab()).toBe('loans');
    expect(mockCheckoutLoadoutService.getActiveCheckouts).toHaveBeenCalled();
  });
});
