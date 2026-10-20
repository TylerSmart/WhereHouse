import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  type AttributeFieldType,
  AttributeFieldTypes,
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../../../core/models/category.models';
import { CategoryService } from '../../../core/services/category/category.service';

@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  selector: 'app-category-manager-dialog',
  templateUrl: './category-manager-dialog.component.html',
  styleUrl: './category-manager-dialog.component.scss',
})
export class CategoryManagerDialogComponent implements OnInit {
  protected readonly dialogRef = inject(MatDialogRef<CategoryManagerDialogComponent>);
  private readonly categoryService = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  protected readonly AttributeFieldTypes = AttributeFieldTypes;

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly selectedCategory = signal<CategoryDto | null>(null);
  protected readonly isEditingExisting = signal<boolean>(false);
  protected readonly isCreatingNew = signal<boolean>(false);
  protected readonly isSaving = signal<boolean>(false);

  protected form!: FormGroup;

  get attributeTemplatesArray(): FormArray {
    return this.form.get('attributeTemplates') as FormArray;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe((cats) => {
      this.categories.set(cats);
      if (cats.length > 0 && !this.selectedCategory() && !this.isCreatingNew()) {
        this.selectCategory(cats[0]);
      }
    });
  }

  initForm(cat?: CategoryDto): void {
    this.form = this.fb.group({
      name: [cat?.name ?? '', [Validators.required, Validators.maxLength(100)]],
      description: [cat?.description ?? '', [Validators.maxLength(500)]],
      icon: [cat?.icon ?? 'category', [Validators.maxLength(64)]],
      color: [cat?.color ?? '', [Validators.maxLength(32)]],
      attributeTemplates: this.fb.array([]),
    });

    if (cat?.attributeTemplates) {
      for (const tmpl of cat.attributeTemplates) {
        this.attributeTemplatesArray.push(
          this.fb.group({
            id: [tmpl.id],
            name: [tmpl.name, Validators.required],
            fieldType: [tmpl.fieldType, Validators.required],
            unit: [tmpl.unit ?? ''],
            optionsString: [tmpl.options ? tmpl.options.join(', ') : ''],
            isRequired: [tmpl.isRequired],
            sortOrder: [tmpl.sortOrder],
          }),
        );
      }
    }
  }

  selectCategory(cat: CategoryDto): void {
    this.selectedCategory.set(cat);
    this.isEditingExisting.set(true);
    this.initForm(cat);
  }

  startCreateNew(): void {
    this.selectedCategory.set(null);
    this.isEditingExisting.set(false);
    this.initForm();
  }

  addAttributeTemplate(): void {
    this.attributeTemplatesArray.push(
      this.fb.group({
        id: [null],
        name: ['', Validators.required],
        fieldType: [AttributeFieldTypes.Text, Validators.required],
        unit: [''],
        optionsString: [''],
        isRequired: [false],
        sortOrder: [this.attributeTemplatesArray.length + 1],
      }),
    );
  }

  removeAttributeTemplate(index: number): void {
    this.attributeTemplatesArray.removeAt(index);
  }

  saveCategory(): void {
    if (this.form.invalid) {
      return;
    }

    this.isSaving.set(true);
    const val = this.form.value;

    interface TemplateFormValue {
      id?: string | null;
      name: string;
      fieldType: AttributeFieldType;
      unit?: string | null;
      optionsString?: string | null;
      isRequired?: boolean;
      sortOrder?: number;
    }

    const templates = ((val.attributeTemplates || []) as TemplateFormValue[]).map((t) => ({
      id: t.id || null,
      name: t.name.trim(),
      fieldType: t.fieldType,
      unit: t.unit?.trim() || null,
      options: t.optionsString
        ? t.optionsString
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
        : null,
      isRequired: !!t.isRequired,
      sortOrder: t.sortOrder || 0,
    }));

    if (this.isEditingExisting() && this.selectedCategory()) {
      const updateReq: UpdateCategoryRequest = {
        name: val.name.trim(),
        description: val.description?.trim() || null,
        icon: val.icon?.trim() || 'category',
        color: val.color?.trim() || null,
        attributeTemplates: templates,
      };

      this.categoryService.updateCategory(this.selectedCategory()!.id, updateReq).subscribe({
        next: (updated) => {
          this.isSaving.set(false);
          this.loadCategories();
          this.selectCategory(updated);
        },
        error: () => this.isSaving.set(false),
      });
    } else {
      const createReq: CreateCategoryRequest = {
        name: val.name.trim(),
        description: val.description?.trim() || null,
        icon: val.icon?.trim() || 'category',
        color: val.color?.trim() || null,
        attributeTemplates: templates,
      };

      this.categoryService.createCategory(createReq).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.loadCategories();
          this.selectCategory(created);
        },
        error: () => this.isSaving.set(false),
      });
    }
  }

  deleteCurrentCategory(): void {
    const cat = this.selectedCategory();
    if (!cat) {
      return;
    }

    this.categoryService.deleteCategory(cat.id).subscribe({
      next: () => {
        this.selectedCategory.set(null);
        this.isEditingExisting.set(false);
        this.initForm();
        this.loadCategories();
      },
    });
  }
}
