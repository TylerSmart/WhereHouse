import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  CreateItemRequest,
  ItemConditions,
  ItemDto,
  ItemStatuses,
  ItemTypes,
  UpdateItemRequest,
} from '../../models/item.models';
import { ItemService } from './item.service';

describe('ItemService', () => {
  let service: ItemService;
  let httpTesting: HttpTestingController;

  const mockItem: ItemDto = {
    id: 'itm-1',
    shortCode: 'ITM-001',
    name: 'Hammer Drill',
    description: null,
    aliases: [],
    tags: ['tools'],
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
    brand: 'DeWalt',
    modelNumber: 'DCD996',
    serialNumber: 'SN123',
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
      providers: [ItemService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ItemService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch items with query params', () => {
    service.getItems({ locationId: 'loc-1', lowStockOnly: true }).subscribe((items) => {
      expect(items).toEqual([mockItem]);
    });

    const req = httpTesting.expectOne(
      (r) =>
        r.url === apiUrl('/items') &&
        r.params.get('locationId') === 'loc-1' &&
        r.params.get('lowStockOnly') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockItem]);
  });

  it('should create item', () => {
    const createReq: CreateItemRequest = {
      name: 'Hammer Drill',
      itemType: ItemTypes.Unique,
    };

    service.createItem(createReq).subscribe((item) => {
      expect(item).toEqual(mockItem);
    });

    const req = httpTesting.expectOne(apiUrl('/items'));
    expect(req.request.method).toBe('POST');
    req.flush(mockItem);
  });

  it('should update item', () => {
    const updateReq: UpdateItemRequest = {
      name: 'Hammer Drill Updated',
      itemType: ItemTypes.Unique,
    };

    service.updateItem('itm-1', updateReq).subscribe((item) => {
      expect(item.name).toBe('Hammer Drill Updated');
    });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1'));
    expect(req.request.method).toBe('PUT');
    req.flush({ ...mockItem, name: 'Hammer Drill Updated' });
  });

  it('should adjust quantity', () => {
    service.adjustQuantity('itm-1', { delta: 2 }).subscribe((item) => {
      expect(item.currentQuantity).toBe(3);
    });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/quantity'));
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...mockItem, currentQuantity: 3 });
  });

  it('should duplicate item', () => {
    service.duplicateItem('itm-1').subscribe((item) => {
      expect(item.shortCode).toBe('ITM-002');
    });

    const req = httpTesting.expectOne(apiUrl('/items/itm-1/duplicate'));
    expect(req.request.method).toBe('POST');
    req.flush({ ...mockItem, id: 'itm-2', shortCode: 'ITM-002' });
  });

  it('should delete item', () => {
    service.deleteItem('itm-1').subscribe();

    const req = httpTesting.expectOne(apiUrl('/items/itm-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should bulk update items', () => {
    const bulkReq = {
      itemIds: ['itm-1', 'itm-2'],
      updateHomeLocation: true,
      targetHomeLocationId: 'loc-2',
      addTags: ['workshop'],
    };

    service.bulkUpdateItems(bulkReq).subscribe((res) => {
      expect(res.updatedCount).toBe(2);
      expect(res.updatedItems.length).toBe(2);
    });

    const req = httpTesting.expectOne(apiUrl('/items/bulk-update'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(bulkReq);
    req.flush({ updatedCount: 2, updatedItems: [mockItem, { ...mockItem, id: 'itm-2' }] });
  });
});
