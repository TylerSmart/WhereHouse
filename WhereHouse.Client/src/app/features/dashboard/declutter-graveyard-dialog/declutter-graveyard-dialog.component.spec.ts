import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  DispositionReasons,
  ItemConditions,
  ItemDto,
  ItemStatuses,
  ItemTypes,
} from '../../../core/models/item.models';
import {
  DeclutterStagingSummaryDto,
  DustCollectorInsightsDto,
  GraveyardSummaryDto,
} from '../../../core/models/lifecycle.models';
import { LifecycleService } from '../../../core/services/lifecycle/lifecycle.service';
import {
  DeclutterGraveyardDialogComponent,
  DeclutterGraveyardDialogData,
} from './declutter-graveyard-dialog.component';

describe('DeclutterGraveyardDialogComponent', () => {
  let component: DeclutterGraveyardDialogComponent;
  let fixture: ComponentFixture<DeclutterGraveyardDialogComponent>;
  let mockLifecycleService: Partial<LifecycleService>;
  let mockDialogRef: Partial<MatDialogRef<DeclutterGraveyardDialogComponent>>;
  let mockSnackBar: Partial<MatSnackBar>;
  let mockDialog: Partial<MatDialog>;

  const mockItem: ItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Vintage Camera',
    description: null,
    aliases: [],
    tags: [],
    itemType: ItemTypes.Unique,
    status: ItemStatuses.StagedToSell,
    condition: ItemConditions.Good,
    homeLocationId: 'loc-1',
    homeLocationName: 'Living Room Shelf',
    homeLocationShortCode: 'LOC-001',
    homeLocationFullPath: 'Living Room > Shelf',
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
    estimatedReplacementValue: 50,
    returnWindowEndDate: null,
    warrantyExpirationDate: null,
    warrantyNotes: null,
    isPrivate: false,
    ownerId: 'u-1',
    attributeValues: [],
    childItems: [],
    stagingTargetPrice: 45,
    stagingListingNotes: 'Mint condition',
    lastTouchedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
  };

  const mockStagedSummary: DeclutterStagingSummaryDto = {
    totalStagedCount: 1,
    stagedToSellCount: 1,
    stagedToDonateCount: 0,
    totalTargetResaleValue: 45,
    totalEstimatedDonationValue: 0,
    items: [mockItem],
  };

  const mockDustInsights: DustCollectorInsightsDto = {
    minUntouchedDays: 180,
    cutoffDate: '2026-04-01T00:00:00Z',
    totalItemsCount: 1,
    totalEstimatedValue: 50,
    locationGroups: [
      {
        locationId: 'loc-1',
        locationName: 'Living Room Shelf',
        locationShortCode: 'LOC-001',
        locationFullPath: 'Living Room > Shelf',
        itemCount: 1,
        groupEstimatedValue: 50,
        items: [
          {
            item: mockItem,
            daysUntouched: 290,
            estimatedValue: 50,
          },
        ],
      },
    ],
  };

  const mockGraveyardSummary: GraveyardSummaryDto = {
    totalArchivedCount: 1,
    soldCount: 1,
    donatedCount: 0,
    recycledCount: 0,
    brokenTrashedCount: 0,
    consumedCount: 0,
    totalSaleProceeds: 40,
    totalDonatedEstimatedValue: 0,
    items: [
      {
        ...mockItem,
        status: ItemStatuses.Archived,
        dispositionReason: DispositionReasons.Sold,
        dispositionNote: 'Sold on eBay',
        salePrice: 40,
        archivedAt: '2026-10-01T00:00:00Z',
      },
    ],
  };

  const dialogData: DeclutterGraveyardDialogData = {
    initialTab: 'staged',
  };

  beforeEach(async () => {
    mockLifecycleService = {
      getStagedItems: vi.fn().mockReturnValue(of(mockStagedSummary)),
      getDustCollectors: vi.fn().mockReturnValue(of(mockDustInsights)),
      getGraveyardItems: vi.fn().mockReturnValue(of(mockGraveyardSummary)),
      bulkArchiveItems: vi.fn().mockReturnValue(of({ processedCount: 1, items: [mockItem] })),
      bulkUnstageItems: vi.fn().mockReturnValue(of({ processedCount: 1, items: [mockItem] })),
      unstageItem: vi.fn().mockReturnValue(of(mockItem)),
      stageItem: vi.fn().mockReturnValue(of(mockItem)),
      touchItem: vi.fn().mockReturnValue(of(mockItem)),
      restoreArchivedItem: vi.fn().mockReturnValue(of(mockItem)),
    };
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(true)),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DeclutterGraveyardDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: LifecycleService, useValue: mockLifecycleService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeclutterGraveyardDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and loads staged items on init', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('staged');
    expect(mockLifecycleService.getStagedItems).toHaveBeenCalled();
    expect(component.stagedSummary()).toEqual(mockStagedSummary);
  });

  it('switches tabs to dust collectors and loads insights', () => {
    component.switchTab('dust');
    expect(component.activeTab()).toBe('dust');
    expect(mockLifecycleService.getDustCollectors).toHaveBeenCalledWith(365);
    expect(component.dustInsights()).toEqual(mockDustInsights);
  });

  it('switches tabs to graveyard and loads summary', () => {
    component.switchTab('graveyard');
    expect(component.activeTab()).toBe('graveyard');
    expect(mockLifecycleService.getGraveyardItems).toHaveBeenCalled();
    expect(component.graveyardSummary()).toEqual(mockGraveyardSummary);
  });

  it('performs bulk unstaging of selected items', () => {
    component.toggleStagedSelection('itm-1');
    expect(component.selectedStagedIds().has('itm-1')).toBe(true);

    component.executeBulkUnstage();
    expect(mockLifecycleService.bulkUnstageItems).toHaveBeenCalledWith({ itemIds: ['itm-1'] });
    expect(mockSnackBar.open).toHaveBeenCalledWith('Unstaged 1 item(s) back In Place.', 'Close', {
      duration: 3000,
    });
  });

  it('quick stages item to sell from dust collectors', () => {
    component.quickStageToSell(mockItem);
    expect(mockLifecycleService.stageItem).toHaveBeenCalledWith(
      'itm-1',
      expect.objectContaining({ isToSell: true }),
    );
    expect(mockSnackBar.open).toHaveBeenCalledWith('Staged to Sell: Vintage Camera', 'Close', {
      duration: 3000,
    });
  });

  it('quick touches an item to reset untouched timer', () => {
    component.quickTouch(mockItem);
    expect(mockLifecycleService.touchItem).toHaveBeenCalledWith('itm-1');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Reset untouched timer for Vintage Camera',
      'Close',
      { duration: 3000 },
    );
  });

  it('quick restores an archived item to home bin', () => {
    component.quickRestore(mockItem);
    expect(mockLifecycleService.restoreArchivedItem).toHaveBeenCalledWith('itm-1');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Restored Vintage Camera to Home Bin!',
      'Close',
      { duration: 3000 },
    );
  });
});
