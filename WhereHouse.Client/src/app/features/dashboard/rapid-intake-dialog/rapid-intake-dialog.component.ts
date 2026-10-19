import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryDto } from '../../../core/models/category.models';
import { RapidIntakeItemRequest } from '../../../core/models/intake-portability.models';
import { ItemDto, ItemTypes, type ItemType } from '../../../core/models/item.models';
import { LocationNodeDto } from '../../../core/models/location.models';
import { IntakePortabilityService } from '../../../core/services/intake-portability/intake-portability.service';
import { ItemService } from '../../../core/services/item/item.service';

export interface RapidIntakeDialogData {
  initialLocationId?: string | null;
  availableLocations: LocationNodeDto[];
  availableCategories: CategoryDto[];
}

export interface RapidIntakeDialogResult {
  createdCount: number;
  items: ItemDto[];
}

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
    MatChipsModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  selector: 'app-rapid-intake-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="title-icon">bolt</mat-icon>
      <div class="title-text">
        <span>Rapid-Fire Intake Mode</span>
        <span class="subtitle">Streamlined intake with locked context and barcode lookup</span>
      </div>
      <span class="session-badge" [class.has-items]="sessionItems().length > 0">
        {{ sessionItems().length }} Added
      </span>
    </h2>

    <mat-dialog-content class="rapid-content">
      <!-- Locked Context Bar -->
      <section class="context-bar" aria-label="Locked Context Configuration">
        <div class="context-header">
          <mat-icon class="context-icon">lock</mat-icon>
          <span class="context-title">Locked Context (Sticky for Batch)</span>
        </div>

        <div class="context-controls">
          <mat-form-field appearance="outline" class="context-field">
            <mat-label>Locked Location / Bin</mat-label>
            <mat-select
              [value]="lockedLocationId()"
              (selectionChange)="lockedLocationId.set($event.value)"
            >
              <mat-option [value]="null"><em>Unassigned</em></mat-option>
              @for (loc of data.availableLocations; track loc.id) {
                <mat-option [value]="loc.id"> [{{ loc.shortCode }}] {{ loc.fullPath }} </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="context-field">
            <mat-label>Locked Category</mat-label>
            <mat-select
              [value]="lockedCategoryId()"
              (selectionChange)="lockedCategoryId.set($event.value)"
            >
              <mat-option [value]="null"><em>Auto / None</em></mat-option>
              @for (cat of data.availableCategories; track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="context-field-sm">
            <mat-label>Default Type</mat-label>
            <mat-select
              [value]="defaultItemType()"
              (selectionChange)="defaultItemType.set($event.value)"
            >
              <mat-option [value]="ItemTypes.Unique">Unique (1-of-1)</mat-option>
              <mat-option [value]="ItemTypes.Quantity">Quantity / Bulk</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-slide-toggle
            class="context-toggle"
            [checked]="defaultIsPrivate()"
            (change)="defaultIsPrivate.set($event.checked)"
          >
            Secret / Private
          </mat-slide-toggle>
        </div>
      </section>

      <!-- Fast Entry Intake Form -->
      <form [formGroup]="form" class="entry-form" (ngSubmit)="onSaveAndAddNext()">
        <div class="form-row">
          <mat-form-field appearance="outline" class="barcode-field">
            <mat-label>Scan Barcode / UPC (Press Enter)</mat-label>
            <input
              #barcodeInput
              matInput
              formControlName="barcodeNumber"
              placeholder="e.g. 0885911362757"
              maxlength="64"
              (keydown.enter)="$event.preventDefault(); onBarcodeLookup()"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              [disabled]="isLookingUp() || !form.get('barcodeNumber')?.value"
              (click)="onBarcodeLookup()"
              matTooltip="Lookup product info by UPC/EAN"
            >
              <mat-icon>manage_search</mat-icon>
            </button>
            <mat-hint>Press Enter to auto-fill product details</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="name-field">
            <mat-label>Item Name *</mat-label>
            <input
              #nameInput
              matInput
              formControlName="name"
              placeholder="e.g. DeWalt 20V Hammer Drill"
              required
              maxlength="200"
              (keydown.enter)="$event.preventDefault(); onSaveAndAddNext()"
            />
          </mat-form-field>
        </div>

        @if (defaultItemType() === ItemTypes.Quantity) {
          <div class="form-row">
            <mat-form-field appearance="outline" class="qty-field">
              <mat-label>Quantity</mat-label>
              <input matInput type="number" formControlName="quantity" min="0.01" step="1" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="unit-field">
              <mat-label>Unit of Measure</mat-label>
              <input
                matInput
                formControlName="unit"
                placeholder="pcs, roll, box, ft"
                maxlength="32"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-field">
              <mat-label>Pre-Printed QR Token (Optional)</mat-label>
              <input matInput formControlName="bindQrToken" placeholder="QR-xxxx" maxlength="64" />
              <mat-icon matSuffix matTooltip="Bind sticker immediately">qr_code_2</mat-icon>
            </mat-form-field>
          </div>
        } @else {
          <div class="form-row">
            <mat-form-field appearance="outline" class="half-field">
              <mat-label>Brand / Manufacturer</mat-label>
              <input
                matInput
                formControlName="brand"
                placeholder="e.g. Milwaukee"
                maxlength="100"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-field">
              <mat-label>Model #</mat-label>
              <input
                matInput
                formControlName="modelNumber"
                placeholder="e.g. 2853-20"
                maxlength="100"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-field">
              <mat-label>Pre-Printed QR Token (Optional)</mat-label>
              <input matInput formControlName="bindQrToken" placeholder="QR-xxxx" maxlength="64" />
              <mat-icon matSuffix matTooltip="Bind sticker immediately">qr_code_2</mat-icon>
            </mat-form-field>
          </div>
        }

        <div class="action-submit-bar">
          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="submit-button"
            [disabled]="form.invalid || isSaving()"
          >
            <mat-icon>add_circle</mat-icon>
            <span>Save &amp; Add Next (Enter)</span>
          </button>
        </div>
      </form>

      <mat-divider></mat-divider>

      <!-- Live Session Feed -->
      <section class="session-feed" aria-label="Session Items Log">
        <div class="feed-header">
          <span class="feed-title">Session Feed ({{ sessionItems().length }} items added)</span>
          @if (sessionItems().length > 0) {
            <span class="feed-hint">Adjust quantity, clone back into form, or undo</span>
          }
        </div>

        @if (sessionItems().length === 0) {
          <div class="empty-feed">
            <mat-icon class="empty-feed-icon">inventory_2</mat-icon>
            <p>No items added yet. Scan a barcode or type an item name above.</p>
          </div>
        } @else {
          <div class="feed-list">
            @for (item of sessionItems(); track item.id) {
              <div class="feed-item-card">
                <div class="item-meta">
                  <span class="item-code">{{ item.shortCode }}</span>
                  <div class="item-info">
                    <span class="item-name">{{ item.name }}</span>
                    <span class="item-sub">
                      @if (item.brand || item.modelNumber) {
                        <span>{{ item.brand }} {{ item.modelNumber }} • </span>
                      }
                      <span>{{ item.homeLocationFullPath || 'Unassigned' }}</span>
                      @if (item.categoryName) {
                        <span> • {{ item.categoryName }}</span>
                      }
                    </span>
                  </div>
                </div>

                <div class="item-actions">
                  @if (item.itemType === ItemTypes.Quantity) {
                    <div class="qty-stepper">
                      <button
                        mat-icon-button
                        type="button"
                        (click)="onAdjustQuantity(item, -1)"
                        matTooltip="Decrease quantity"
                      >
                        <mat-icon>remove</mat-icon>
                      </button>
                      <span class="qty-display"
                        >{{ item.currentQuantity }} {{ item.unit || '' }}</span
                      >
                      <button
                        mat-icon-button
                        type="button"
                        (click)="onAdjustQuantity(item, 1)"
                        matTooltip="Increase quantity"
                      >
                        <mat-icon>add</mat-icon>
                      </button>
                    </div>
                  }

                  <button
                    mat-icon-button
                    type="button"
                    (click)="onCloneToForm(item)"
                    matTooltip="Copy details back to form"
                  >
                    <mat-icon>copy_all</mat-icon>
                  </button>

                  <button
                    mat-icon-button
                    color="warn"
                    type="button"
                    (click)="onUndoItem(item)"
                    matTooltip="Undo / Delete item"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Done ({{ sessionItems().length }} Created)</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 0.5rem;
    }
    .title-icon {
      color: var(--mat-sys-primary, #386a20);
    }
    .title-text {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .subtitle {
      font-size: 0.75rem;
      font-weight: normal;
      opacity: 0.7;
    }
    .session-badge {
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      background: var(--mat-sys-surface-variant, rgba(0, 0, 0, 0.08));
      color: var(--mat-sys-on-surface-variant, inherit);
    }
    .session-badge.has-items {
      background: var(--mat-sys-primary-container, #dbe6cf);
      color: var(--mat-sys-on-primary-container, #0d2003);
    }
    .rapid-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 80vh;
    }
    .context-bar {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      background: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.03));
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
      border-radius: 8px;
    }
    .context-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.8;
    }
    .context-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }
    .context-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .context-field {
      flex: 2;
      min-width: 180px;
    }
    .context-field-sm {
      flex: 1;
      min-width: 140px;
    }
    .context-toggle {
      font-size: 0.85rem;
    }
    .entry-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .form-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .barcode-field {
      flex: 1.2;
      min-width: 200px;
    }
    .name-field {
      flex: 2;
      min-width: 220px;
    }
    .qty-field {
      flex: 0.8;
      min-width: 90px;
    }
    .unit-field {
      flex: 1;
      min-width: 110px;
    }
    .half-field {
      flex: 1;
      min-width: 140px;
    }
    .action-submit-bar {
      display: flex;
      justify-content: flex-end;
    }
    .submit-button {
      padding: 0.5rem 1.5rem;
      font-weight: 600;
    }
    .session-feed {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .feed-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .feed-hint {
      font-size: 0.75rem;
      font-weight: normal;
      opacity: 0.7;
    }
    .empty-feed {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem;
      opacity: 0.6;
      gap: 0.5rem;
      text-align: center;
    }
    .empty-feed-icon {
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
    }
    .feed-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 220px;
      overflow-y: auto;
    }
    .feed-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.04));
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
    }
    .item-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      overflow: hidden;
    }
    .item-code {
      font-family: monospace;
      font-weight: bold;
      font-size: 0.85rem;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background: var(--mat-sys-secondary-container, #e2e3d8);
      color: var(--mat-sys-on-secondary-container, #1c1d18);
    }
    .item-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .item-name {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-sub {
      font-size: 0.75rem;
      opacity: 0.75;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }
    .qty-stepper {
      display: flex;
      align-items: center;
      gap: 0.1rem;
      background: var(--mat-sys-surface-container-high, rgba(0, 0, 0, 0.06));
      border-radius: 16px;
      padding: 0 0.25rem;
    }
    .qty-display {
      font-size: 0.8rem;
      font-weight: bold;
      padding: 0 0.25rem;
    }

    @media (max-width: 600px) {
      .context-controls,
      .form-row {
        flex-direction: column;
      }
      .context-field,
      .context-field-sm,
      .barcode-field,
      .name-field,
      .half-field {
        width: 100%;
      }
    }
  `,
})
export class RapidIntakeDialogComponent implements OnInit {
  protected readonly data = inject<RapidIntakeDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<RapidIntakeDialogComponent, RapidIntakeDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);
  private readonly intakeService = inject(IntakePortabilityService);
  private readonly itemService = inject(ItemService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('barcodeInput') private readonly barcodeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('nameInput') private readonly nameInput?: ElementRef<HTMLInputElement>;

  protected readonly ItemTypes = ItemTypes;

  // Sticky Locked Context
  protected readonly lockedLocationId = signal<string | null>(this.data.initialLocationId ?? null);
  protected readonly lockedCategoryId = signal<string | null>(null);
  protected readonly defaultItemType = signal<ItemType>(ItemTypes.Unique);
  protected readonly defaultIsPrivate = signal<boolean>(false);

  // Live session state
  protected readonly sessionItems = signal<ItemDto[]>([]);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly isLookingUp = signal<boolean>(false);

  protected form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      barcodeNumber: ['', [Validators.maxLength(64)]],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      quantity: [1, [Validators.min(0.01)]],
      unit: ['', [Validators.maxLength(32)]],
      brand: ['', [Validators.maxLength(100)]],
      modelNumber: ['', [Validators.maxLength(100)]],
      bindQrToken: ['', [Validators.maxLength(64)]],
    });
  }

  onBarcodeLookup(): void {
    const rawBarcode = this.form.get('barcodeNumber')?.value?.trim();
    if (!rawBarcode) {
      this.nameInput?.nativeElement.focus();
      return;
    }

    this.isLookingUp.set(true);
    this.intakeService.lookupBarcode(rawBarcode).subscribe({
      next: (lookup) => {
        this.isLookingUp.set(false);
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
          if (!this.form.get('unit')?.value && lookup.suggestedUnit) {
            this.form.patchValue({ unit: lookup.suggestedUnit });
          }
          if (lookup.matchedCategoryId && !this.lockedCategoryId()) {
            this.lockedCategoryId.set(lookup.matchedCategoryId);
          }
          if (lookup.suggestedItemType !== undefined && lookup.suggestedItemType !== null) {
            this.defaultItemType.set(lookup.suggestedItemType);
          }
          this.snackBar.open(`Found: ${lookup.name}`, 'OK', { duration: 2500 });
        } else {
          this.snackBar.open('Barcode not in catalog.', 'OK', { duration: 2000 });
        }
        this.nameInput?.nativeElement.focus();
      },
      error: () => {
        this.isLookingUp.set(false);
        this.nameInput?.nativeElement.focus();
      },
    });
  }

  onSaveAndAddNext(): void {
    if (this.form.invalid || this.isSaving()) {
      return;
    }

    const val = this.form.value;
    const isQty = this.defaultItemType() === ItemTypes.Quantity;

    const req: RapidIntakeItemRequest = {
      name: val.name.trim(),
      homeLocationId: this.lockedLocationId() || null,
      categoryId: this.lockedCategoryId() || null,
      itemType: this.defaultItemType(),
      isPrivate: this.defaultIsPrivate(),
      barcodeNumber: val.barcodeNumber?.trim() || null,
      brand: val.brand?.trim() || null,
      modelNumber: val.modelNumber?.trim() || null,
      currentQuantity: isQty ? (val.quantity ?? 1) : 1,
      unit: isQty ? val.unit?.trim() || null : null,
      bindQrToken: val.bindQrToken?.trim() || null,
    };

    this.isSaving.set(true);
    this.intakeService.createRapidItem(req).subscribe({
      next: (created) => {
        this.isSaving.set(false);
        this.sessionItems.update((items) => [created, ...items]);

        // Reset fast entry inputs while preserving locked context
        this.form.reset({
          barcodeNumber: '',
          name: '',
          quantity: 1,
          unit: '',
          brand: '',
          modelNumber: '',
          bindQrToken: '',
        });

        this.barcodeInput?.nativeElement.focus();
        this.snackBar.open(`Added [${created.shortCode}] ${created.name}`, undefined, {
          duration: 2000,
        });
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err?.error?.detail || err?.error?.title || 'Failed to create item.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  onAdjustQuantity(item: ItemDto, delta: number): void {
    const newQty = (item.currentQuantity ?? 1) + delta;
    if (newQty < 0) {
      return;
    }

    this.itemService.adjustQuantity(item.id, { delta }).subscribe({
      next: (updated) => {
        this.sessionItems.update((items) =>
          items.map((i) =>
            i.id === item.id ? { ...i, currentQuantity: updated.currentQuantity } : i,
          ),
        );
      },
      error: () => {
        this.snackBar.open('Failed to update quantity.', 'Dismiss', { duration: 2500 });
      },
    });
  }

  onCloneToForm(item: ItemDto): void {
    this.form.patchValue({
      name: item.name,
      barcodeNumber: item.barcodeNumber ?? '',
      brand: item.brand ?? '',
      modelNumber: item.modelNumber ?? '',
      quantity: item.currentQuantity,
      unit: item.unit ?? '',
    });
    if (item.categoryId) {
      this.lockedCategoryId.set(item.categoryId);
    }
    this.defaultItemType.set(item.itemType);
    this.nameInput?.nativeElement.focus();
  }

  onUndoItem(item: ItemDto): void {
    this.itemService.deleteItem(item.id).subscribe({
      next: () => {
        this.sessionItems.update((items) => items.filter((i) => i.id !== item.id));
        this.snackBar.open(`Deleted [${item.shortCode}]`, undefined, { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete item.', 'Dismiss', { duration: 2500 });
      },
    });
  }

  onClose(): void {
    this.dialogRef.close({
      createdCount: this.sessionItems().length,
      items: this.sessionItems(),
    });
  }
}
