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
  template: `
    <div class="search-modal-container">
      <!-- Search Input Header -->
      <div class="search-input-bar">
        <mat-icon class="search-icon">search</mat-icon>
        <input
          #searchInput
          type="text"
          class="command-input"
          placeholder="Smart search items, locations, barcodes, tags, notes... (Press Enter)"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          (keydown.enter)="executeSearch()"
        />
        @if (query()) {
          <button mat-icon-button (click)="clearQuery()" aria-label="Clear query">
            <mat-icon>close</mat-icon>
          </button>
        }
        <button
          mat-stroked-button
          class="filter-toggle-btn"
          [class.active]="filtersOpen()"
          (click)="toggleFilters()"
        >
          <mat-icon>tune</mat-icon>
          <span>Filters</span>
          @if (activeFilterCount() > 0) {
            <span class="filter-count-badge">{{ activeFilterCount() }}</span>
          }
        </button>
      </div>

      <!-- Collapsible Faceted Filter Panel -->
      @if (filtersOpen()) {
        <div class="faceted-filter-panel">
          <div class="filter-grid">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Location Subtree</mat-label>
              <mat-select
                [ngModel]="locationId()"
                (ngModelChange)="locationId.set($event); executeSearch()"
              >
                <mat-option [value]="null">All Locations</mat-option>
                @for (loc of data.availableLocations; track loc.id) {
                  <mat-option [value]="loc.id">{{ loc.fullPath }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Category</mat-label>
              <mat-select [ngModel]="categoryId()" (ngModelChange)="onCategorySelected($event)">
                <mat-option [value]="null">All Categories</mat-option>
                @for (cat of data.availableCategories; track cat.id) {
                  <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Owner / Shared Member</mat-label>
              <mat-select
                [ngModel]="ownerUserId()"
                (ngModelChange)="ownerUserId.set($event); executeSearch()"
              >
                <mat-option [value]="null">All Members</mat-option>
                @for (usr of householdUsers(); track usr.id) {
                  <mat-option [value]="usr.id"
                    >{{ usr.displayName }} ({{ usr.username }})</mat-option
                  >
                }
              </mat-select>
            </mat-form-field>

            @if (availableAttributeTemplates().length > 0) {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Attribute</mat-label>
                <mat-select
                  [ngModel]="selectedAttributeName()"
                  (ngModelChange)="selectedAttributeName.set($event); executeSearch()"
                >
                  <mat-option [value]="null">Any Attribute</mat-option>
                  @for (tmpl of availableAttributeTemplates(); track tmpl.id) {
                    <mat-option [value]="tmpl.name">{{ tmpl.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              @if (isNumericAttributeSelected()) {
                <div class="numeric-range-row">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Min Number</mat-label>
                    <input
                      matInput
                      type="number"
                      [ngModel]="attributeMinNumber()"
                      (ngModelChange)="attributeMinNumber.set($event); executeSearch()"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Max Number</mat-label>
                    <input
                      matInput
                      type="number"
                      [ngModel]="attributeMaxNumber()"
                      (ngModelChange)="attributeMaxNumber.set($event); executeSearch()"
                    />
                  </mat-form-field>
                </div>
              } @else if (selectedAttributeName()) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Attribute Value</mat-label>
                  <input
                    matInput
                    placeholder="Search value..."
                    [ngModel]="attributeValue()"
                    (ngModelChange)="attributeValue.set($event); executeSearch()"
                  />
                </mat-form-field>
              }
            }
          </div>

          <div class="chips-row">
            <mat-chip-set>
              <mat-chip-option [selected]="outOfPlaceOnly()" (click)="toggleOutOfPlace()">
                Out of Place
              </mat-chip-option>
              <mat-chip-option [selected]="lowStockOnly()" (click)="toggleLowStock()">
                Low Stock
              </mat-chip-option>
              <mat-chip-option [selected]="includeArchived()" (click)="toggleIncludeArchived()">
                Include Graveyard (Archived)
              </mat-chip-option>
              <mat-chip-option
                [selected]="includeAttachmentText()"
                (click)="toggleIncludeAttachmentText()"
              >
                Search PDF Manuals
              </mat-chip-option>
            </mat-chip-set>

            @if (activeFilterCount() > 0) {
              <button mat-button color="warn" (click)="clearAllFilters()">Reset Filters</button>
            }
          </div>
        </div>
      }

      <!-- Results Body -->
      <mat-dialog-content class="results-content">
        @if (loading()) {
          <div class="loading-state">
            <mat-progress-spinner diameter="32" mode="indeterminate" />
            <span>Searching WhereHouse inventory...</span>
          </div>
        } @else if (results(); as res) {
          @if (res.totalCount === 0 && res.locations.length === 0) {
            <div class="empty-results">
              <mat-icon class="empty-icon">search_off</mat-icon>
              <h3>No matching items or locations found</h3>
              <p>Try broadening your query or clearing filter facets.</p>
            </div>
          }

          <!-- Matching Locations Section -->
          @if (res.locations.length > 0) {
            <div class="result-section">
              <h4 class="section-title">
                <mat-icon>place</mat-icon>
                <span>Locations &amp; Containers ({{ res.locations.length }})</span>
              </h4>
              <div class="locations-grid">
                @for (loc of res.locations; track loc.id) {
                  <button type="button" class="location-hit-card" (click)="chooseLocation(loc.id)">
                    <mat-icon class="loc-icon">
                      {{ loc.nodeType === 1 ? 'inventory_2' : 'location_on' }}
                    </mat-icon>
                    <div class="loc-hit-info">
                      <div class="loc-name-row">
                        <span class="loc-name">{{ loc.name }}</span>
                        <span class="loc-code">{{ loc.shortCode }}</span>
                      </div>
                      <span class="loc-path">{{ loc.fullPath }}</span>
                    </div>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Matching Active Items Section -->
          @if (res.activeItems.length > 0) {
            <div class="result-section">
              <h4 class="section-title">
                <mat-icon>inventory</mat-icon>
                <span>Active Items ({{ res.activeItems.length }})</span>
              </h4>
              <div class="items-list">
                @for (itm of res.activeItems; track itm.id) {
                  <div class="item-result-row">
                    <div class="item-main-col">
                      <div class="item-title-line">
                        <span class="item-code">{{ itm.shortCode }}</span>
                        <span class="item-name">{{ itm.name }}</span>
                        @if (itm.brand) {
                          <span class="item-brand">{{ itm.brand }}</span>
                        }
                        @if (itm.categoryName) {
                          <span class="cat-chip">{{ itm.categoryName }}</span>
                        }
                        @if ((itm.attachmentCount ?? 0) > 0) {
                          <span class="attachment-badge" matTooltip="Attachments count">
                            <mat-icon>attach_file</mat-icon>
                            {{ itm.attachmentCount }}
                          </span>
                        }
                      </div>

                      <div class="item-sub-line">
                        @if (itm.homeLocationFullPath) {
                          <span class="item-location">
                            <mat-icon class="inline-icon">place</mat-icon>
                            {{ itm.homeLocationFullPath }}
                          </span>
                        }
                        @if (itm.currentQuantity !== undefined) {
                          <span class="item-qty">
                            Qty: {{ itm.currentQuantity }} {{ itm.unit || '' }}
                          </span>
                        }
                      </div>
                    </div>

                    <div class="item-actions-col">
                      @if (itm.homeLocationId) {
                        <button
                          mat-icon-button
                          (click)="chooseLocation(itm.homeLocationId)"
                          matTooltip="Jump to Location"
                          aria-label="Jump to Location"
                        >
                          <mat-icon>my_location</mat-icon>
                        </button>
                      }
                      <button
                        mat-icon-button
                        (click)="openAttachments(itm)"
                        matTooltip="Attachments Vault"
                        aria-label="Attachments Vault"
                      >
                        <mat-icon>attach_file</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        (click)="editItem(itm)"
                        matTooltip="Edit Item"
                        aria-label="Edit Item"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Graveyard / Archived Items Section -->
          @if (res.archivedItems.length > 0) {
            <div class="graveyard-section">
              <button
                type="button"
                class="graveyard-header-toggle"
                (click)="graveyardExpanded.set(!graveyardExpanded())"
              >
                <div class="graveyard-header-left">
                  <mat-icon class="graveyard-icon">inventory_2</mat-icon>
                  <span class="graveyard-title">
                    Found in Graveyard / Archived ({{ res.archivedItems.length }})
                  </span>
                </div>
                <mat-icon>{{ graveyardExpanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
              </button>

              @if (graveyardExpanded()) {
                <div class="graveyard-list">
                  @for (arch of res.archivedItems; track arch.id) {
                    <div class="item-result-row archived-row">
                      <div class="item-main-col">
                        <div class="item-title-line">
                          <span class="item-code">{{ arch.shortCode }}</span>
                          <span class="item-name">{{ arch.name }}</span>
                          <span class="archived-badge">
                            {{
                              arch.dispositionReason !== null &&
                              arch.dispositionReason !== undefined
                                ? dispositionReasonLabels[arch.dispositionReason]
                                : 'Archived'
                            }}
                          </span>
                          @if (arch.archivedAt) {
                            <span class="archived-date">{{
                              arch.archivedAt | date: 'mediumDate'
                            }}</span>
                          }
                          @if (arch.salePrice !== null && arch.salePrice !== undefined) {
                            <span class="archived-price">{{ arch.salePrice | currency }}</span>
                          }
                        </div>
                        <div class="item-sub-line">
                          <span>Previously in {{ arch.homeLocationFullPath || 'Unassigned' }}</span>
                          @if (arch.dispositionNote) {
                            <span class="archived-note">&bull; {{ arch.dispositionNote }}</span>
                          }
                        </div>
                      </div>
                      <div class="item-actions-col">
                        <button
                          mat-icon-button
                          color="primary"
                          (click)="restoreItem(arch)"
                          matTooltip="Restore to Home Bin"
                          aria-label="Restore to Home Bin"
                        >
                          <mat-icon>restore_from_trash</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          (click)="openAttachments(arch)"
                          matTooltip="Attachments Vault"
                          aria-label="Attachments Vault"
                        >
                          <mat-icon>attach_file</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          (click)="editItem(arch)"
                          matTooltip="View / Edit Item"
                          aria-label="View / Edit Item"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      </mat-dialog-content>

      <div class="dialog-footer">
        <span class="keyboard-tip">
          <kbd>Ctrl+K</kbd> to open &bull; <kbd>Enter</kbd> to search &bull; <kbd>Esc</kbd> to close
        </span>
        <button mat-button (click)="dialogRef.close()">Close</button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .search-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
    }
    .search-input-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .search-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: var(--mat-sys-primary);
    }
    .command-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 1.1rem;
      font-family: inherit;
      background: transparent;
      color: var(--mat-sys-on-surface);
    }
    .command-input::placeholder {
      color: var(--mat-sys-outline);
      font-size: 0.95rem;
    }
    .filter-toggle-btn {
      position: relative;
    }
    .filter-toggle-btn.active {
      background: var(--mat-sys-secondary-container);
    }
    .filter-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-size: 0.7rem;
      font-weight: 700;
      margin-left: 0.25rem;
    }
    .faceted-filter-panel {
      padding: 0.75rem 1.25rem;
      background: var(--mat-sys-surface-container-low);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.6rem;
    }
    .numeric-range-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.4rem;
    }
    .chips-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .results-content {
      padding: 1rem 1.25rem;
      min-height: 250px;
      max-height: 520px;
      overflow-y: auto;
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .empty-results {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.4;
      margin-bottom: 0.5rem;
    }
    .empty-results h3 {
      margin: 0 0 0.25rem;
    }
    .empty-results p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--mat-sys-outline);
    }
    .result-section {
      margin-bottom: 1.25rem;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant);
    }
    .section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .locations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.5rem;
    }
    .location-hit-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      width: 100%;
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }
    .location-hit-card:hover {
      background: var(--mat-sys-surface-container-high);
      border-color: var(--mat-sys-primary);
    }
    .loc-icon {
      color: var(--mat-sys-primary);
    }
    .loc-hit-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .loc-name-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .loc-name {
      font-weight: 600;
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .loc-code {
      font-family: monospace;
      font-size: 0.75rem;
      background: rgba(127, 127, 127, 0.15);
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }
    .loc-path {
      font-size: 0.75rem;
      color: var(--mat-sys-outline);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .item-result-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      transition: background 0.15s ease;
    }
    .item-result-row:hover {
      background: var(--mat-sys-surface-container);
    }
    .item-main-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .item-title-line {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .item-code {
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 600;
      background: rgba(127, 127, 127, 0.15);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
    }
    .item-name {
      font-weight: 600;
      font-size: 0.92rem;
    }
    .item-brand {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .cat-chip {
      font-size: 0.75rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      padding: 0.1rem 0.4rem;
      border-radius: 12px;
      font-weight: 500;
    }
    .attachment-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      font-size: 0.75rem;
      color: var(--mat-sys-primary);
      background: rgba(var(--mat-sys-primary), 0.1);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-weight: 500;
    }
    .attachment-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .item-sub-line {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.78rem;
      color: var(--mat-sys-outline);
    }
    .item-location {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
    }
    .inline-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .item-actions-col {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      flex-shrink: 0;
    }
    .graveyard-section {
      margin-top: 1rem;
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: 8px;
      overflow: hidden;
    }
    .graveyard-header-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-surface-container-high);
      border: none;
      cursor: pointer;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
      font-weight: 600;
    }
    .graveyard-header-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .graveyard-icon {
      color: var(--mat-sys-outline);
    }
    .graveyard-list {
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      background: var(--mat-sys-surface-container-low);
    }
    .archived-row {
      opacity: 0.8;
      border-style: dashed;
    }
    .archived-badge {
      font-size: 0.7rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .archived-date,
    .archived-price {
      font-size: 0.75rem;
      color: var(--mat-sys-outline);
    }
    .archived-note {
      font-style: italic;
      color: var(--mat-sys-on-surface-variant);
    }
    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 1.25rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-lowest);
    }
    .keyboard-tip {
      font-size: 0.78rem;
      color: var(--mat-sys-outline);
    }
    .keyboard-tip kbd {
      background: rgba(127, 127, 127, 0.15);
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.75rem;
    }
  `,
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
