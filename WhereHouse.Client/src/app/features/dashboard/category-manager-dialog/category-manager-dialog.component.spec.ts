import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CategoryDto } from '../../../core/models/category.models';
import { CategoryService } from '../../../core/services/category/category.service';
import { CategoryManagerDialogComponent } from './category-manager-dialog.component';

describe('CategoryManagerDialogComponent', () => {
  let component: CategoryManagerDialogComponent;
  let fixture: ComponentFixture<CategoryManagerDialogComponent>;

  const mockCategories: CategoryDto[] = [
    {
      id: 'cat-1',
      parentId: null,
      name: 'Power Tools',
      description: null,
      icon: 'handyman',
      color: null,
      attributeTemplates: [],
      itemCount: 5,
      createdAt: '',
      modifiedAt: '',
    },
  ];

  const mockCategoryService = {
    getCategories: vi.fn().mockReturnValue(of(mockCategories)),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn().mockReturnValue(of(undefined)),
  };

  const mockDialogRef = {
    close: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryManagerDialogComponent],
      providers: [
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryManagerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load categories and select first one', () => {
    expect(component).toBeTruthy();
    expect(mockCategoryService.getCategories).toHaveBeenCalled();
    expect(component['categories']().length).toBe(1);
    expect(component['selectedCategory']()?.name).toBe('Power Tools');
  });

  it('should add and remove attribute template controls in form array', () => {
    expect(component.attributeTemplatesArray.length).toBe(0);
    component.addAttributeTemplate();
    expect(component.attributeTemplatesArray.length).toBe(1);
    component.removeAttributeTemplate(0);
    expect(component.attributeTemplatesArray.length).toBe(0);
  });
});
