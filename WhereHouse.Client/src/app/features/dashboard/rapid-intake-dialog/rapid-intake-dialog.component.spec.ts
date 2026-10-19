import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { CategoryDto } from '../../../core/models/category.models';
import { BarcodeProductLookupDto } from '../../../core/models/intake-portability.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { LocationNodeDto, LocationNodeTypes } from '../../../core/models/location.models';
import { IntakePortabilityService } from '../../../core/services/intake-portability/intake-portability.service';
import { ItemService } from '../../../core/services/item/item.service';
import { RapidIntakeDialogComponent, RapidIntakeDialogData } from './rapid-intake-dialog.component';

describe('RapidIntakeDialogComponent', () => {
  let component: RapidIntakeDialogComponent;
  let fixture: ComponentFixture<RapidIntakeDialogComponent>;

  const mockCategories: CategoryDto[] = [
    {
      id: 'cat-1',
      parentId: null,
      name: 'Power Tools',
      description: null,
      icon: 'build',
      color: null,
      attributeTemplates: [],
      itemCount: 0,
      createdAt: '',
      modifiedAt: '',
    },
  ];

  const mockLocations: LocationNodeDto[] = [
    {
      id: 'loc-1',
      name: 'Garage Workbench',
      description: null,
      nodeType: LocationNodeTypes.FixedLocation,
      shortCode: 'LOC-001',
      icon: 'garage',
      containerStyle: null,
      primaryColor: null,
      accentColor: null,
      colorLabel: null,
      isPrivate: false,
      ownerId: 'u-1',
      parentId: null,
      fullPath: 'Garage Workbench',
      breadcrumbs: [],
      itemCount: 0,
      childCount: 0,
      createdAt: '',
      modifiedAt: '',
    },
  ];

  const mockItem: ItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Hammer Drill',
    description: null,
    aliases: [],
    tags: [],
    itemType: ItemTypes.Unique,
    status: ItemStatuses.InPlace,
    condition: ItemConditions.Good,
    homeLocationId: 'loc-1',
    homeLocationName: 'Garage Workbench',
    homeLocationShortCode: 'LOC-001',
    homeLocationFullPath: 'Garage Workbench',
    categoryId: 'cat-1',
    categoryName: 'Power Tools',
    parentItemId: null,
    parentItemName: null,
    brand: 'DeWalt',
    modelNumber: 'DCD996B',
    serialNumber: null,
    barcodeNumber: '0885911362757',
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
    lastTouchedAt: '',
    createdAt: '',
    modifiedAt: '',
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  const mockIntakeService = {
    lookupBarcode: vi.fn(),
    createRapidItem: vi.fn(),
  };

  const mockItemService = {
    adjustQuantity: vi.fn(),
    deleteItem: vi.fn(),
  };

  const dialogData: RapidIntakeDialogData = {
    initialLocationId: 'loc-1',
    availableLocations: mockLocations,
    availableCategories: mockCategories,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [RapidIntakeDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: IntakePortabilityService, useValue: mockIntakeService },
        { provide: ItemService, useValue: mockItemService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RapidIntakeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with locked location set to initialLocationId', () => {
    expect(component).toBeTruthy();
    expect(component['lockedLocationId']()).toBe('loc-1');
    expect(component['lockedCategoryId']()).toBeNull();
    expect(component['sessionItems']()).toEqual([]);
  });

  it('should lookup barcode and pre-fill name, brand, model, category', () => {
    const lookup: BarcodeProductLookupDto = {
      barcode: '0885911362757',
      found: true,
      source: 'CuratedCatalog',
      name: 'DeWalt 20V MAX XR Hammer Drill',
      brand: 'DeWalt',
      modelNumber: 'DCD996B',
      matchedCategoryId: 'cat-1',
      suggestedCategoryName: 'Power Tools',
      suggestedItemType: ItemTypes.Unique,
    };

    mockIntakeService.lookupBarcode.mockReturnValue(of(lookup));

    component['form'].patchValue({ barcodeNumber: '0885911362757' });
    component.onBarcodeLookup();

    expect(mockIntakeService.lookupBarcode).toHaveBeenCalledWith('0885911362757');
    expect(component['form'].controls['name'].value).toBe('DeWalt 20V MAX XR Hammer Drill');
    expect(component['form'].controls['brand'].value).toBe('DeWalt');
    expect(component['form'].controls['modelNumber'].value).toBe('DCD996B');
    expect(component['lockedCategoryId']()).toBe('cat-1');
  });

  it('should create item, prepend to sessionItems, and reset form', () => {
    mockIntakeService.createRapidItem.mockReturnValue(of(mockItem));

    component['form'].patchValue({
      name: 'Hammer Drill',
      barcodeNumber: '0885911362757',
      brand: 'DeWalt',
      modelNumber: 'DCD996B',
    });

    component.onSaveAndAddNext();

    expect(mockIntakeService.createRapidItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hammer Drill',
        homeLocationId: 'loc-1',
        barcodeNumber: '0885911362757',
        brand: 'DeWalt',
        modelNumber: 'DCD996B',
      }),
    );

    expect(component['sessionItems']()).toEqual([mockItem]);
    expect(component['form'].controls['name'].value).toBe('');
    expect(component['form'].controls['barcodeNumber'].value).toBe('');
    // Locked location should remain locked
    expect(component['lockedLocationId']()).toBe('loc-1');
  });

  it('should adjust quantity of session item', () => {
    component['sessionItems'].set([
      { ...mockItem, itemType: ItemTypes.Quantity, currentQuantity: 2 },
    ]);
    mockItemService.adjustQuantity.mockReturnValue(of({ ...mockItem, currentQuantity: 3 }));

    component.onAdjustQuantity(component['sessionItems']()[0], 1);

    expect(mockItemService.adjustQuantity).toHaveBeenCalledWith('itm-1', { delta: 1 });
    expect(component['sessionItems']()[0].currentQuantity).toBe(3);
  });

  it('should clone item back into form', () => {
    component.onCloneToForm(mockItem);

    expect(component['form'].controls['name'].value).toBe('Hammer Drill');
    expect(component['form'].controls['brand'].value).toBe('DeWalt');
    expect(component['form'].controls['modelNumber'].value).toBe('DCD996B');
    expect(component['lockedCategoryId']()).toBe('cat-1');
  });

  it('should delete item on undo', () => {
    component['sessionItems'].set([mockItem]);
    mockItemService.deleteItem.mockReturnValue(of(undefined));

    component.onUndoItem(mockItem);

    expect(mockItemService.deleteItem).toHaveBeenCalledWith('itm-1');
    expect(component['sessionItems']()).toEqual([]);
  });

  it('should close dialog with created items on done', () => {
    component['sessionItems'].set([mockItem]);
    component.onClose();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      createdCount: 1,
      items: [mockItem],
    });
  });
});
