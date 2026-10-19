import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  InsuranceClaimFilterParams,
  InsuranceClaimPreviewDto,
} from '../../models/insurance.models';
import { InsuranceService } from './insurance.service';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let httpTesting: HttpTestingController;

  const mockPreview: InsuranceClaimPreviewDto = {
    generatedAt: '2026-10-18T00:00:00Z',
    scopeDescription: 'All Locations',
    totalItemsCount: 1,
    totalQuantitySum: 1,
    totalPurchaseValue: 100,
    totalReplacementValue: 120,
    totalEffectiveClaimValue: 120,
    totalPhotoCount: 1,
    totalReceiptAndDocCount: 1,
    items: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InsuranceService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(InsuranceService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets claim preview with parameters', () => {
    const params: InsuranceClaimFilterParams = {
      locationId: 'loc-1',
      includeSubtree: true,
      categoryId: 'cat-1',
      minValue: 50,
      includeArchived: false,
      includeAttachments: true,
    };

    service.getPreview(params).subscribe((res) => {
      expect(res).toEqual(mockPreview);
    });

    const req = httpTesting.expectOne((r) => r.url === apiUrl('/insurance/preview'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('locationId')).toBe('loc-1');
    expect(req.request.params.get('includeSubtree')).toBe('true');
    expect(req.request.params.get('categoryId')).toBe('cat-1');
    expect(req.request.params.get('minValue')).toBe('50');
    expect(req.request.params.get('includeArchived')).toBe('false');
    expect(req.request.params.get('includeAttachments')).toBe('true');
    req.flush(mockPreview);
  });

  it('exports zip archive as blob', () => {
    const params: InsuranceClaimFilterParams = {
      locationId: 'loc-1',
    };

    const mockBlob = new Blob(['zip-binary-data'], { type: 'application/zip' });

    service.exportZip(params).subscribe((blob) => {
      expect(blob).toBeTruthy();
    });

    const req = httpTesting.expectOne((r) => r.url === apiUrl('/insurance/export-zip'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('locationId')).toBe('loc-1');
    expect(req.request.responseType).toBe('blob');
    req.flush(mockBlob);
  });
});
