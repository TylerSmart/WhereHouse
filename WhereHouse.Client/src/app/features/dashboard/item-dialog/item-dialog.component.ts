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
  templateUrl: './item-dialog.component.html',
  styleUrl: './item-dialog.component.scss',
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
