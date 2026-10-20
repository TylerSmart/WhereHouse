import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserSummaryDto } from '../../../core/models/auth.models';
import { CategoryAttributeTemplateDto, CategoryDto } from '../../../core/models/category.models';
import { DISPOSITION_REASON_LABELS, ItemDto } from '../../../core/models/item.models';
import { LocationNodeDto } from '../../../core/models/location.models';
import { SmartSearchParams, SmartSearchResponseDto } from '../../../core/models/search.models';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LifecycleService } from '../../../core/services/lifecycle/lifecycle.service';
import { SearchService } from '../../../core/services/search/search.service';

export interface SmartSearchDialogData {
  availableLocations: LocationNodeDto[];
  availableCategories: CategoryDto[];
  initialQuery?: string;
}

export type SmartSearchResultAction =
  | { action: 'selectLocation'; locationId: string }
  | { action: 'editItem'; item: ItemDto }
  | { action: 'openAttachments'; item: ItemDto };

@Component({
  imports: [
    CommonModule,
    FormsModule,
    MatDialogContent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-smart-search-dialog',
  templateUrl: './smart-search-dialog.component.html',
  styleUrl: './smart-search-dialog.component.scss',
})
export class SmartSearchDialogComponent implements OnInit {
  protected readonly data = inject<SmartSearchDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<SmartSearchDialogComponent>);
  private readonly searchService = inject(SearchService);
  private readonly lifecycleService = inject(LifecycleService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly dispositionReasonLabels = DISPOSITION_REASON_LABELS;
  protected readonly query = signal<string>(this.data.initialQuery ?? '');
  protected readonly filtersOpen = signal<boolean>(false);
  protected readonly locationId = signal<string | null>(null);
  protected readonly categoryId = signal<string | null>(null);
  protected readonly ownerUserId = signal<string | null>(null);
  protected readonly householdUsers = signal<UserSummaryDto[]>([]);
  protected readonly selectedAttributeName = signal<string | null>(null);
  protected readonly attributeValue = signal<string>('');
  protected readonly attributeMinNumber = signal<number | null>(null);
  protected readonly attributeMaxNumber = signal<number | null>(null);
  protected readonly outOfPlaceOnly = signal<boolean>(false);
  protected readonly lowStockOnly = signal<boolean>(false);
  protected readonly includeArchived = signal<boolean>(true);
  protected readonly includeAttachmentText = signal<boolean>(true);
  protected readonly graveyardExpanded = signal<boolean>(false);

  protected readonly loading = signal<boolean>(false);
  protected readonly results = signal<SmartSearchResponseDto | null>(null);

  protected readonly availableAttributeTemplates = computed<CategoryAttributeTemplateDto[]>(() => {
    const catId = this.categoryId();
    if (!catId) return [];
    const cat = this.data.availableCategories.find((c) => c.id === catId);
    return cat?.attributeTemplates ?? [];
  });

  protected readonly isNumericAttributeSelected = computed<boolean>(() => {
    const attrName = this.selectedAttributeName();
    if (!attrName) return false;
    const tmpl = this.availableAttributeTemplates().find((t) => t.name === attrName);
    return tmpl?.fieldType === 1; // Number = 1
  });

  protected readonly activeFilterCount = computed<number>(() => {
    let count = 0;
    if (this.locationId()) count++;
    if (this.categoryId()) count++;
    if (this.ownerUserId()) count++;
    if (this.selectedAttributeName()) count++;
    if (this.outOfPlaceOnly()) count++;
    if (this.lowStockOnly()) count++;
    if (!this.includeArchived()) count++;
    if (!this.includeAttachmentText()) count++;
    return count;
  });

  ngOnInit(): void {
    this.authService.getUsers().subscribe({
      next: (users) => this.householdUsers.set(users),
      error: (err) => console.error('Failed to load household users', err),
    });
    this.executeSearch();
  }

  toggleFilters(): void {
    this.filtersOpen.set(!this.filtersOpen());
  }

  clearQuery(): void {
    this.query.set('');
    this.executeSearch();
  }

  onCategorySelected(catId: string | null): void {
    this.categoryId.set(catId);
    this.selectedAttributeName.set(null);
    this.attributeValue.set('');
    this.attributeMinNumber.set(null);
    this.attributeMaxNumber.set(null);
    this.executeSearch();
  }

  toggleOutOfPlace(): void {
    this.outOfPlaceOnly.update((v) => !v);
    this.executeSearch();
  }

  toggleLowStock(): void {
    this.lowStockOnly.update((v) => !v);
    this.executeSearch();
  }

  toggleIncludeArchived(): void {
    this.includeArchived.update((v) => !v);
    this.executeSearch();
  }

  toggleIncludeAttachmentText(): void {
    this.includeAttachmentText.update((v) => !v);
    this.executeSearch();
  }

  clearAllFilters(): void {
    this.locationId.set(null);
    this.categoryId.set(null);
    this.ownerUserId.set(null);
    this.selectedAttributeName.set(null);
    this.attributeValue.set('');
    this.attributeMinNumber.set(null);
    this.attributeMaxNumber.set(null);
    this.outOfPlaceOnly.set(false);
    this.lowStockOnly.set(false);
    this.includeArchived.set(true);
    this.includeAttachmentText.set(true);
    this.executeSearch();
  }

  executeSearch(): void {
    this.loading.set(true);

    const params: SmartSearchParams = {
      q: this.query().trim() || null,
      locationId: this.locationId(),
      categoryId: this.categoryId(),
      ownerUserId: this.ownerUserId(),
      outOfPlaceOnly: this.outOfPlaceOnly() || null,
      lowStockOnly: this.lowStockOnly() || null,
      attributeName: this.selectedAttributeName(),
      attributeValue: this.attributeValue().trim() || null,
      attributeMinNumber: this.attributeMinNumber(),
      attributeMaxNumber: this.attributeMaxNumber(),
      includeArchived: this.includeArchived(),
      includeAttachmentText: this.includeAttachmentText(),
    };

    this.searchService.search(params).subscribe({
      next: (resp) => {
        this.results.set(resp);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  chooseLocation(locationId: string): void {
    this.dialogRef.close({ action: 'selectLocation', locationId } as SmartSearchResultAction);
  }

  editItem(item: ItemDto): void {
    this.dialogRef.close({ action: 'editItem', item } as SmartSearchResultAction);
  }

  openAttachments(item: ItemDto): void {
    this.dialogRef.close({ action: 'openAttachments', item } as SmartSearchResultAction);
  }

  restoreItem(item: ItemDto): void {
    this.loading.set(true);
    this.lifecycleService.restoreArchivedItem(item.id).subscribe({
      next: (restored) => {
        this.snackBar.open(`Restored ${restored.name} to Home Bin!`, 'Close', { duration: 3000 });
        this.executeSearch();
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to restore item.', 'Close', {
          duration: 4000,
        });
      },
    });
  }
}
