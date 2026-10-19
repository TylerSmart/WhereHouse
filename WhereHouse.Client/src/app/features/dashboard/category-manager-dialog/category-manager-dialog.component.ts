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
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>category</mat-icon>
      <span>Manage Categories &amp; Attribute Templates</span>
    </h2>

    <mat-dialog-content>
      <div class="manager-layout">
        <!-- Categories List -->
        <div class="categories-list-pane">
          <div class="pane-header">
            <h3>Categories</h3>
            <button
              type="button"
              mat-icon-button
              (click)="startCreateNew()"
              matTooltip="Add Category"
              aria-label="Add Category"
            >
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <div class="category-items">
            @for (cat of categories(); track cat.id) {
              <button
                type="button"
                class="category-list-item"
                [class.selected-cat]="selectedCategory()?.id === cat.id"
                (click)="selectCategory(cat)"
              >
                <mat-icon class="cat-icon">{{ cat.icon || 'category' }}</mat-icon>
                <div class="cat-info">
                  <span class="cat-name">{{ cat.name }}</span>
                  <span class="cat-templates-count">
                    {{ cat.attributeTemplates.length }} custom field{{
                      cat.attributeTemplates.length === 1 ? '' : 's'
                    }}
                  </span>
                </div>
                <span class="cat-item-badge">{{ cat.itemCount }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Category Edit Form -->
        <div class="category-form-pane">
          <form [formGroup]="form" class="category-form">
            <div class="form-title-row">
              <h4>{{ isEditingExisting() ? 'Edit Category' : 'New Category' }}</h4>
              @if (isEditingExisting()) {
                <button
                  type="button"
                  mat-icon-button
                  color="warn"
                  (click)="deleteCurrentCategory()"
                  matTooltip="Delete Category"
                  aria-label="Delete Category"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Category Name</mat-label>
              <input
                matInput
                formControlName="name"
                placeholder="e.g. Power Tools"
                required
                maxlength="100"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description (Optional)</mat-label>
              <input
                matInput
                formControlName="description"
                placeholder="Brief context"
                maxlength="500"
              />
            </mat-form-field>

            <div class="form-row">
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Icon</mat-label>
                <input
                  matInput
                  formControlName="icon"
                  placeholder="e.g. cable, handyman"
                  maxlength="64"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Color</mat-label>
                <input matInput formControlName="color" placeholder="e.g. #2563eb" maxlength="32" />
              </mat-form-field>
            </div>

            <mat-divider></mat-divider>

            <!-- Attribute Templates Section -->
            <div class="templates-section">
              <div class="templates-header">
                <div>
                  <h5>Attribute Templates (Custom Fields)</h5>
                  <p class="templates-subtext">
                    Items assigned to this category will include these structured fields.
                  </p>
                </div>
                <button type="button" mat-stroked-button (click)="addAttributeTemplate()">
                  <mat-icon>add</mat-icon>
                  <span>Add Field</span>
                </button>
              </div>

              <div formArrayName="attributeTemplates" class="templates-list">
                @for (tmpl of attributeTemplatesArray.controls; track $index) {
                  <div [formGroupName]="$index" class="template-item-row">
                    <mat-form-field appearance="outline" class="field-name-input">
                      <mat-label>Field Name</mat-label>
                      <input
                        matInput
                        formControlName="name"
                        placeholder="e.g. Length, Voltage"
                        required
                      />
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="field-type-select">
                      <mat-label>Type</mat-label>
                      <mat-select formControlName="fieldType">
                        <mat-option [value]="AttributeFieldTypes.Text">Text</mat-option>
                        <mat-option [value]="AttributeFieldTypes.Number">Number</mat-option>
                        <mat-option [value]="AttributeFieldTypes.Enum">Select / Options</mat-option>
                        <mat-option [value]="AttributeFieldTypes.Boolean">Yes / No</mat-option>
                      </mat-select>
                    </mat-form-field>

                    @if (tmpl.value.fieldType === AttributeFieldTypes.Number) {
                      <mat-form-field appearance="outline" class="field-unit-input">
                        <mat-label>Unit</mat-label>
                        <input matInput formControlName="unit" placeholder="ft, V, mm" />
                      </mat-form-field>
                    }

                    @if (tmpl.value.fieldType === AttributeFieldTypes.Enum) {
                      <mat-form-field appearance="outline" class="field-options-input">
                        <mat-label>Options (comma separated)</mat-label>
                        <input
                          matInput
                          formControlName="optionsString"
                          placeholder="Option A, Option B"
                        />
                      </mat-form-field>
                    }

                    <button
                      type="button"
                      mat-icon-button
                      color="warn"
                      (click)="removeAttributeTemplate($index)"
                      aria-label="Remove Field"
                    >
                      <mat-icon>remove_circle_outline</mat-icon>
                    </button>
                  </div>
                }
              </div>
            </div>

            <div class="form-actions-inline">
              <button
                type="button"
                mat-flat-button
                color="primary"
                [disabled]="form.invalid || isSaving()"
                (click)="saveCategory()"
              >
                {{ isEditingExisting() ? 'Update Category' : 'Create Category' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .manager-layout {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 1rem;
      min-height: 400px;
    }
    .category-form-pane {
      min-width: 0;
    }
    ::ng-deep .category-form-pane .mat-mdc-form-field-infix {
      width: auto !important;
      min-width: 0 !important;
    }
    .categories-list-pane {
      border-right: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
      padding-right: 0.75rem;
    }
    .pane-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .pane-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .category-items {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .category-list-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      border: none;
      background: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      font-family: inherit;
      color: inherit;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--mat-sys-surface-container-high, rgba(0, 0, 0, 0.04));
      }
      &.selected-cat {
        background-color: var(--mat-sys-primary-container, #dbe6cf);
        color: var(--mat-sys-on-primary-container, #0d2003);
      }
    }
    .cat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      opacity: 0.8;
    }
    .cat-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .cat-name {
      font-size: 0.875rem;
      font-weight: 500;
    }
    .cat-templates-count {
      font-size: 0.7rem;
      opacity: 0.7;
    }
    .cat-item-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 10px;
      background-color: var(--mat-sys-surface-container-highest, rgba(0, 0, 0, 0.08));
    }
    .category-form-pane {
      display: flex;
      flex-direction: column;
    }
    .form-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .form-title-row h4 {
      margin: 0;
      font-size: 1.05rem;
    }
    .category-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .full-width {
      width: 100%;
    }
    .form-row {
      display: flex;
      gap: 0.75rem;
    }
    .half-width {
      flex: 1;
    }
    .templates-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }
    .templates-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .templates-header h5 {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .templates-subtext {
      margin: 0;
      font-size: 0.75rem;
      opacity: 0.75;
    }
    .templates-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .template-item-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
    }
    .field-name-input {
      flex: 2;
      min-width: 0;
    }
    .field-type-select {
      flex: 1.5;
      min-width: 0;
    }
    .field-unit-input,
    .field-options-input {
      flex: 1.5;
      min-width: 0;
    }
    .form-actions-inline {
      margin-top: 0.5rem;
    }

    @media (max-width: 600px) {
      .manager-layout {
        grid-template-columns: 1fr;
      }
      .categories-list-pane {
        border-right: none;
        border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
        padding-bottom: 1rem;
      }
    }
  `,
})
export class CategoryManagerDialogComponent implements OnInit {
  protected readonly dialogRef = inject(MatDialogRef<CategoryManagerDialogComponent>);
  private readonly categoryService = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  protected readonly AttributeFieldTypes = AttributeFieldTypes;

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly selectedCategory = signal<CategoryDto | null>(null);
  protected readonly isEditingExisting = signal<boolean>(false);
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
      if (cats.length > 0 && !this.selectedCategory()) {
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
