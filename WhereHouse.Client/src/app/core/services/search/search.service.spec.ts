import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import { SmartSearchParams, SmartSearchResponseDto } from '../../models/search.models';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let httpTesting: HttpTestingController;

  const mockResponse: SmartSearchResponseDto = {
    query: 'drill',
    locations: [],
    activeItems: [],
    archivedItems: [],
    totalCount: 0,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SearchService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SearchService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should send search request with query and facet params', () => {
    const params: SmartSearchParams = {
      q: 'drill',
      locationId: 'loc-1',
      categoryId: 'cat-1',
      attributeName: 'Voltage',
      attributeMinNumber: 18,
      outOfPlaceOnly: true,
      lowStockOnly: false,
      includeArchived: true,
    };

    service.search(params).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne((r) => {
      return (
        r.url === apiUrl('/search') &&
        r.params.get('q') === 'drill' &&
        r.params.get('locationId') === 'loc-1' &&
        r.params.get('categoryId') === 'cat-1' &&
        r.params.get('attributeName') === 'Voltage' &&
        r.params.get('attributeMinNumber') === '18' &&
        r.params.get('outOfPlaceOnly') === 'true' &&
        r.params.get('includeArchived') === 'true'
      );
    });

    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
