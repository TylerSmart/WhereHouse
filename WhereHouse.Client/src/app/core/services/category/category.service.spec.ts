import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../../models/category.models';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpTesting: HttpTestingController;

  const mockCategory: CategoryDto = {
    id: 'cat-1',
    parentId: null,
    name: 'Cables & Adapters',
    description: null,
    icon: 'cable',
    color: '#2563eb',
    attributeTemplates: [],
    itemCount: 2,
    createdAt: '2026-10-18T00:00:00Z',
    modifiedAt: '2026-10-18T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CategoryService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CategoryService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch categories', () => {
    service.getCategories().subscribe((cats) => {
      expect(cats).toEqual([mockCategory]);
    });

    const req = httpTesting.expectOne(apiUrl('/categories'));
    expect(req.request.method).toBe('GET');
    req.flush([mockCategory]);
  });

  it('should create category', () => {
    const createReq: CreateCategoryRequest = {
      name: 'Power Tools',
    };

    service.createCategory(createReq).subscribe((cat) => {
      expect(cat).toEqual(mockCategory);
    });

    const req = httpTesting.expectOne(apiUrl('/categories'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createReq);
    req.flush(mockCategory);
  });

  it('should update category', () => {
    const updateReq: UpdateCategoryRequest = {
      name: 'Power Tools Updated',
    };

    service.updateCategory('cat-1', updateReq).subscribe((cat) => {
      expect(cat.name).toBe('Power Tools Updated');
    });

    const req = httpTesting.expectOne(apiUrl('/categories/cat-1'));
    expect(req.request.method).toBe('PUT');
    req.flush({ ...mockCategory, name: 'Power Tools Updated' });
  });

  it('should delete category', () => {
    service.deleteCategory('cat-1').subscribe();

    const req = httpTesting.expectOne(apiUrl('/categories/cat-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
