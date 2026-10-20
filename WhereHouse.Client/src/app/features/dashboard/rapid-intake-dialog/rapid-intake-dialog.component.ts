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
  templateUrl: './rapid-intake-dialog.component.html',
  styleUrl: './rapid-intake-dialog.component.scss',
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
