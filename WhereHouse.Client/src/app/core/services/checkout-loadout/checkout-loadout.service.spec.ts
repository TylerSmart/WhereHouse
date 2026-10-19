import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  BatchCheckoutRequest,
  BatchReturnRequest,
  CheckoutItemRequest,
  CheckoutLoadoutRequest,
  LoadoutDto,
  LoadoutStatuses,
  PackBackLoadoutRequest,
  ReturnItemRequest,
} from '../../models/checkout-loadout.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../models/item.models';
import { CheckoutLoadoutService } from './checkout-loadout.service';

describe('CheckoutLoadoutService', () => {
  let service: CheckoutLoadoutService;
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
      providers: [CheckoutLoadoutService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CheckoutLoadoutService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('manages cart items in signal state', () => {
    expect(service.cartItems()).toEqual([]);
    expect(service.isInCart(mockItem.id)).toBe(false);

    service.addToCart(mockItem);
    expect(service.cartItems().length).toBe(1);
    expect(service.isInCart(mockItem.id)).toBe(true);

    // Adding duplicate does not duplicate
    service.addToCart(mockItem);
    expect(service.cartItems().length).toBe(1);

    service.removeFromCart(mockItem.id);
    expect(service.cartItems().length).toBe(0);

    service.addToCart(mockItem);
    service.clearCart();
    expect(service.cartItems().length).toBe(0);
  });

  it('calls checkoutItem API', () => {
    const req: CheckoutItemRequest = { projectOrNote: 'Garage fix' };

    service.checkoutItem('itm-1', req).subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const reqMatch = httpTesting.expectOne(apiUrl('/checkouts/items/itm-1/checkout'));
    expect(reqMatch.request.method).toBe('POST');
    expect(reqMatch.request.body).toEqual(req);
    reqMatch.flush({ ...mockItem, status: ItemStatuses.InUse });
  });

  it('calls returnItem API', () => {
    const req: ReturnItemRequest = { returnNote: 'Done' };

    service.returnItem('itm-1', req).subscribe((res) => {
      expect(res.id).toBe('itm-1');
    });

    const reqMatch = httpTesting.expectOne(apiUrl('/checkouts/items/itm-1/return'));
    expect(reqMatch.request.method).toBe('POST');
    expect(reqMatch.request.body).toEqual(req);
    reqMatch.flush({ ...mockItem, status: ItemStatuses.InPlace });
  });

  it('calls batchCheckout and batchReturn APIs', () => {
    const chkReq: BatchCheckoutRequest = { itemIds: ['itm-1'] };
    service.batchCheckout(chkReq).subscribe((res) => {
      expect(res.processedCount).toBe(1);
    });
    const cMatch = httpTesting.expectOne(apiUrl('/checkouts/batch-checkout'));
    expect(cMatch.request.method).toBe('POST');
    cMatch.flush({ processedCount: 1, items: [mockItem] });

    const retReq: BatchReturnRequest = { items: [{ itemId: 'itm-1' }] };
    service.batchReturn(retReq).subscribe((res) => {
      expect(res.processedCount).toBe(1);
    });
    const rMatch = httpTesting.expectOne(apiUrl('/checkouts/batch-return'));
    expect(rMatch.request.method).toBe('POST');
    rMatch.flush({ processedCount: 1, items: [mockItem] });
  });

  it('calls loadout checkout and pack-back APIs', () => {
    const chkReq: CheckoutLoadoutRequest = { checkoutNote: 'Camping' };
    service.checkoutLoadout('ld-1', chkReq).subscribe((res) => {
      expect(res.status).toBe(LoadoutStatuses.ActiveCheckout);
    });
    const cMatch = httpTesting.expectOne(apiUrl('/loadouts/ld-1/checkout'));
    expect(cMatch.request.method).toBe('POST');
    cMatch.flush({
      id: 'ld-1',
      status: LoadoutStatuses.ActiveCheckout,
    } as unknown as LoadoutDto);

    const pbReq: PackBackLoadoutRequest = {
      items: [{ itemId: 'itm-1', isReturned: true }],
    };
    service.packBackLoadout('ld-1', pbReq).subscribe((res) => {
      expect(res.status).toBe(LoadoutStatuses.Ready);
    });
    const pbMatch = httpTesting.expectOne(apiUrl('/loadouts/ld-1/pack-back'));
    expect(pbMatch.request.method).toBe('POST');
    pbMatch.flush({
      id: 'ld-1',
      status: LoadoutStatuses.Ready,
    } as unknown as LoadoutDto);
  });
});
