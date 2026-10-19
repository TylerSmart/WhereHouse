import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { SmartSearchResponseDto } from '../../../core/models/search.models';
import { LifecycleService } from '../../../core/services/lifecycle/lifecycle.service';
import { SearchService } from '../../../core/services/search/search.service';
import { SmartSearchDialogComponent, SmartSearchDialogData } from './smart-search-dialog.component';

describe('SmartSearchDialogComponent', () => {
  let component: SmartSearchDialogComponent;
  let fixture: ComponentFixture<SmartSearchDialogComponent>;
  let mockSearchService: {
    search: ReturnType<typeof vi.fn>;
  };
  let mockLifecycleService: {
    restoreArchivedItem: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  const mockItem: ItemDto = {
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
    homeLocationName: 'Garage',
    homeLocationShortCode: 'LOC-001',
    homeLocationFullPath: 'Garage',
    categoryId: null,
    categoryName: null,
    parentItemId: null,
    parentItemName: null,
    brand: 'DeWalt',
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

  const mockResponse: SmartSearchResponseDto = {
    query: 'drill',
    locations: [
      {
        id: 'loc-1',
        parentId: null,
        name: 'Garage',
        description: null,
        nodeType: 0,
        shortCode: 'LOC-001',
        icon: null,
        containerStyle: null,
        primaryColor: null,
        accentColor: null,
        colorLabel: null,
        isPrivate: false,
        fullPath: 'Garage',
        itemCount: 1,
        childCount: 0,
      },
    ],
    activeItems: [mockItem],
    archivedItems: [],
    totalCount: 1,
  };

  const dialogData: SmartSearchDialogData = {
    availableLocations: [],
    availableCategories: [],
    initialQuery: 'drill',
  };

  beforeEach(async () => {
    mockSearchService = {
      search: vi.fn().mockReturnValue(of(mockResponse)),
    };
    mockLifecycleService = {
      restoreArchivedItem: vi.fn().mockReturnValue(of(mockItem)),
    };
    mockDialogRef = {
      close: vi.fn(),
    };
    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SmartSearchDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: SearchService, useValue: mockSearchService },
        { provide: LifecycleService, useValue: mockLifecycleService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SmartSearchDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and execute initial search', () => {
    expect(component).toBeTruthy();
    expect(mockSearchService.search).toHaveBeenCalled();
    expect(component['results']()).toEqual(mockResponse);
  });

  it('should close dialog with location selection action', () => {
    component.chooseLocation('loc-1');
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: 'selectLocation',
      locationId: 'loc-1',
    });
  });

  it('should close dialog with edit item action', () => {
    component.editItem(mockItem);
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: 'editItem',
      item: mockItem,
    });
  });

  it('should close dialog with open attachments action', () => {
    component.openAttachments(mockItem);
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: 'openAttachments',
      item: mockItem,
    });
  });

  it('should restore archived item and re-execute search', () => {
    component.restoreItem(mockItem);
    expect(mockLifecycleService.restoreArchivedItem).toHaveBeenCalledWith('itm-1');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Restored Cordless Drill to Home Bin!',
      'Close',
      {
        duration: 3000,
      },
    );
    expect(mockSearchService.search).toHaveBeenCalledTimes(2);
  });
});
