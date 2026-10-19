import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { UserSummaryDto } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  type AttributeFieldType,
  AttributeFieldTypes,
  CategoryAttributeTemplateDto,
  CategoryDto,
} from '../../../core/models/category.models';
import {
  CreateItemRequest,
  ItemConditions,
  ItemDto,
  ItemStatuses,
  type ItemType,
  ItemTypes,
  ItemAttributeValueDto,
  UpdateItemRequest,
  UpsertItemAttributeValueRequest,
} from '../../../core/models/item.models';
import { LocationNodeDto } from '../../../core/models/location.models';
import { IntakePortabilityService } from '../../../core/services/intake-portability/intake-portability.service';

export interface ItemDialogData {
  item?: ItemDto;
  cloneFromItem?: ItemDto;
  homeLocationId?: string | null;
  availableLocations: LocationNodeDto[];
  availableCategories: CategoryDto[];
  availableParentItems: ItemDto[];
}

export type ItemDialogResult =
  { mode: 'create'; request: CreateItemRequest } | { mode: 'update'; request: UpdateItemRequest };

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
    MatRadioModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatTooltipModule,
    MatDatepickerModule,
  ],
  providers: [provideNativeDateAdapter()],
  selector: 'app-item-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>{{ getItemTypeIcon() }}</mat-icon>
      <span>{{ isEditMode ? 'Edit Item' : isCloneMode ? 'Clone Item' : 'Add Item' }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="item-form">
        <!-- Archetype Selector -->
        <div class="form-section">
          <span class="section-label">Item Archetype</span>
          <mat-radio-group formControlName="itemType" class="type-radio-group">
            <mat-radio-button [value]="ItemTypes.Unique">
              <div class="radio-label-content">
                <mat-icon>fingerprint</mat-icon>
                <div>
                  <strong>Unique (1-of-1)</strong>
                  <span class="sub-desc">Serialized, branded gear</span>
                </div>
              </div>
            </mat-radio-button>

            <mat-radio-button [value]="ItemTypes.Quantity">
              <div class="radio-label-content">
                <mat-icon>layers</mat-icon>
                <div>
                  <strong>Quantity / Consumable</strong>
                  <span class="sub-desc">Bulk spares, stackable</span>
                </div>
              </div>
            </mat-radio-button>

            <mat-radio-button [value]="ItemTypes.Kit">
              <div class="radio-label-content">
                <mat-icon>cases</mat-icon>
                <div>
                  <strong>Kit / Bundle</strong>
                  <span class="sub-desc">Composite packing kit</span>
                </div>
              </div>
            </mat-radio-button>

            <mat-radio-button [value]="ItemTypes.Nested">
              <div class="radio-label-content">
                <mat-icon>account_tree</mat-icon>
                <div>
                  <strong>Nested Component</strong>
                  <span class="sub-desc">Accessory attached to parent</span>
                </div>
              </div>
            </mat-radio-button>
          </mat-radio-group>
        </div>

        <!-- Name & Short Code -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Item Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g. DeWalt 20V Hammer Drill"
            required
            maxlength="200"
          />
        </mat-form-field>

        @if (!isEditMode) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Short Code (Optional)</mat-label>
            <input
              matInput
              formControlName="shortCode"
              placeholder="Auto-generated (e.g. ITM-001)"
              maxlength="32"
            />
            <mat-hint>Leave blank to auto-generate sequentially</mat-hint>
          </mat-form-field>
        } @else {
          <div class="shortcode-badge-row">
            <span class="shortcode-pill">{{ data.item?.shortCode }}</span>
            <span class="shortcode-path">{{
              data.item?.homeLocationFullPath || 'No Location'
            }}</span>
          </div>
        }

        <!-- Home Location & Category Selectors -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Home Location / Container</mat-label>
            <mat-select formControlName="homeLocationId">
              <mat-option [value]="null"><em>Unassigned</em></mat-option>
              @for (loc of data.availableLocations; track loc.id) {
                <mat-option [value]="loc.id"> [{{ loc.shortCode }}] {{ loc.fullPath }} </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Category</mat-label>
            <mat-select formControlName="categoryId">
              <mat-option [value]="null"><em>None</em></mat-option>
              @for (cat of data.availableCategories; track cat.id) {
                <mat-option [value]="cat.id">
                  {{ cat.name }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Parent Item / Kit Selector (if Nested or child member) -->
        @if (isNestedOrChild()) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Parent Kit or Primary Asset</mat-label>
            <mat-select formControlName="parentItemId">
              <mat-option [value]="null"><em>None</em></mat-option>
              @for (p of data.availableParentItems; track p.id) {
                @if (p.id !== data.item?.id) {
                  <mat-option [value]="p.id">
                    [{{ p.shortCode }}] {{ p.name }} ({{ getItemTypeName(p.itemType) }})
                  </mat-option>
                }
              }
            </mat-select>
          </mat-form-field>
        }

        <!-- Quantity Section (highlighted for Quantity archetype) -->
        @if (isQuantityType()) {
          <div class="quantity-highlight-box">
            <div class="box-title">
              <mat-icon>inventory</mat-icon>
              <span>Quantity Tracking</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="third-width">
                <mat-label>Current Quantity</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="currentQuantity"
                  min="0"
                  step="1"
                  required
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="third-width">
                <mat-label>Unit of Measure</mat-label>
                <input
                  matInput
                  formControlName="unit"
                  placeholder="pcs, ft, pack, roll"
                  maxlength="32"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="third-width">
                <mat-label>Low-Stock Threshold</mat-label>
                <input
                  matInput
                  type="number"
                  formControlName="minQuantity"
                  min="0"
                  placeholder="Optional alert"
                />
              </mat-form-field>
            </div>
          </div>
        }

        <!-- Condition and Status (on edit) -->
        <div class="form-row">
          <mat-form-field
            appearance="outline"
            [class.half-width]="isEditMode"
            [class.full-width]="!isEditMode"
          >
            <mat-label>Condition</mat-label>
            <mat-select formControlName="condition">
              <mat-option [value]="ItemConditions.New">New</mat-option>
              <mat-option [value]="ItemConditions.Excellent">Excellent</mat-option>
              <mat-option [value]="ItemConditions.Good">Good</mat-option>
              <mat-option [value]="ItemConditions.Fair">Fair</mat-option>
              <mat-option [value]="ItemConditions.Broken">Broken</mat-option>
            </mat-select>
          </mat-form-field>

          @if (isEditMode) {
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option [value]="ItemStatuses.InPlace">In Place</mat-option>
                <mat-option [value]="ItemStatuses.InUse">In Use</mat-option>
                <mat-option [value]="ItemStatuses.LoanedOut">Loaned Out</mat-option>
                <mat-option [value]="ItemStatuses.StagedToSell">Staged to Sell</mat-option>
                <mat-option [value]="ItemStatuses.StagedToDonate">Staged to Donate</mat-option>
                <mat-option [value]="ItemStatuses.Archived">Archived</mat-option>
              </mat-select>
            </mat-form-field>
          }
        </div>

        <!-- Retail Barcode (UPC / EAN) with Lookup Button -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Retail Barcode (UPC / EAN / GTIN)</mat-label>
            <input
              matInput
              formControlName="barcodeNumber"
              placeholder="e.g. 0885911362757"
              maxlength="64"
              (keydown.enter)="$event.preventDefault(); onLookupBarcode()"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              [disabled]="isLookingUpBarcode() || !form.get('barcodeNumber')?.value"
              (click)="onLookupBarcode()"
              matTooltip="Lookup product info by UPC/EAN"
            >
              <mat-icon>manage_search</mat-icon>
            </button>
            <mat-hint>Scanned retail barcode for auto-fill &amp; scanner lookup</mat-hint>
          </mat-form-field>
        </div>

        <!-- Brand, Model, Serial # -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="third-width">
            <mat-label>Brand / Manufacturer</mat-label>
            <input
              matInput
              formControlName="brand"
              placeholder="e.g. DeWalt, Anker"
              maxlength="100"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="third-width">
            <mat-label>Model #</mat-label>
            <input
              matInput
              formControlName="modelNumber"
              placeholder="Model number"
              maxlength="100"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="third-width">
            <mat-label>Serial #</mat-label>
            <input
              matInput
              formControlName="serialNumber"
              placeholder="Serial number"
              maxlength="100"
            />
          </mat-form-field>
        </div>

        <!-- Dynamic Category Attributes Section -->
        @if (selectedCategoryTemplates().length > 0) {
          <div class="dynamic-attributes-box">
            <div class="box-title">
              <mat-icon>tune</mat-icon>
              <span>Custom Category Fields ({{ selectedCategory()?.name }})</span>
            </div>

            <div formArrayName="attributeValues" class="dynamic-fields-list">
              @for (ctrl of attributeValuesArray.controls; track $index) {
                <div [formGroupName]="$index" class="dynamic-field-item">
                  @switch (ctrl.value.fieldType) {
                    @case (AttributeFieldTypes.Text) {
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>{{ ctrl.value.attributeName }}</mat-label>
                        <input matInput formControlName="value" />
                      </mat-form-field>
                    }
                    @case (AttributeFieldTypes.Number) {
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label
                          >{{ ctrl.value.attributeName }}
                          {{ ctrl.value.unit ? '(' + ctrl.value.unit + ')' : '' }}</mat-label
                        >
                        <input matInput type="number" formControlName="value" />
                        @if (ctrl.value.unit) {
                          <span matSuffix>{{ ctrl.value.unit }}</span>
                        }
                      </mat-form-field>
                    }
                    @case (AttributeFieldTypes.Enum) {
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>{{ ctrl.value.attributeName }}</mat-label>
                        <mat-select formControlName="value">
                          @for (
                            opt of getOptionsForField(ctrl.value.attributeTemplateId);
                            track opt
                          ) {
                            <mat-option [value]="opt">{{ opt }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    }
                    @case (AttributeFieldTypes.Boolean) {
                      <mat-checkbox formControlName="value">
                        {{ ctrl.value.attributeName }}
                      </mat-checkbox>
                    }
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Description, Aliases, Tags -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description / Notes</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="2000"></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Aliases / Synonyms (comma separated)</mat-label>
            <input matInput formControlName="aliasesString" placeholder="e.g. Hex key, Allen key" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Tags (comma separated)</mat-label>
            <input
              matInput
              formControlName="tagsString"
              placeholder="e.g. camping, cooking, emergency"
            />
          </mat-form-field>
        </div>

        <mat-divider></mat-divider>

        <!-- Purchase & Warranty Lifecycle Section -->
        <div class="vault-section">
          <div class="box-title">
            <mat-icon>receipt_long</mat-icon>
            <span>Purchase &amp; Warranty Vault</span>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="third-width">
              <mat-label>Purchase Date</mat-label>
              <input
                matInput
                [matDatepicker]="purchaseDatePicker"
                formControlName="purchaseDate"
                placeholder="Choose date"
              />
              <mat-datepicker-toggle
                matIconSuffix
                [for]="purchaseDatePicker"
              ></mat-datepicker-toggle>
              <mat-datepicker #purchaseDatePicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="third-width">
              <mat-label>Retailer / Store</mat-label>
              <input
                matInput
                formControlName="retailer"
                placeholder="Amazon, Home Depot"
                maxlength="150"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="third-width">
              <mat-label>Purchase Price ($)</mat-label>
              <input matInput type="number" formControlName="purchasePrice" min="0" step="0.01" />
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Estimated Replacement Value ($)</mat-label>
              <input
                matInput
                type="number"
                formControlName="estimatedReplacementValue"
                min="0"
                step="0.01"
              />
            </mat-form-field>

            <div class="date-preset-col half-width">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Return Window End Date</mat-label>
                <input
                  matInput
                  [matDatepicker]="returnDatePicker"
                  formControlName="returnWindowEndDate"
                  placeholder="Return deadline"
                />
                <mat-datepicker-toggle
                  matIconSuffix
                  [for]="returnDatePicker"
                ></mat-datepicker-toggle>
                <mat-datepicker #returnDatePicker></mat-datepicker>
              </mat-form-field>
              <div class="preset-chips-inline">
                <span class="preset-label">Quick:</span>
                <button type="button" class="preset-chip-btn" (click)="applyReturnPreset(14)">
                  +14d
                </button>
                <button type="button" class="preset-chip-btn" (click)="applyReturnPreset(30)">
                  +30d
                </button>
                <button type="button" class="preset-chip-btn" (click)="applyReturnPreset(60)">
                  +60d
                </button>
                <button type="button" class="preset-chip-btn" (click)="applyReturnPreset(90)">
                  +90d
                </button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="date-preset-col half-width">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Warranty Expiration Date</mat-label>
                <input
                  matInput
                  [matDatepicker]="warrantyDatePicker"
                  formControlName="warrantyExpirationDate"
                  placeholder="Warranty end"
                />
                <mat-datepicker-toggle
                  matIconSuffix
                  [for]="warrantyDatePicker"
                ></mat-datepicker-toggle>
                <mat-datepicker #warrantyDatePicker></mat-datepicker>
              </mat-form-field>
              <div class="preset-chips-inline">
                <span class="preset-label">Quick:</span>
                <button type="button" class="preset-chip-btn" (click)="applyWarrantyPreset(1)">
                  +1 yr
                </button>
                <button type="button" class="preset-chip-btn" (click)="applyWarrantyPreset(2)">
                  +2 yr
                </button>
                <button type="button" class="preset-chip-btn" (click)="applyWarrantyPreset(3)">
                  +3 yr
                </button>
                <button type="button" class="preset-chip-btn" (click)="applyWarrantyPreset(5)">
                  +5 yr
                </button>
              </div>
            </div>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Warranty Notes</mat-label>
              <input
                matInput
                formControlName="warrantyNotes"
                placeholder="e.g. Lifetime warranty via manufacturer"
                maxlength="1000"
              />
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Secret / Gift Mode Toggle -->
        <div class="privacy-section">
          <mat-slide-toggle formControlName="isPrivate" color="primary">
            <div class="toggle-label-content">
              <mat-icon>lock</mat-icon>
              <div>
                <strong>Secret / Gift Mode</strong>
                <span class="sub-desc">
                  Hide this item from other household members' views and searches
                </span>
              </div>
            </div>
          </mat-slide-toggle>

          @if (form.get('isPrivate')?.value) {
            <div class="shared-users-wrapper">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Share Privately With (Optional)</mat-label>
                <mat-select
                  formControlName="sharedWithUserIds"
                  multiple
                  placeholder="Select household members"
                >
                  @for (u of householdUsers(); track u.id) {
                    <mat-option [value]="u.id">{{ u.displayName }} ({{ u.username }})</mat-option>
                  }
                </mat-select>
                <mat-hint
                  >Household members chosen here will be able to see and search this item despite
                  Secret Mode.</mat-hint
                >
              </mat-form-field>
            </div>
          }
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="onSubmit()">
        {{ isEditMode ? 'Save Changes' : isCloneMode ? 'Create Cloned Item' : 'Create Item' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .item-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-top: 0.5rem;
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
    .third-width {
      flex: 1;
    }
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .section-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }
    .type-radio-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .radio-label-content {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }
    .sub-desc {
      display: block;
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .shortcode-badge-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .shortcode-pill {
      font-family: monospace;
      font-weight: bold;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background-color: var(--mat-sys-primary-container, #dbe6cf);
      color: var(--mat-sys-on-primary-container, #0d2003);
    }
    .shortcode-path {
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .quantity-highlight-box,
    .dynamic-attributes-box,
    .vault-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 8px;
      background-color: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
    }
    .box-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .dynamic-fields-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .toggle-label-content {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .date-preset-col {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .preset-chips-inline {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: -0.35rem;
      margin-bottom: 0.5rem;
      font-size: 0.75rem;
    }
    .preset-label {
      color: var(--mat-sys-outline);
      font-size: 0.72rem;
    }
    .preset-chip-btn {
      background: var(--mat-sys-surface-container-high, rgba(0, 0, 0, 0.05));
      border: 1px solid var(--mat-sys-outline-variant, #ccc);
      border-radius: 12px;
      padding: 0.1rem 0.5rem;
      font-size: 0.72rem;
      cursor: pointer;
      &:hover {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
    }
    .shared-users-wrapper {
      margin-top: 0.75rem;
    }

    @media (max-width: 600px) {
      .type-radio-group,
      .form-row,
      .dynamic-fields-list {
        grid-template-columns: 1fr;
        flex-direction: column;
      }
    }
  `,
})
export class ItemDialogComponent implements OnInit {
  protected readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<ItemDialogComponent, ItemDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);
  private readonly intakeService = inject(IntakePortabilityService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly ItemTypes = ItemTypes;
  protected readonly ItemStatuses = ItemStatuses;
  protected readonly ItemConditions = ItemConditions;
  protected readonly AttributeFieldTypes = AttributeFieldTypes;

  protected readonly isEditMode = !!this.data.item;
  protected readonly isCloneMode = !this.data.item && !!this.data.cloneFromItem;
  protected readonly isLookingUpBarcode = signal(false);
  protected readonly householdUsers = signal<UserSummaryDto[]>([]);

  protected form!: FormGroup;

  protected readonly selectedCategory = signal<CategoryDto | null>(null);
  protected readonly selectedCategoryTemplates = signal<CategoryAttributeTemplateDto[]>([]);

  get attributeValuesArray(): FormArray {
    return this.form.get('attributeValues') as FormArray;
  }

  ngOnInit(): void {
    this.authService.getUsers().subscribe({
      next: (users) => this.householdUsers.set(users),
      error: (err) => console.error('Failed to load household users', err),
    });

    const src = this.data.item ?? this.data.cloneFromItem;
    const initialCategory = src?.categoryId
      ? (this.data.availableCategories.find((c) => c.id === src.categoryId) ?? null)
      : null;

    this.selectedCategory.set(initialCategory);
    this.selectedCategoryTemplates.set(initialCategory?.attributeTemplates ?? []);

    const initialName = this.isCloneMode
      ? `${this.data.cloneFromItem?.name ?? ''} (Copy)`
      : (src?.name ?? '');

    this.form = this.fb.group({
      name: [initialName, [Validators.required, Validators.maxLength(200)]],
      itemType: [src?.itemType ?? ItemTypes.Unique, [Validators.required]],
      shortCode: [this.isCloneMode ? '' : (src?.shortCode ?? ''), [Validators.maxLength(32)]],
      homeLocationId: [src?.homeLocationId ?? this.data.homeLocationId ?? null],
      categoryId: [src?.categoryId ?? null],
      parentItemId: [src?.parentItemId ?? null],
      condition: [src?.condition ?? ItemConditions.Good],
      status: [src?.status ?? ItemStatuses.InPlace],
      currentQuantity: [src?.currentQuantity ?? 1, [Validators.min(0)]],
      unit: [src?.unit ?? '', [Validators.maxLength(32)]],
      minQuantity: [src?.minQuantity ?? null],
      barcodeNumber: [src?.barcodeNumber ?? '', [Validators.maxLength(64)]],
      brand: [src?.brand ?? '', [Validators.maxLength(100)]],
      modelNumber: [src?.modelNumber ?? '', [Validators.maxLength(100)]],
      serialNumber: [
        this.isCloneMode ? '' : (src?.serialNumber ?? ''),
        [Validators.maxLength(100)],
      ],
      description: [src?.description ?? '', [Validators.maxLength(2000)]],
      aliasesString: [src?.aliases ? src.aliases.join(', ') : ''],
      tagsString: [src?.tags ? src.tags.join(', ') : ''],
      purchaseDate: [this.toDate(src?.purchaseDate)],
      retailer: [src?.retailer ?? '', [Validators.maxLength(150)]],
      purchasePrice: [src?.purchasePrice ?? null],
      estimatedReplacementValue: [src?.estimatedReplacementValue ?? null],
      returnWindowEndDate: [this.toDate(src?.returnWindowEndDate)],
      warrantyExpirationDate: [this.toDate(src?.warrantyExpirationDate)],
      warrantyNotes: [src?.warrantyNotes ?? '', [Validators.maxLength(1000)]],
      isPrivate: [src?.isPrivate ?? false],
      sharedWithUserIds: [src?.sharedWithUserIds ?? []],
      attributeValues: this.fb.array([]),
    });

    this.syncAttributeValuesControls(initialCategory, src?.attributeValues);

    this.form.controls['categoryId'].valueChanges.subscribe((catId: string | null) => {
      const cat = catId
        ? (this.data.availableCategories.find((c) => c.id === catId) ?? null)
        : null;
      this.selectedCategory.set(cat);
      this.selectedCategoryTemplates.set(cat?.attributeTemplates ?? []);
      this.syncAttributeValuesControls(cat);
    });
  }

  private toDate(val?: string | null): Date | null {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  private toIsoOrNull(val?: Date | string | null): string | null {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  applyReturnPreset(days: number): void {
    const rawPurchase = this.form.get('purchaseDate')?.value;
    const base = rawPurchase ? new Date(rawPurchase) : new Date();
    const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    this.form.patchValue({ returnWindowEndDate: target });
  }

  applyWarrantyPreset(years: number): void {
    const rawPurchase = this.form.get('purchaseDate')?.value;
    const base = rawPurchase ? new Date(rawPurchase) : new Date();
    const target = new Date(base);
    target.setFullYear(target.getFullYear() + years);
    this.form.patchValue({ warrantyExpirationDate: target });
  }

  isQuantityType(): boolean {
    return this.form.controls['itemType'].value === ItemTypes.Quantity;
  }

  isNestedOrChild(): boolean {
    const t = this.form.controls['itemType'].value;
    return t === ItemTypes.Nested || this.data.availableParentItems.length > 0;
  }

  getItemTypeIcon(): string {
    const t = this.form?.controls['itemType']?.value;
    switch (t) {
      case ItemTypes.Quantity:
        return 'layers';
      case ItemTypes.Kit:
        return 'cases';
      case ItemTypes.Nested:
        return 'account_tree';
      default:
        return 'fingerprint';
    }
  }

  getItemTypeName(type: ItemType): string {
    switch (type) {
      case ItemTypes.Quantity:
        return 'Quantity';
      case ItemTypes.Kit:
        return 'Kit';
      case ItemTypes.Nested:
        return 'Nested';
      default:
        return 'Unique';
    }
  }

  getOptionsForField(tmplId: string): string[] {
    const tmpl = this.selectedCategoryTemplates().find((t) => t.id === tmplId);
    return tmpl?.options ?? [];
  }

  onLookupBarcode(): void {
    const rawBarcode = this.form.get('barcodeNumber')?.value?.trim();
    if (!rawBarcode) {
      return;
    }

    this.isLookingUpBarcode.set(true);
    this.intakeService.lookupBarcode(rawBarcode).subscribe({
      next: (lookup) => {
        this.isLookingUpBarcode.set(false);
        if (lookup.found) {
          if (!this.form.get('name')?.value && lookup.name) {
            this.form.patchValue({ name: lookup.name });
          }
          if (!this.form.get('brand')?.value && lookup.brand) {
            this.form.patchValue({ brand: lookup.brand });
          }
          if (!this.form.get('modelNumber')?.value && lookup.modelNumber) {
            this.form.patchValue({ modelNumber: lookup.modelNumber });
          }
          if (!this.form.get('description')?.value && lookup.description) {
            this.form.patchValue({ description: lookup.description });
          }
          if (!this.form.get('unit')?.value && lookup.suggestedUnit) {
            this.form.patchValue({ unit: lookup.suggestedUnit });
          }
          if (lookup.matchedCategoryId && !this.form.get('categoryId')?.value) {
            this.form.patchValue({ categoryId: lookup.matchedCategoryId });
          }
          if (lookup.suggestedItemType !== undefined && lookup.suggestedItemType !== null) {
            this.form.patchValue({ itemType: lookup.suggestedItemType });
          }
          this.snackBar.open(`Found: ${lookup.name} (${lookup.source})`, 'OK', { duration: 3000 });
        } else {
          this.snackBar.open('Barcode not found in catalog or household.', 'OK', {
            duration: 3000,
          });
        }
      },
      error: () => {
        this.isLookingUpBarcode.set(false);
        this.snackBar.open('Failed to lookup barcode.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  private syncAttributeValuesControls(
    category: CategoryDto | null,
    existingValues?: ItemAttributeValueDto[],
  ): void {
    this.attributeValuesArray.clear();
    if (!category?.attributeTemplates) {
      return;
    }

    for (const tmpl of category.attributeTemplates) {
      const match = existingValues?.find(
        (v) => v.attributeTemplateId === tmpl.id || v.attributeName === tmpl.name,
      );

      this.attributeValuesArray.push(
        this.fb.group({
          attributeTemplateId: [tmpl.id],
          attributeName: [tmpl.name],
          fieldType: [tmpl.fieldType],
          unit: [tmpl.unit ?? ''],
          value: [match?.value ?? (tmpl.fieldType === AttributeFieldTypes.Boolean ? 'false' : '')],
        }),
      );
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    const val = this.form.value;

    const aliases = val.aliasesString
      ? val.aliasesString
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      : null;

    const tags = val.tagsString
      ? val.tagsString
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      : null;

    interface FormAttributeValue {
      attributeTemplateId?: string | null;
      attributeName: string;
      fieldType: AttributeFieldType;
      unit?: string | null;
      value?: string | boolean | null;
    }

    const attributeValues: UpsertItemAttributeValueRequest[] = (
      (val.attributeValues || []) as FormAttributeValue[]
    ).map((a) => ({
      attributeTemplateId: a.attributeTemplateId || null,
      attributeName: a.attributeName,
      fieldType: a.fieldType,
      unit: a.unit || null,
      value:
        typeof a.value === 'boolean' ? (a.value ? 'true' : 'false') : (a.value?.toString() ?? ''),
    }));

    if (this.isEditMode) {
      const updateReq: UpdateItemRequest = {
        name: val.name.trim(),
        itemType: val.itemType,
        homeLocationId: val.homeLocationId || null,
        categoryId: val.categoryId || null,
        parentItemId: val.parentItemId || null,
        description: val.description?.trim() || null,
        aliases,
        tags,
        status: val.status,
        condition: val.condition,
        brand: val.brand?.trim() || null,
        modelNumber: val.modelNumber?.trim() || null,
        serialNumber: val.serialNumber?.trim() || null,
        barcodeNumber: val.barcodeNumber?.trim() || null,
        currentQuantity: val.currentQuantity ?? 1,
        unit: val.unit?.trim() || null,
        minQuantity: val.minQuantity !== null ? val.minQuantity : null,
        purchaseDate: this.toIsoOrNull(val.purchaseDate),
        retailer: val.retailer?.trim() || null,
        purchasePrice: val.purchasePrice !== null ? val.purchasePrice : null,
        estimatedReplacementValue:
          val.estimatedReplacementValue !== null ? val.estimatedReplacementValue : null,
        returnWindowEndDate: this.toIsoOrNull(val.returnWindowEndDate),
        warrantyExpirationDate: this.toIsoOrNull(val.warrantyExpirationDate),
        warrantyNotes: val.warrantyNotes?.trim() || null,
        isPrivate: val.isPrivate,
        sharedWithUserIds: val.isPrivate ? val.sharedWithUserIds || [] : null,
        attributeValues,
      };

      this.dialogRef.close({ mode: 'update', request: updateReq });
    } else {
      const createReq: CreateItemRequest = {
        name: val.name.trim(),
        itemType: val.itemType,
        homeLocationId: val.homeLocationId || null,
        categoryId: val.categoryId || null,
        parentItemId: val.parentItemId || null,
        shortCode: val.shortCode?.trim() || null,
        description: val.description?.trim() || null,
        aliases,
        tags,
        condition: val.condition,
        brand: val.brand?.trim() || null,
        modelNumber: val.modelNumber?.trim() || null,
        serialNumber: val.serialNumber?.trim() || null,
        barcodeNumber: val.barcodeNumber?.trim() || null,
        currentQuantity: val.currentQuantity ?? 1,
        unit: val.unit?.trim() || null,
        minQuantity: val.minQuantity !== null ? val.minQuantity : null,
        purchaseDate: this.toIsoOrNull(val.purchaseDate),
        retailer: val.retailer?.trim() || null,
        purchasePrice: val.purchasePrice !== null ? val.purchasePrice : null,
        estimatedReplacementValue:
          val.estimatedReplacementValue !== null ? val.estimatedReplacementValue : null,
        returnWindowEndDate: this.toIsoOrNull(val.returnWindowEndDate),
        warrantyExpirationDate: this.toIsoOrNull(val.warrantyExpirationDate),
        warrantyNotes: val.warrantyNotes?.trim() || null,
        isPrivate: val.isPrivate,
        sharedWithUserIds: val.isPrivate ? val.sharedWithUserIds || [] : null,
        attributeValues,
      };

      this.dialogRef.close({ mode: 'create', request: createReq });
    }
  }
}
