import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { AttributeFieldTypes, CategoryDto } from '../../../core/models/category.models';
import { BarcodeProductLookupDto } from '../../../core/models/intake-portability.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { LocationNodeDto, LocationNodeTypes } from '../../../core/models/location.models';
import { IntakePortabilityService } from '../../../core/services/intake-portability/intake-portability.service';
import { ItemDialogComponent, ItemDialogData } from './item-dialog.component';

describe('ItemDialogComponent', () => {
  let component: ItemDialogComponent;
  let fixture: ComponentFixture<ItemDialogComponent>;

  const mockCategories: CategoryDto[] = [
    {
      id: 'cat-1',
      parentId: null,
      name: 'Electronics',
      description: null,
      icon: 'bolt',
      color: null,
      attributeTemplates: [
        {
          id: 'tmpl-1',
          categoryId: 'cat-1',
          name: 'Voltage',
          fieldType: AttributeFieldTypes.Number,
          unit: 'V',
          isRequired: false,
          options: [],
          sortOrder: 0,
        },
      ],
      itemCount: 0,
      createdAt: '',
      modifiedAt: '',
    },
  ];

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  const mockIntakeService = {
    lookupBarcode: vi.fn(),
  };

  const defaultLocations: LocationNodeDto[] = [
    {
      id: 'loc-1',
      name: 'Workshop Shelf A',
      description: null,
      nodeType: LocationNodeTypes.FixedLocation,
      shortCode: 'LOC-001',
      icon: 'shelves',
      containerStyle: null,
      primaryColor: null,
      accentColor: null,
      colorLabel: null,
      isPrivate: false,
      ownerId: 'u-1',
      parentId: null,
      fullPath: 'Workshop Shelf A',
      breadcrumbs: [],
      itemCount: 0,
      childCount: 0,
      createdAt: '',
      modifiedAt: '',
    },
  ];

  const defaultDialogData: ItemDialogData = {
    availableCategories: mockCategories,
    availableLocations: defaultLocations,
    availableParentItems: [],
    homeLocationId: 'loc-1',
  };

  const setupTestBed = async (data: ItemDialogData = defaultDialogData) => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ItemDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: IntakePortabilityService, useValue: mockIntakeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('Create Mode', () => {
    beforeEach(async () => {
      await setupTestBed();
    });

    it('should create with default values and home location', () => {
      expect(component).toBeTruthy();
      expect(component['isEditMode']).toBe(false);
      expect(component['isCloneMode']).toBe(false);
      expect(component['form'].controls['homeLocationId'].value).toBe('loc-1');
      expect(component['form'].controls['itemType'].value).toBe(ItemTypes.Unique);
    });

    it('should submit CreateItemRequest when form is valid', () => {
      component['form'].patchValue({
        name: 'Multimeter',
        itemType: ItemTypes.Unique,
        categoryId: 'cat-1',
        aliasesString: 'Tester, Volt meter',
        tagsString: 'tools, electric',
        barcodeNumber: '0885911362757',
      });

      component.onSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'create',
          request: expect.objectContaining({
            name: 'Multimeter',
            itemType: ItemTypes.Unique,
            categoryId: 'cat-1',
            aliases: ['Tester', 'Volt meter'],
            tags: ['tools', 'electric'],
            barcodeNumber: '0885911362757',
          }),
        }),
      );
    });

    it('should not submit if form is invalid', () => {
      component['form'].patchValue({
        name: '',
      });

      component.onSubmit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should lookup barcode and auto-populate fields', () => {
      const lookupResult: BarcodeProductLookupDto = {
        barcode: '0885911362757',
        found: true,
        source: 'CuratedCatalog',
        name: 'DeWalt 20V MAX XR Hammer Drill',
        brand: 'DeWalt',
        modelNumber: 'DCD996B',
        suggestedCategoryName: 'Electronics',
        matchedCategoryId: 'cat-1',
        suggestedItemType: ItemTypes.Unique,
      };

      mockIntakeService.lookupBarcode.mockReturnValue(of(lookupResult));

      component['form'].patchValue({ barcodeNumber: '0885911362757' });
      component.onLookupBarcode();

      expect(mockIntakeService.lookupBarcode).toHaveBeenCalledWith('0885911362757');
      expect(component['form'].controls['name'].value).toBe('DeWalt 20V MAX XR Hammer Drill');
      expect(component['form'].controls['brand'].value).toBe('DeWalt');
      expect(component['form'].controls['modelNumber'].value).toBe('DCD996B');
      expect(component['form'].controls['categoryId'].value).toBe('cat-1');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('DeWalt 20V MAX XR Hammer Drill'),
        'OK',
        expect.any(Object),
      );
    });
  });

  describe('Clone Mode', () => {
    const cloneItem: ItemDto = {
      id: 'itm-source',
      shortCode: 'ITM-999',
      name: 'Soldering Iron',
      itemType: ItemTypes.Unique,
      status: ItemStatuses.InPlace,
      condition: ItemConditions.Good,
      homeLocationId: 'loc-1',
      homeLocationName: 'Workshop Shelf A',
      homeLocationShortCode: 'LOC-001',
      homeLocationFullPath: 'Workshop Shelf A',
      categoryId: 'cat-1',
      categoryName: 'Electronics',
      parentItemId: null,
      parentItemName: null,
      brand: 'Hakko',
      modelNumber: 'FX-888D',
      serialNumber: 'SN-CLONE-ME',
      barcodeNumber: '123456789012',
      description: 'Digital soldering station',
      aliases: ['Solderer'],
      tags: ['electronics', 'soldering'],
      currentQuantity: 1,
      minQuantity: null,
      unit: null,
      purchaseDate: '2025-01-15T00:00:00Z',
      retailer: 'Amazon',
      purchasePrice: 105.0,
      estimatedReplacementValue: 110.0,
      returnWindowEndDate: null,
      warrantyExpirationDate: null,
      warrantyNotes: null,
      isPrivate: false,
      ownerId: 'u-1',
      isLowStock: false,
      isIncompleteKit: false,
      incompleteKitWarnings: [],
      childItems: [],
      lastTouchedAt: '',
      attributeValues: [],
      createdAt: '',
      modifiedAt: '',
    };

    beforeEach(async () => {
      await setupTestBed({
        ...defaultDialogData,
        cloneFromItem: cloneItem,
      });
    });

    it('should pre-populate form with cloned item details and append (Copy) to name', () => {
      expect(component['isCloneMode']).toBe(true);
      expect(component['isEditMode']).toBe(false);
      expect(component['form'].controls['name'].value).toBe('Soldering Iron (Copy)');
      expect(component['form'].controls['brand'].value).toBe('Hakko');
      expect(component['form'].controls['modelNumber'].value).toBe('FX-888D');
      expect(component['form'].controls['barcodeNumber'].value).toBe('123456789012');
      // Serial number should be cleared on clone
      expect(component['form'].controls['serialNumber'].value).toBe('');
      // Short code should be cleared for sequential auto-gen
      expect(component['form'].controls['shortCode'].value).toBe('');
    });

    it('should submit in create mode for cloned item', () => {
      component.onSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'create',
          request: expect.objectContaining({
            name: 'Soldering Iron (Copy)',
            brand: 'Hakko',
            modelNumber: 'FX-888D',
            barcodeNumber: '123456789012',
          }),
        }),
      );
    });
  });

  describe('Edit Mode', () => {
    const existingItem: ItemDto = {
      id: 'itm-1',
      shortCode: 'ITM-001',
      name: 'Drill Driver',
      itemType: ItemTypes.Unique,
      status: ItemStatuses.InPlace,
      condition: ItemConditions.Good,
      homeLocationId: 'loc-1',
      homeLocationName: 'Workshop Shelf A',
      homeLocationShortCode: 'LOC-001',
      homeLocationFullPath: 'Workshop Shelf A',
      categoryId: 'cat-1',
      categoryName: 'Electronics',
      parentItemId: null,
      parentItemName: null,
      brand: 'Makita',
      modelNumber: 'XFD13',
      serialNumber: 'SN-9988',
      barcodeNumber: '0045242507979',
      description: 'Brushless drill',
      aliases: ['Driver'],
      tags: ['power-tools'],
      currentQuantity: 1,
      minQuantity: null,
      unit: null,
      purchaseDate: '2025-01-15T00:00:00Z',
      retailer: 'Home Depot',
      purchasePrice: 129.99,
      estimatedReplacementValue: 140.0,
      returnWindowEndDate: null,
      warrantyExpirationDate: null,
      warrantyNotes: null,
      isPrivate: false,
      ownerId: 'u-1',
      isLowStock: false,
      isIncompleteKit: false,
      incompleteKitWarnings: [],
      childItems: [],
      lastTouchedAt: '',
      attributeValues: [
        {
          id: 'val-1',
          attributeTemplateId: 'tmpl-1',
          attributeName: 'Voltage',
          fieldType: AttributeFieldTypes.Number,
          unit: 'V',
          value: '18',
        },
      ],
      createdAt: '',
      modifiedAt: '',
    };

    beforeEach(async () => {
      await setupTestBed({
        ...defaultDialogData,
        item: existingItem,
      });
    });

    it('should populate form in edit mode and include dynamic attribute value', () => {
      expect(component['isEditMode']).toBe(true);
      expect(component['isCloneMode']).toBe(false);
      expect(component['form'].controls['name'].value).toBe('Drill Driver');
      expect(component['form'].controls['barcodeNumber'].value).toBe('0045242507979');
      expect(component.attributeValuesArray.length).toBe(1);
      expect(component.attributeValuesArray.at(0).get('value')?.value).toBe('18');
    });

    it('should submit UpdateItemRequest on save', () => {
      component['form'].patchValue({
        name: 'Drill Driver Updated',
      });

      component.onSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'update',
          request: expect.objectContaining({
            name: 'Drill Driver Updated',
            brand: 'Makita',
            barcodeNumber: '0045242507979',
          }),
        }),
      );
    });
  });
});
