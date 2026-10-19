import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  BarcodeProductLookupDto,
  CsvImportRequest,
  ImportResultDto,
  JsonImportRequest,
  PortabilityEntityTypes,
  RapidBatchIntakeRequest,
  RapidBatchIntakeResponseDto,
  RapidIntakeItemRequest,
  WhereHouseExportBundleDto,
} from '../../models/intake-portability.models';
import { ItemConditions, ItemDto, ItemStatuses, ItemTypes } from '../../models/item.models';
import { IntakePortabilityService } from './intake-portability.service';

describe('IntakePortabilityService', () => {
  let service: IntakePortabilityService;
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
    serialNumber: null,
    barcodeNumber: '0885911362757',
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
      providers: [IntakePortabilityService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(IntakePortabilityService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should lookup barcode', () => {
    const mockLookup: BarcodeProductLookupDto = {
      barcode: '0885911362757',
      found: true,
      source: 'CuratedCatalog',
      name: 'DeWalt 20V MAX XR Hammer Drill',
      suggestedItemType: ItemTypes.Unique,
    };

    service.lookupBarcode('0885911362757').subscribe((res) => {
      expect(res).toEqual(mockLookup);
    });

    const req = httpTesting.expectOne(apiUrl('/intake/barcode/0885911362757'));
    expect(req.request.method).toBe('GET');
    req.flush(mockLookup);
  });

  it('should create rapid item', () => {
    const request: RapidIntakeItemRequest = {
      name: 'Hammer Drill',
      barcodeNumber: '0885911362757',
      bindQrToken: 'QR-TEST',
    };

    service.createRapidItem(request).subscribe((item) => {
      expect(item).toEqual(mockItem);
    });

    const req = httpTesting.expectOne(apiUrl('/intake/rapid'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(mockItem);
  });

  it('should create rapid batch', () => {
    const request: RapidBatchIntakeRequest = {
      defaultHomeLocationId: 'loc-1',
      items: [{ name: 'Hammer Drill' }],
    };

    const mockResponse: RapidBatchIntakeResponseDto = {
      createdCount: 1,
      createdItems: [mockItem],
    };

    service.createRapidBatch(request).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(apiUrl('/intake/rapid-batch'));
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should export json bundle', () => {
    const mockBundle: WhereHouseExportBundleDto = {
      formatVersion: '1.0',
      exportedAt: '2026-10-18T00:00:00Z',
      categories: [],
      locations: [],
      items: [],
    };

    service.exportJsonBundle().subscribe((bundle) => {
      expect(bundle).toEqual(mockBundle);
    });

    const req = httpTesting.expectOne(apiUrl('/portability/export/json'));
    expect(req.request.method).toBe('GET');
    req.flush(mockBundle);
  });

  it('should export csv as text', () => {
    const csvData = 'ShortCode,Name\nITM-001,Hammer Drill';

    service.exportCsv(PortabilityEntityTypes.Items).subscribe((csv) => {
      expect(csv).toBe(csvData);
    });

    const req = httpTesting.expectOne(
      (r) => r.url === apiUrl('/portability/export/csv') && r.params.get('entityType') === '0',
    );
    expect(req.request.method).toBe('GET');
    req.flush(csvData);
  });

  it('should import json bundle', () => {
    const request: JsonImportRequest = {
      jsonContent: '{}',
      dryRun: true,
    };

    const mockResult: ImportResultDto = {
      dryRun: true,
      totalRowsProcessed: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      rows: [],
    };

    service.importJsonBundle(request).subscribe((res) => {
      expect(res).toEqual(mockResult);
    });

    const req = httpTesting.expectOne(apiUrl('/portability/import/json'));
    expect(req.request.method).toBe('POST');
    req.flush(mockResult);
  });

  it('should import csv', () => {
    const request: CsvImportRequest = {
      entityType: PortabilityEntityTypes.Items,
      csvContent: 'Name\nTest Item',
      dryRun: false,
    };

    const mockResult: ImportResultDto = {
      dryRun: false,
      totalRowsProcessed: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      rows: [],
    };

    service.importCsv(request).subscribe((res) => {
      expect(res).toEqual(mockResult);
    });

    const req = httpTesting.expectOne(apiUrl('/portability/import/csv'));
    expect(req.request.method).toBe('POST');
    req.flush(mockResult);
  });
});
