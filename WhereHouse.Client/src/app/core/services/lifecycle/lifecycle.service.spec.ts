import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  DispositionReasons,
  ItemConditions,
  ItemDto,
  ItemStatuses,
  ItemTypes,
} from '../../models/item.models';
import {
  ArchiveItemRequest,
  BulkArchiveRequest,
  BulkUnstageRequest,
  DeclutterStagingSummaryDto,
  DustCollectorInsightsDto,
  GraveyardSummaryDto,
  StageItemRequest,
} from '../../models/lifecycle.models';
import { LifecycleService } from './lifecycle.service';

describe('LifecycleService', () => {
  let service: LifecycleService;
  let httpTesting: HttpTestingController;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LifecycleService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LifecycleService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets staged items summary', () => {
    const mockSummary: DeclutterStagingSummaryDto = {
      totalStagedCount: 1,
      stagedToSellCount: 1,
      stagedToDonateCount: 0,
      totalTargetResaleValue: 50,
      totalEstimatedDonationValue: 0,
      items: [mockItem],
    };

    service.getStagedItems(ItemStatuses.StagedToSell, 'loc-1').subscribe((res) => {
      expect(res).toEqual(mockSummary);
    });

    const req = httpTesting.expectOne((r) => r.url === apiUrl('/lifecycle/staged'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('3');
    expect(req.request.params.get('locationId')).toBe('loc-1');
    expect(req.request.params.get('includeSubtreeLocations')).toBe('true');
    req.flush(mockSummary);
  });

  it('gets graveyard summary with disposition filter', () => {
    const mockGy: GraveyardSummaryDto = {
      totalArchivedCount: 1,
      soldCount: 1,
      donatedCount: 0,
      recycledCount: 0,
      brokenTrashedCount: 0,
      consumedCount: 0,
      totalSaleProceeds: 50,
      totalDonatedEstimatedValue: 0,
      items: [mockItem],
    };

    service.getGraveyardItems(DispositionReasons.Sold, 'drill').subscribe((res) => {
      expect(res).toEqual(mockGy);
    });

    const req = httpTesting.expectOne((r) => r.url === apiUrl('/lifecycle/graveyard'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('dispositionReason')).toBe('0');
    expect(req.request.params.get('search')).toBe('drill');
    req.flush(mockGy);
  });

  it('gets dust collector insights', () => {
    const mockDust: DustCollectorInsightsDto = {
      minUntouchedDays: 180,
      cutoffDate: '2026-04-01T00:00:00Z',
      totalItemsCount: 1,
      totalEstimatedValue: 100,
      locationGroups: [],
    };

    service.getDustCollectors(180, 'loc-1', true, 'cat-1').subscribe((res) => {
      expect(res).toEqual(mockDust);
    });

    const req = httpTesting.expectOne((r) => r.url === apiUrl('/lifecycle/dust-collectors'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('minUntouchedDays')).toBe('180');
    expect(req.request.params.get('locationId')).toBe('loc-1');
    expect(req.request.params.get('categoryId')).toBe('cat-1');
    req.flush(mockDust);
  });

  it('stages and unstages an item', () => {
    const stageReq: StageItemRequest = {
      isToSell: true,
      targetPrice: 75,
      listingNotes: 'Sell on FB',
    };

    service.stageItem('itm-1', stageReq).subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const req1 = httpTesting.expectOne(apiUrl('/lifecycle/items/itm-1/stage'));
    expect(req1.request.method).toBe('POST');
    expect(req1.request.body).toEqual(stageReq);
    req1.flush(mockItem);

    service.unstageItem('itm-1').subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const req2 = httpTesting.expectOne(apiUrl('/lifecycle/items/itm-1/unstage'));
    expect(req2.request.method).toBe('POST');
    req2.flush(mockItem);
  });

  it('archives, restores, and touches an item', () => {
    const archiveReq: ArchiveItemRequest = {
      dispositionReason: DispositionReasons.Donated,
      dispositionNote: 'Goodwill',
    };

    service.archiveItem('itm-1', archiveReq).subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const req1 = httpTesting.expectOne(apiUrl('/lifecycle/items/itm-1/archive'));
    expect(req1.request.method).toBe('POST');
    expect(req1.request.body).toEqual(archiveReq);
    req1.flush(mockItem);

    service.restoreArchivedItem('itm-1').subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const req2 = httpTesting.expectOne(apiUrl('/lifecycle/items/itm-1/restore'));
    expect(req2.request.method).toBe('POST');
    req2.flush(mockItem);

    service.touchItem('itm-1').subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const req3 = httpTesting.expectOne(apiUrl('/lifecycle/items/itm-1/touch'));
    expect(req3.request.method).toBe('POST');
    req3.flush(mockItem);
  });

  it('bulk archives and bulk unstages items', () => {
    const bulkArchiveReq: BulkArchiveRequest = {
      itemIds: ['itm-1', 'itm-2'],
      dispositionReason: DispositionReasons.Sold,
    };

    service.bulkArchiveItems(bulkArchiveReq).subscribe((res) => {
      expect(res.processedCount).toBe(2);
    });

    const req1 = httpTesting.expectOne(apiUrl('/lifecycle/bulk-archive'));
    expect(req1.request.method).toBe('POST');
    expect(req1.request.body).toEqual(bulkArchiveReq);
    req1.flush({ processedCount: 2, items: [mockItem, mockItem] });

    const bulkUnstageReq: BulkUnstageRequest = { itemIds: ['itm-1'] };
    service.bulkUnstageItems(bulkUnstageReq).subscribe((res) => {
      expect(res.processedCount).toBe(1);
    });

    const req2 = httpTesting.expectOne(apiUrl('/lifecycle/bulk-unstage'));
    expect(req2.request.method).toBe('POST');
    expect(req2.request.body).toEqual(bulkUnstageReq);
    req2.flush({ processedCount: 1, items: [mockItem] });
  });
});
