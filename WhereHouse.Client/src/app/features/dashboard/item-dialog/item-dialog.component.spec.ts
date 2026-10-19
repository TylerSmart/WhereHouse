import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AttributeFieldTypes, CategoryDto } from '../../../core/models/category.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { LocationNodeDto, LocationNodeTypes } from '../../../core/models/location.models';
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
      expect(component['form'].controls['name'].value).toBe('Drill Driver');
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
          }),
        }),
      );
    });
  });
});
