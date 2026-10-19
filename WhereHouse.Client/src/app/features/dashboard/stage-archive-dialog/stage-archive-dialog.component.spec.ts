import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  DispositionReasons,
  ItemConditions,
  ItemDto,
  ItemStatuses,
  ItemTypes,
} from '../../../core/models/item.models';
import { LifecycleService } from '../../../core/services/lifecycle/lifecycle.service';
import {
  StageArchiveDialogComponent,
  StageArchiveDialogData,
} from './stage-archive-dialog.component';

describe('StageArchiveDialogComponent', () => {
  let component: StageArchiveDialogComponent;
  let fixture: ComponentFixture<StageArchiveDialogComponent>;
  let mockLifecycleService: Partial<LifecycleService>;
  let mockDialogRef: Partial<MatDialogRef<StageArchiveDialogComponent>>;
  let mockSnackBar: Partial<MatSnackBar>;

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
    estimatedReplacementValue: 120,
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

  const dialogData: StageArchiveDialogData = {
    item: mockItem,
    initialMode: 'stage',
  };

  beforeEach(async () => {
    mockLifecycleService = {
      stageItem: vi.fn().mockReturnValue(of(mockItem)),
      unstageItem: vi.fn().mockReturnValue(of(mockItem)),
      archiveItem: vi.fn().mockReturnValue(of(mockItem)),
      restoreArchivedItem: vi.fn().mockReturnValue(of(mockItem)),
    };
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StageArchiveDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: LifecycleService, useValue: mockLifecycleService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StageArchiveDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates in stage mode with prefilled estimated price', () => {
    expect(component).toBeTruthy();
    expect(component.mode()).toBe('stage');
    expect(component.isToSell()).toBe(true);
    expect(component.targetPrice()).toBe(120);
  });

  it('submits stage request', () => {
    component.targetPrice.set(95);
    component.listingNotes.set('List on FB');
    component.submitStage();

    expect(mockLifecycleService.stageItem).toHaveBeenCalledWith('itm-1', {
      isToSell: true,
      targetPrice: 95,
      listingNotes: 'List on FB',
    });
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('submits archive request', () => {
    component.mode.set('archive');
    component.dispositionReason.set(DispositionReasons.Sold);
    component.salePrice.set(90);
    component.dispositionNote.set('Sold to neighbor');
    component.submitArchive();

    expect(mockLifecycleService.archiveItem).toHaveBeenCalledWith('itm-1', {
      dispositionReason: DispositionReasons.Sold,
      dispositionNote: 'Sold to neighbor',
      salePrice: 90,
    });
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });
});
