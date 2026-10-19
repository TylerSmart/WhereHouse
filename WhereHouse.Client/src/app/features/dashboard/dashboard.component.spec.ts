import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
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
import { LabelGeneratorDialogComponent } from './label-generator-dialog/label-generator-dialog.component';
import { ScannerDialogComponent } from './scanner-dialog/scanner-dialog.component';
import { RapidIntakeDialogComponent } from './rapid-intake-dialog/rapid-intake-dialog.component';
import { ImportExportDialogComponent } from './import-export-dialog/import-export-dialog.component';
import { CheckoutLoadoutService } from '../../core/services/checkout-loadout/checkout-loadout.service';
import { LifecycleService } from '../../core/services/lifecycle/lifecycle.service';
import { DeclutterGraveyardDialogComponent } from './declutter-graveyard-dialog/declutter-graveyard-dialog.component';
import { StageArchiveDialogComponent } from './stage-archive-dialog/stage-archive-dialog.component';
import { MaintenanceDialogComponent } from './maintenance-dialog/maintenance-dialog.component';
import { InsuranceExportDialogComponent } from './insurance-export-dialog/insurance-export-dialog.component';
import { ActionCenterDialogComponent } from './action-center-dialog/action-center-dialog.component';
import { ActionCenterService } from '../../core/services/action-center/action-center.service';

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
    bulkUpdateItems: ReturnType<typeof vi.fn>;
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

  let mockCheckoutLoadoutService: {
    cartItems: ReturnType<typeof vi.fn>;
    addToCart: ReturnType<typeof vi.fn>;
    removeFromCart: ReturnType<typeof vi.fn>;
    clearCart: ReturnType<typeof vi.fn>;
    isInCart: ReturnType<typeof vi.fn>;
    returnItem: ReturnType<typeof vi.fn>;
  };

  let mockLifecycleService: {
    unstageItem: ReturnType<typeof vi.fn>;
  };

  let mockActionCenterService: {
    getOverview: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockLocationService = {
      getTree: vi.fn().mockReturnValue(of(mockTree)),
      getLocations: vi.fn().mockReturnValue(of(mockNodes)),
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      moveLocation: vi.fn().mockReturnValue(of(mockNodes[1])),
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
      bulkUpdateItems: vi.fn().mockReturnValue(of({ updatedCount: 2, updatedItems: [] })),
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

    mockCheckoutLoadoutService = {
      cartItems: vi.fn().mockReturnValue([]),
      addToCart: vi.fn(),
      removeFromCart: vi.fn(),
      clearCart: vi.fn(),
      isInCart: vi.fn().mockReturnValue(false),
      returnItem: vi.fn().mockReturnValue(of(mockItems[0])),
    };

    mockLifecycleService = {
      unstageItem: vi.fn().mockReturnValue(of(mockItems[0])),
    };

    mockActionCenterService = {
      getOverview: vi.fn().mockReturnValue(
        of({
          totalAlertsCount: 2,
          outOfPlaceCount: 1,
          activeLoansCount: 1,
          overdueLoansCount: 0,
          maintenanceDueCount: 0,
          maintenanceOverdueCount: 0,
          expiringCoverageCount: 0,
          lowStockCount: 0,
          outOfPlaceItems: [],
          externalLoans: [],
          dueMaintenanceSchedules: [],
          expiringCoverages: [],
          lowStockItems: [],
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: LocationService, useValue: mockLocationService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: ItemService, useValue: mockItemService },
        { provide: LifecycleService, useValue: mockLifecycleService },
        { provide: ActionCenterService, useValue: mockActionCenterService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CheckoutLoadoutService, useValue: mockCheckoutLoadoutService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue(null),
              },
            },
          },
        },
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
      expect.objectContaining({ width: '680px' }),
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

  it('should open smart search dialog on Ctrl+K keydown', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    component.onGlobalKeydown(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should open item attachments dialog', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openItemAttachmentsDialog(mockItems[0]);

    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should open scanner dialog', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openScannerDialog('BIN-001');

    expect(mockDialog.open).toHaveBeenCalledWith(
      ScannerDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({ initialCode: 'BIN-001' }),
      }),
    );
  });

  it('should open label generator dialog', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openLabelGeneratorDialog();

    expect(mockDialog.open).toHaveBeenCalledWith(
      LabelGeneratorDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          availableLocations: expect.any(Array),
        }),
      }),
    );
  });

  it('should print location label via label generator dialog', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.printLocationLabel(mockNodes[0]);

    expect(mockDialog.open).toHaveBeenCalledWith(
      LabelGeneratorDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          preselectedLabels: [expect.objectContaining({ code: 'LOC-001' })],
        }),
      }),
    );
  });

  it('should print item label via label generator dialog', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.printItemLabel(mockItems[0]);

    expect(mockDialog.open).toHaveBeenCalledWith(
      LabelGeneratorDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          preselectedLabels: [expect.objectContaining({ code: 'ITM-001' })],
        }),
      }),
    );
  });

  it('should open rapid intake dialog and refresh if items created', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of({ createdCount: 2, items: [] }),
    });

    component.openRapidIntakeDialog('loc-1');

    expect(mockDialog.open).toHaveBeenCalledWith(
      RapidIntakeDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          initialLocationId: 'loc-1',
        }),
      }),
    );
  });

  it('should open import export dialog and refresh if imported', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of({ imported: true }),
    });

    component.openImportExportDialog();

    expect(mockDialog.open).toHaveBeenCalledWith(ImportExportDialogComponent, expect.any(Object));
  });

  it('should open clone item dialog with cloneFromItem data', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openCloneItemDialog(mockItems[0]);

    expect(mockDialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          cloneFromItem: mockItems[0],
        }),
      }),
    );
  });

  it('should open declutter graveyard dialog and refresh on close', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(undefined),
    });

    component.openDeclutterGraveyardDialog('staged');

    expect(mockDialog.open).toHaveBeenCalledWith(
      DeclutterGraveyardDialogComponent,
      expect.objectContaining({
        data: { initialTab: 'staged' },
      }),
    );
    expect(mockItemService.getItems).toHaveBeenCalled();
  });

  it('should open stage archive dialog and refresh if changed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.openStageArchiveDialog(mockItems[0], 'stage');

    expect(mockDialog.open).toHaveBeenCalledWith(
      StageArchiveDialogComponent,
      expect.objectContaining({
        data: { item: mockItems[0], initialMode: 'stage' },
      }),
    );
    expect(mockItemService.getItems).toHaveBeenCalled();
  });

  it('should unstage item and refresh', () => {
    component.unstageItem(mockItems[0]);

    expect(mockLifecycleService.unstageItem).toHaveBeenCalledWith(mockItems[0].id);
    expect(mockSnackBar.open).toHaveBeenCalledWith(`Unstaged "${mockItems[0].name}"`, 'Close', {
      duration: 3000,
    });
    expect(mockItemService.getItems).toHaveBeenCalled();
  });

  it('should open maintenance dialog and refresh if closed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.openMaintenanceDialog(mockItems[0]);

    expect(mockDialog.open).toHaveBeenCalledWith(
      MaintenanceDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({ item: mockItems[0] }),
      }),
    );
    expect(mockItemService.getItems).toHaveBeenCalled();
  });

  it('should open insurance export dialog', () => {
    component.openInsuranceExportDialog();

    expect(mockDialog.open).toHaveBeenCalledWith(
      InsuranceExportDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({ availableLocations: mockNodes }),
      }),
    );
  });

  it('should open action center dialog and refresh if closed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.openActionCenterDialog('loans', 'alerts');

    expect(mockDialog.open).toHaveBeenCalledWith(
      ActionCenterDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          initialFilter: 'loans',
          initialTab: 'alerts',
        }),
      }),
    );
    expect(mockActionCenterService.getOverview).toHaveBeenCalled();
  });

  describe('Phase 10: Responsive UX, Bulk Actions & Tree Drag-and-Drop', () => {
    it('should switch itemViewMode between grid and table', () => {
      expect(component.itemViewMode()).toBe('grid');
      component.setItemViewMode('table');
      expect(component.itemViewMode()).toBe('table');
      component.setItemViewMode('grid');
      expect(component.itemViewMode()).toBe('grid');
    });

    it('should toggle item selection and update computed counts', () => {
      expect(component.selectedItemsCount()).toBe(0);
      expect(component.isItemSelected('itm-1')).toBe(false);

      component.toggleItemSelection('itm-1', true);
      expect(component.selectedItemsCount()).toBe(1);
      expect(component.isItemSelected('itm-1')).toBe(true);

      component.toggleItemSelection('itm-1', false);
      expect(component.selectedItemsCount()).toBe(0);
      expect(component.isItemSelected('itm-1')).toBe(false);
    });

    it('should select all and clear all displayed items', () => {
      component.selectNode('loc-1');
      expect(component.allDisplayedItemsSelected()).toBe(false);

      component.toggleSelectAllDisplayed();
      expect(component.allDisplayedItemsSelected()).toBe(true);
      expect(component.selectedItemsCount()).toBe(1);

      component.clearItemSelection();
      expect(component.selectedItemsCount()).toBe(0);
      expect(component.allDisplayedItemsSelected()).toBe(false);
    });

    it('should execute bulk move and refresh', () => {
      component.toggleItemSelection('itm-1', true);
      component.bulkTargetLocationId.set('loc-2');

      component.executeBulkMove();

      expect(mockItemService.bulkUpdateItems).toHaveBeenCalledWith({
        itemIds: ['itm-1'],
        updateHomeLocation: true,
        targetHomeLocationId: 'loc-2',
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Moved 2 item(s)'),
        'Close',
        expect.any(Object),
      );
      expect(component.showBulkMoveBar()).toBe(false);
      expect(component.selectedItemsCount()).toBe(0);
    });

    it('should execute bulk tag and refresh', () => {
      component.toggleItemSelection('itm-1', true);
      component.bulkTagInput.set('Fragile');

      component.executeBulkTag('add');

      expect(mockItemService.bulkUpdateItems).toHaveBeenCalledWith({
        itemIds: ['itm-1'],
        addTags: ['Fragile'],
        removeTags: undefined,
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Added tag to 2 item(s)'),
        'Close',
        expect.any(Object),
      );
      expect(component.bulkTagInput()).toBe('');
      expect(component.showBulkTagBar()).toBe(false);
    });

    it('should execute drag and drop reparenting via dropNodeOnTarget', () => {
      component.dropNodeOnTarget('loc-2', 'loc-1');

      expect(mockLocationService.moveLocation).toHaveBeenCalledWith('loc-2', {
        newParentId: 'loc-1',
      });
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Moved "Winter Camping Bin" into "Garage"'),
        'Close',
        expect.any(Object),
      );
      expect(mockLocationService.getTree).toHaveBeenCalled();
    });
  });
});
