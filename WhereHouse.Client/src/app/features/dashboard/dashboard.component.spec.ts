import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { CategoryDto } from '../../core/models/category.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../core/models/item.models';
import {
  LocationNodeDto,
  LocationNodeTypes,
  LocationTreeNodeDto,
} from '../../core/models/location.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { CategoryService } from '../../core/services/category/category.service';
import { ItemService } from '../../core/services/item/item.service';
import { LocationService } from '../../core/services/location/location.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { CategoryManagerDialogComponent } from './category-manager-dialog/category-manager-dialog.component';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockNodes: LocationNodeDto[] = [
    {
      id: 'loc-1',
      parentId: null,
      name: 'Garage',
      description: 'Main Garage',
      nodeType: LocationNodeTypes.FixedLocation,
      shortCode: 'LOC-001',
      icon: 'garage',
      containerStyle: null,
      primaryColor: null,
      accentColor: null,
      colorLabel: null,
      isPrivate: false,
      ownerId: 'u-1',
      fullPath: 'Garage',
      breadcrumbs: [
        {
          id: 'loc-1',
          name: 'Garage',
          shortCode: 'LOC-001',
          nodeType: LocationNodeTypes.FixedLocation,
        },
      ],
      childCount: 1,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
    {
      id: 'loc-2',
      parentId: 'loc-1',
      name: 'Winter Camping Bin',
      description: 'Yellow lid tote',
      nodeType: LocationNodeTypes.MovableContainer,
      shortCode: 'BIN-001',
      icon: 'inventory_2',
      containerStyle: '27-Gal Heavy Duty Tote',
      primaryColor: '#1f2937',
      accentColor: '#eab308',
      colorLabel: 'Black Base / Yellow Lid',
      isPrivate: false,
      ownerId: 'u-1',
      fullPath: 'Garage > Winter Camping Bin',
      breadcrumbs: [
        {
          id: 'loc-1',
          name: 'Garage',
          shortCode: 'LOC-001',
          nodeType: LocationNodeTypes.FixedLocation,
        },
        {
          id: 'loc-2',
          name: 'Winter Camping Bin',
          shortCode: 'BIN-001',
          nodeType: LocationNodeTypes.MovableContainer,
        },
      ],
      childCount: 0,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
  ];

  const mockTree: LocationTreeNodeDto[] = [
    {
      id: 'loc-1',
      parentId: null,
      name: 'Garage',
      nodeType: LocationNodeTypes.FixedLocation,
      shortCode: 'LOC-001',
      icon: 'garage',
      containerStyle: null,
      primaryColor: null,
      accentColor: null,
      colorLabel: null,
      isPrivate: false,
      ownerId: 'u-1',
      fullPath: 'Garage',
      children: [
        {
          id: 'loc-2',
          parentId: 'loc-1',
          name: 'Winter Camping Bin',
          nodeType: LocationNodeTypes.MovableContainer,
          shortCode: 'BIN-001',
          icon: 'inventory_2',
          containerStyle: '27-Gal Heavy Duty Tote',
          primaryColor: '#1f2937',
          accentColor: '#eab308',
          colorLabel: 'Black Base / Yellow Lid',
          isPrivate: false,
          ownerId: 'u-1',
          fullPath: 'Garage > Winter Camping Bin',
          children: [],
        },
      ],
    },
  ];

  const mockCategories: CategoryDto[] = [
    {
      id: 'cat-1',
      parentId: null,
      name: 'Power Tools',
      description: null,
      icon: 'handyman',
      color: null,
      attributeTemplates: [],
      itemCount: 1,
      createdAt: '',
      modifiedAt: '',
    },
  ];

  const mockItems: ItemDto[] = [
    {
      id: 'itm-1',
      shortCode: 'ITM-001',
      name: 'Cordless Drill',
      itemType: ItemTypes.Unique,
      status: ItemStatuses.InPlace,
      condition: ItemConditions.Good,
      homeLocationId: 'loc-1',
      homeLocationName: 'Garage',
      homeLocationShortCode: 'LOC-001',
      homeLocationFullPath: 'Garage',
      categoryId: 'cat-1',
      categoryName: 'Power Tools',
      parentItemId: null,
      parentItemName: null,
      brand: 'Makita',
      modelNumber: 'XFD13',
      serialNumber: 'SN-100',
      description: 'Brushless drill',
      aliases: ['Driver'],
      tags: ['tools'],
      currentQuantity: 1,
      minQuantity: null,
      unit: null,
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
    },
    {
      id: 'itm-2',
      shortCode: 'ITM-002',
      name: 'AA Batteries',
      itemType: ItemTypes.Quantity,
      status: ItemStatuses.InPlace,
      condition: ItemConditions.New,
      homeLocationId: 'loc-2',
      homeLocationName: 'Winter Camping Bin',
      homeLocationShortCode: 'BIN-001',
      homeLocationFullPath: 'Garage > Winter Camping Bin',
      categoryId: null,
      categoryName: null,
      parentItemId: null,
      parentItemName: null,
      brand: 'Eneloop',
      modelNumber: null,
      serialNumber: null,
      description: 'Rechargeables',
      aliases: [],
      tags: ['batteries'],
      currentQuantity: 12,
      minQuantity: 4,
      unit: 'packs',
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
    },
  ];

  let mockLocationService: {
    getTree: ReturnType<typeof vi.fn>;
    getLocations: ReturnType<typeof vi.fn>;
    createLocation: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    moveLocation: ReturnType<typeof vi.fn>;
    deleteLocation: ReturnType<typeof vi.fn>;
  };

  let mockCategoryService: {
    getCategories: ReturnType<typeof vi.fn>;
    createCategory: ReturnType<typeof vi.fn>;
    updateCategory: ReturnType<typeof vi.fn>;
    deleteCategory: ReturnType<typeof vi.fn>;
  };

  let mockItemService: {
    getItems: ReturnType<typeof vi.fn>;
    getItem: ReturnType<typeof vi.fn>;
    createItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    adjustQuantity: ReturnType<typeof vi.fn>;
    duplicateItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockLocationService = {
      getTree: vi.fn().mockReturnValue(of(mockTree)),
      getLocations: vi.fn().mockReturnValue(of(mockNodes)),
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      moveLocation: vi.fn(),
      deleteLocation: vi.fn().mockReturnValue(of(undefined)),
    };

    mockCategoryService = {
      getCategories: vi.fn().mockReturnValue(of(mockCategories)),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn().mockReturnValue(of(undefined)),
    };

    mockItemService = {
      getItems: vi.fn().mockReturnValue(of(mockItems)),
      getItem: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      adjustQuantity: vi.fn(),
      duplicateItem: vi.fn(),
      deleteItem: vi.fn().mockReturnValue(of(undefined)),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'u-1',
        email: 'alice@example.com',
        username: 'alice',
      }),
      logout: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: LocationService, useValue: mockLocationService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: ItemService, useValue: mockItemService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        ThemeService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load tree, locations, categories, and items', () => {
    expect(component).toBeTruthy();
    expect(mockLocationService.getTree).toHaveBeenCalled();
    expect(mockLocationService.getLocations).toHaveBeenCalled();
    expect(mockCategoryService.getCategories).toHaveBeenCalled();
    expect(mockItemService.getItems).toHaveBeenCalled();
    expect(component['allNodes']().length).toBe(2);
    expect(component['treeNodes']().length).toBe(1);
    expect(component['categories']().length).toBe(1);
    expect(component['items']().length).toBe(2);
  });

  it('should display root nodes and items when no parent is selected', () => {
    expect(component['selectedNodeId']()).toBeNull();
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Garage');
  });

  it('should filter nodes based on search query across all depths', () => {
    component['searchQuery'].set('Yellow Lid');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Winter Camping Bin');

    component['searchQuery'].set('nonexistent');
    expect(component['displayedNodes']().length).toBe(0);
  });

  it('should filter nodes by node type', () => {
    component['searchQuery'].set('a'); // Matches both Garage and Winter Camping Bin
    component.setFilterType('fixed');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Garage');

    component.setFilterType('container');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Winter Camping Bin');
  });

  it('should filter items based on search query', () => {
    component['searchQuery'].set('Makita');
    expect(component['displayedItems']().length).toBe(1);
    expect(component['displayedItems']()[0].name).toBe('Cordless Drill');

    component['searchQuery'].set('batteries');
    expect(component['displayedItems']().length).toBe(1);
    expect(component['displayedItems']()[0].name).toBe('AA Batteries');
  });

  it('should filter items inside selected location', () => {
    component.selectNode('loc-1');
    expect(component['selectedNodeId']()).toBe('loc-1');
    expect(component['displayedItems']().length).toBe(1);
    expect(component['displayedItems']()[0].name).toBe('Cordless Drill');

    component.selectNode('loc-2');
    expect(component['displayedItems']().length).toBe(1);
    expect(component['displayedItems']()[0].name).toBe('AA Batteries');
  });

  it('should open category manager dialog', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openCategoryManagerDialog();

    expect(mockDialog.open).toHaveBeenCalledWith(
      CategoryManagerDialogComponent,
      expect.objectContaining({ width: '720px' }),
    );
  });

  it('should adjust item quantity on stepper click', () => {
    const updated = { ...mockItems[1], currentQuantity: 13 };
    mockItemService.adjustQuantity.mockReturnValue(of(updated));

    const mouseEvent = new MouseEvent('click');
    const stopPropagationSpy = vi.spyOn(mouseEvent, 'stopPropagation');

    component.adjustItemQuantity(mockItems[1], 1, mouseEvent);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(mockItemService.adjustQuantity).toHaveBeenCalledWith('itm-2', { delta: 1 });
    const itm = component['items']().find((i) => i.id === 'itm-2');
    expect(itm?.currentQuantity).toBe(13);
  });

  it('should duplicate item when triggered', () => {
    const cloned = {
      ...mockItems[0],
      id: 'itm-clone',
      shortCode: 'ITM-003',
      name: 'Cordless Drill (Copy)',
    };
    mockItemService.duplicateItem.mockReturnValue(of(cloned));

    component.openDuplicateItemDialog(mockItems[0]);

    expect(mockItemService.duplicateItem).toHaveBeenCalledWith('itm-1');
    expect(mockSnackBar.open).toHaveBeenCalled();
  });

  it('should delete location when confirmed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.deleteNode(mockNodes[0]);

    expect(mockLocationService.deleteLocation).toHaveBeenCalledWith('loc-1');
    expect(mockSnackBar.open).toHaveBeenCalled();
  });

  it('should delete item when confirmed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.deleteItem(mockItems[0]);

    expect(mockItemService.deleteItem).toHaveBeenCalledWith('itm-1');
    expect(mockSnackBar.open).toHaveBeenCalled();
  });
});
