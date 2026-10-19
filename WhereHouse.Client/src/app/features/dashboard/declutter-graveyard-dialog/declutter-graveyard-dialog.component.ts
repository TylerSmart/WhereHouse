import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DISPOSITION_REASON_LABELS,
  DispositionReason,
  DispositionReasons,
  ItemDto,
  ItemStatus,
  ItemStatuses,
} from '../../../core/models/item.models';
import {
  DeclutterStagingSummaryDto,
  DustCollectorInsightsDto,
  GraveyardSummaryDto,
} from '../../../core/models/lifecycle.models';
import { LifecycleService } from '../../../core/services/lifecycle/lifecycle.service';
import {
  StageArchiveDialogComponent,
  StageArchiveDialogData,
} from '../stage-archive-dialog/stage-archive-dialog.component';

export interface DeclutterGraveyardDialogData {
  initialTab?: 'staged' | 'dust' | 'graveyard';
}

@Component({
  imports: [
    FormsModule,
    DatePipe,
    CurrencyPipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatCheckboxModule,
    MatDividerModule,
    MatExpansionModule,
    MatCardModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-declutter-graveyard-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-header">
      <div class="header-content">
        <mat-icon class="header-icon">recycling</mat-icon>
        <div class="header-text">
          <span class="dialog-title-text">Declutter Staging, Dust Collectors & Graveyard</span>
          <span class="dialog-subtitle-text"
            >Manage sell/donate staging, identify idle assets, and review archived items.</span
          >
        </div>
      </div>
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- NAVIGATION TABS -->
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'staged'"
          (click)="switchTab('staged')"
        >
          <mat-icon>sell</mat-icon>
          <span>Declutter Staging ({{ stagedSummary()?.totalStagedCount ?? 0 }})</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'dust'"
          (click)="switchTab('dust')"
        >
          <mat-icon>hourglass_bottom</mat-icon>
          <span>Dust Collectors ({{ dustInsights()?.totalItemsCount ?? 0 }})</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'graveyard'"
          (click)="switchTab('graveyard')"
        >
          <mat-icon>inventory_2</mat-icon>
          <span>Graveyard Archive ({{ graveyardSummary()?.totalArchivedCount ?? 0 }})</span>
        </button>
      </div>

      <!-- ========================================== -->
      <!-- TAB 1: DECLUTTER STAGING                   -->
      <!-- ========================================== -->
      @if (activeTab() === 'staged') {
        <div class="tab-panel staged-panel">
          @if (isLoading()) {
            <div class="loading-spinner">
              <mat-progress-spinner diameter="36" mode="indeterminate" />
              <span>Loading staged items...</span>
            </div>
          } @else if (stagedSummary(); as summary) {
            <!-- Metrics Summary Cards -->
            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-label">Total Staged</span>
                <span class="metric-value">{{ summary.totalStagedCount }}</span>
                <span class="metric-hint">Items awaiting disposition</span>
              </div>
              <div class="metric-card highlight-green">
                <span class="metric-label">Target Resale Value</span>
                <span class="metric-value">{{
                  summary.totalTargetResaleValue | currency: 'USD' : 'symbol' : '1.0-2'
                }}</span>
                <span class="metric-hint"
                  >{{ summary.stagedToSellCount }} item(s) staged to sell</span
                >
              </div>
              <div class="metric-card highlight-blue">
                <span class="metric-label">Est. Donation Value</span>
                <span class="metric-value">{{
                  summary.totalEstimatedDonationValue | currency: 'USD' : 'symbol' : '1.0-2'
                }}</span>
                <span class="metric-hint"
                  >{{ summary.stagedToDonateCount }} item(s) staged to donate</span
                >
              </div>
            </div>

            <!-- Filter Chips & Selection Actions -->
            <div class="action-toolbar">
              <div class="filter-chips">
                <mat-chip-set>
                  <mat-chip-option
                    [selected]="stagedStatusFilter() === null"
                    (selectionChange)="setStagedStatusFilter(null)"
                  >
                    All Staged
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="stagedStatusFilter() === ItemStatuses.StagedToSell"
                    (selectionChange)="setStagedStatusFilter(ItemStatuses.StagedToSell)"
                  >
                    Staged to Sell
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="stagedStatusFilter() === ItemStatuses.StagedToDonate"
                    (selectionChange)="setStagedStatusFilter(ItemStatuses.StagedToDonate)"
                  >
                    Staged to Donate
                  </mat-chip-option>
                </mat-chip-set>
              </div>

              @if (summary.items.length > 0) {
                <div class="selection-actions">
                  <mat-checkbox
                    [checked]="
                      selectedStagedIds().size > 0 &&
                      selectedStagedIds().size === summary.items.length
                    "
                    [indeterminate]="
                      selectedStagedIds().size > 0 &&
                      selectedStagedIds().size < summary.items.length
                    "
                    (change)="toggleSelectAllStaged(summary.items)"
                  >
                    Select All
                  </mat-checkbox>
                </div>
              }
            </div>

            <!-- Bulk Actions Bar -->
            @if (selectedStagedIds().size > 0) {
              <div class="bulk-actions-bar">
                <span class="bulk-count"
                  >Selected <strong>{{ selectedStagedIds().size }}</strong> item(s):</span
                >
                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="compact-field"
                >
                  <mat-label>Disposition</mat-label>
                  <mat-select
                    [ngModel]="bulkDispositionReason()"
                    (ngModelChange)="bulkDispositionReason.set($event)"
                  >
                    @for (entry of dispositionReasonOptions; track entry.value) {
                      <mat-option [value]="entry.value">{{ entry.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="compact-field"
                >
                  <mat-label>Bulk Notes</mat-label>
                  <input
                    matInput
                    placeholder="e.g. Goodwill drop-off"
                    [ngModel]="bulkDispositionNote()"
                    (ngModelChange)="bulkDispositionNote.set($event)"
                  />
                </mat-form-field>

                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="isActionInProgress()"
                  (click)="executeBulkArchive()"
                >
                  <mat-icon>archive</mat-icon>
                  <span>Archive Selected</span>
                </button>

                <button
                  mat-stroked-button
                  color="warn"
                  type="button"
                  [disabled]="isActionInProgress()"
                  (click)="executeBulkUnstage()"
                >
                  <mat-icon>undo</mat-icon>
                  <span>Unstage (Keep)</span>
                </button>
              </div>
            }

            <!-- Staged Items List -->
            @if (summary.items.length === 0) {
              <div class="empty-state">
                <mat-icon class="empty-icon">sell</mat-icon>
                <p>No items currently staged to sell or donate.</p>
                <span class="empty-hint"
                  >Use "Stage to Sell / Donate" on any item card or from the Dust Collectors tab to
                  begin decluttering.</span
                >
              </div>
            } @else {
              <div class="items-list">
                @for (item of summary.items; track item.id) {
                  <div class="item-card-row" [class.selected]="selectedStagedIds().has(item.id)">
                    <mat-checkbox
                      [checked]="selectedStagedIds().has(item.id)"
                      (change)="toggleStagedSelection(item.id)"
                    />
                    <div class="item-info-col">
                      <div class="item-header-line">
                        <span class="item-code">{{ item.shortCode }}</span>
                        <span class="item-name">{{ item.name }}</span>
                        @if (item.status === ItemStatuses.StagedToSell) {
                          <span class="status-badge sell-badge">Staged to Sell</span>
                        } @else {
                          <span class="status-badge donate-badge">Staged to Donate</span>
                        }
                        @if (item.stagingTargetPrice) {
                          <span class="price-chip">{{
                            item.stagingTargetPrice | currency: 'USD' : 'symbol' : '1.0-2'
                          }}</span>
                        }
                      </div>
                      @if (item.stagingListingNotes) {
                        <div class="notes-line">
                          <mat-icon class="tiny-icon">notes</mat-icon>
                          <span>{{ item.stagingListingNotes }}</span>
                        </div>
                      }
                      <div class="sub-line">
                        @if (item.homeLocationFullPath) {
                          <span class="loc-path">
                            <mat-icon class="tiny-icon">place</mat-icon>
                            {{ item.homeLocationFullPath }}
                          </span>
                        }
                        @if (item.stagedAt) {
                          <span class="timestamp">
                            Staged {{ item.stagedAt | date: 'mediumDate' }}
                          </span>
                        }
                      </div>
                    </div>
                    <div class="item-actions-col">
                      <button
                        mat-stroked-button
                        type="button"
                        matTooltip="Archive or mark sold"
                        (click)="openStageArchiveDialog(item, 'archive')"
                      >
                        <mat-icon>archive</mat-icon>
                        <span>Archive</span>
                      </button>
                      <button
                        mat-icon-button
                        type="button"
                        matTooltip="Keep item In Place"
                        (click)="quickUnstage(item)"
                      >
                        <mat-icon>undo</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- ========================================== -->
      <!-- TAB 2: DUST COLLECTOR INSIGHTS             -->
      <!-- ========================================== -->
      @if (activeTab() === 'dust') {
        <div class="tab-panel dust-panel">
          @if (isLoading()) {
            <div class="loading-spinner">
              <mat-progress-spinner diameter="36" mode="indeterminate" />
              <span>Analyzing untouched inventory...</span>
            </div>
          } @else if (dustInsights(); as insights) {
            <!-- Threshold Filter Chips -->
            <div class="threshold-toolbar">
              <div class="threshold-chips">
                <span class="toolbar-label">Untouched for:</span>
                <mat-chip-set>
                  <mat-chip-option
                    [selected]="dustThresholdDays() === 180"
                    (selectionChange)="setDustThreshold(180)"
                  >
                    &gt; 6 Months (180d)
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="dustThresholdDays() === 365"
                    (selectionChange)="setDustThreshold(365)"
                  >
                    &gt; 1 Year (365d)
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="dustThresholdDays() === 730"
                    (selectionChange)="setDustThreshold(730)"
                  >
                    &gt; 2 Years (730d)
                  </mat-chip-option>
                </mat-chip-set>
              </div>

              <div class="dust-summary-badge">
                <span
                  >Found <strong>{{ insights.totalItemsCount }}</strong> idle items totaling
                  <strong>{{
                    insights.totalEstimatedValue | currency: 'USD' : 'symbol' : '1.0-2'
                  }}</strong></span
                >
              </div>
            </div>

            <!-- Grouped by Location / Container Accordions -->
            @if (insights.locationGroups.length === 0) {
              <div class="empty-state">
                <mat-icon class="empty-icon">check_circle</mat-icon>
                <p>No dust collectors found for this threshold!</p>
                <span class="empty-hint"
                  >All active items in your home have been touched or audited recently.</span
                >
              </div>
            } @else {
              <mat-accordion multi class="location-accordions">
                @for (group of insights.locationGroups; track group.locationFullPath) {
                  <mat-expansion-panel [expanded]="true">
                    <mat-expansion-panel-header>
                      <mat-panel-title class="group-title">
                        <mat-icon>inventory_2</mat-icon>
                        <span class="group-loc-name">{{ group.locationName }}</span>
                        @if (group.locationShortCode) {
                          <span class="group-code">({{ group.locationShortCode }})</span>
                        }
                      </mat-panel-title>
                      <mat-panel-description class="group-desc">
                        <span>{{ group.itemCount }} item(s)</span>
                        <span class="group-val">{{
                          group.groupEstimatedValue | currency: 'USD' : 'symbol' : '1.0-2'
                        }}</span>
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <div class="group-items-list">
                      @for (entry of group.items; track entry.item.id) {
                        <div class="dust-item-row">
                          <div class="dust-item-info">
                            <div class="dust-title-line">
                              <span class="item-code">{{ entry.item.shortCode }}</span>
                              <span class="item-name">{{ entry.item.name }}</span>
                              <span class="untouched-badge"
                                >{{ entry.daysUntouched }} days untouched</span
                              >
                              @if (entry.estimatedValue > 0) {
                                <span class="val-badge">{{
                                  entry.estimatedValue | currency: 'USD' : 'symbol' : '1.0-2'
                                }}</span>
                              }
                            </div>
                            @if (entry.item.brand || entry.item.modelNumber) {
                              <div class="sub-line">
                                <span>{{ entry.item.brand }} {{ entry.item.modelNumber }}</span>
                              </div>
                            }
                          </div>

                          <div class="dust-actions">
                            <button
                              mat-stroked-button
                              type="button"
                              matTooltip="Stage to Sell"
                              (click)="quickStageToSell(entry.item)"
                            >
                              <mat-icon>sell</mat-icon>
                              <span>Sell</span>
                            </button>
                            <button
                              mat-stroked-button
                              type="button"
                              matTooltip="Stage to Donate"
                              (click)="quickStageToDonate(entry.item)"
                            >
                              <mat-icon>volunteer_activism</mat-icon>
                              <span>Donate</span>
                            </button>
                            <button
                              mat-stroked-button
                              type="button"
                              matTooltip="Archive item"
                              (click)="openStageArchiveDialog(entry.item, 'archive')"
                            >
                              <mat-icon>archive</mat-icon>
                              <span>Archive</span>
                            </button>
                            <button
                              mat-icon-button
                              type="button"
                              matTooltip="Still using (reset untouched timer)"
                              (click)="quickTouch(entry.item)"
                            >
                              <mat-icon>touch_app</mat-icon>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>
                }
              </mat-accordion>
            }
          }
        </div>
      }

      <!-- ========================================== -->
      <!-- TAB 3: GRAVEYARD ARCHIVE                   -->
      <!-- ========================================== -->
      @if (activeTab() === 'graveyard') {
        <div class="tab-panel graveyard-panel">
          @if (isLoading()) {
            <div class="loading-spinner">
              <mat-progress-spinner diameter="36" mode="indeterminate" />
              <span>Loading Graveyard archive...</span>
            </div>
          } @else if (graveyardSummary(); as gy) {
            <!-- Overall Graveyard Metrics -->
            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-label">Total Archived</span>
                <span class="metric-value">{{ gy.totalArchivedCount }}</span>
                <span class="metric-hint">Historical assets recorded</span>
              </div>
              <div class="metric-card highlight-green">
                <span class="metric-label">Total Sale Proceeds</span>
                <span class="metric-value">{{
                  gy.totalSaleProceeds | currency: 'USD' : 'symbol' : '1.0-2'
                }}</span>
                <span class="metric-hint">{{ gy.soldCount }} item(s) sold</span>
              </div>
              <div class="metric-card highlight-blue">
                <span class="metric-label">Donated Est. Value</span>
                <span class="metric-value">{{
                  gy.totalDonatedEstimatedValue | currency: 'USD' : 'symbol' : '1.0-2'
                }}</span>
                <span class="metric-hint">{{ gy.donatedCount }} item(s) donated</span>
              </div>
            </div>

            <!-- Graveyard Search & Reason Filter -->
            <div class="gy-filter-bar">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
                <mat-icon matPrefix>search</mat-icon>
                <input
                  matInput
                  placeholder="Search graveyard by name, code, brand, notes..."
                  [ngModel]="gySearchQuery()"
                  (ngModelChange)="gySearchQuery.set($event)"
                  (keydown.enter)="applyGraveyardFilter()"
                />
              </mat-form-field>

              <div class="disposition-chips">
                <mat-chip-set>
                  <mat-chip-option
                    [selected]="gyReasonFilter() === null"
                    (selectionChange)="setGraveyardReasonFilter(null)"
                  >
                    All ({{ gy.totalArchivedCount }})
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="gyReasonFilter() === DispositionReasons.Sold"
                    (selectionChange)="setGraveyardReasonFilter(DispositionReasons.Sold)"
                  >
                    Sold ({{ gy.soldCount }})
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="gyReasonFilter() === DispositionReasons.Donated"
                    (selectionChange)="setGraveyardReasonFilter(DispositionReasons.Donated)"
                  >
                    Donated ({{ gy.donatedCount }})
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="gyReasonFilter() === DispositionReasons.Recycled"
                    (selectionChange)="setGraveyardReasonFilter(DispositionReasons.Recycled)"
                  >
                    Recycled ({{ gy.recycledCount }})
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="gyReasonFilter() === DispositionReasons.BrokenTrashed"
                    (selectionChange)="setGraveyardReasonFilter(DispositionReasons.BrokenTrashed)"
                  >
                    Broken/Trashed ({{ gy.brokenTrashedCount }})
                  </mat-chip-option>
                  <mat-chip-option
                    [selected]="gyReasonFilter() === DispositionReasons.Consumed"
                    (selectionChange)="setGraveyardReasonFilter(DispositionReasons.Consumed)"
                  >
                    Consumed ({{ gy.consumedCount }})
                  </mat-chip-option>
                </mat-chip-set>
              </div>
            </div>

            <!-- Graveyard Items List -->
            @if (gy.items.length === 0) {
              <div class="empty-state">
                <mat-icon class="empty-icon">inventory_2</mat-icon>
                <p>No archived items match this filter.</p>
              </div>
            } @else {
              <div class="items-list">
                @for (item of gy.items; track item.id) {
                  <div class="item-card-row archived-row">
                    <div class="item-info-col">
                      <div class="item-header-line">
                        <span class="item-code">{{ item.shortCode }}</span>
                        <span class="item-name">{{ item.name }}</span>
                        <span class="status-badge gy-badge">
                          {{ getDispositionLabel(item.dispositionReason) }}
                          @if (
                            item.dispositionReason === DispositionReasons.Sold && item.salePrice
                          ) {
                            ({{ item.salePrice | currency: 'USD' : 'symbol' : '1.0-2' }})
                          }
                        </span>
                      </div>
                      @if (item.dispositionNote) {
                        <div class="notes-line">
                          <mat-icon class="tiny-icon">notes</mat-icon>
                          <span>{{ item.dispositionNote }}</span>
                        </div>
                      }
                      <div class="sub-line">
                        <span class="loc-path">
                          <mat-icon class="tiny-icon">place</mat-icon>
                          Previously in: {{ item.homeLocationFullPath || 'Unassigned' }}
                        </span>
                        @if (item.archivedAt) {
                          <span class="timestamp">
                            Archived {{ item.archivedAt | date: 'mediumDate' }}
                            @if (item.archivedByUsername) {
                              by {{ item.archivedByUsername }}
                            }
                          </span>
                        }
                      </div>
                    </div>
                    <div class="item-actions-col">
                      <button
                        mat-stroked-button
                        color="primary"
                        type="button"
                        matTooltip="Restore back to Home Bin"
                        [disabled]="isActionInProgress()"
                        (click)="quickRestore(item)"
                      >
                        <mat-icon>restore_from_trash</mat-icon>
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button type="button" (click)="dialogRef.close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-header {
      padding: 1rem 1.5rem;
      margin: 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--mat-sys-primary);
    }
    .header-text {
      display: flex;
      flex-direction: column;
    }
    .dialog-title-text {
      font-size: 1.25rem;
      font-weight: 600;
    }
    .dialog-subtitle-text {
      font-size: 0.85rem;
      color: var(--mat-sys-outline);
    }
    .dialog-content {
      padding: 1rem 1.5rem;
      min-width: 320px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .tab-bar {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      padding-bottom: 0.5rem;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: none;
      border: none;
      padding: 0.6rem 1rem;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 8px;
      color: var(--mat-sys-on-surface-variant);
      &:hover {
        background-color: var(--mat-sys-surface-container-high);
      }
      &.active {
        background-color: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
    }
    .tab-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 0;
      color: var(--mat-sys-outline);
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .metric-card {
      background-color: var(--mat-sys-surface-container);
      border-radius: 10px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      &.highlight-green {
        border-left: 4px solid #10b981;
      }
      &.highlight-blue {
        border-left: 4px solid #3b82f6;
      }
    }
    .metric-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      color: var(--mat-sys-outline);
      font-weight: 600;
    }
    .metric-value {
      font-size: 1.5rem;
      font-weight: 700;
    }
    .metric-hint {
      font-size: 0.8rem;
      color: var(--mat-sys-outline);
    }
    .action-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .bulk-actions-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background-color: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      flex-wrap: wrap;
    }
    .compact-field {
      width: 180px;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .item-card-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background-color: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      &.selected {
        background-color: var(--mat-sys-surface-container-high);
        border-color: var(--mat-sys-primary);
      }
      &.archived-row {
        opacity: 0.85;
      }
    }
    .item-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .item-header-line {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .item-code {
      font-family: monospace;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--mat-sys-primary);
    }
    .item-name {
      font-weight: 600;
      font-size: 1rem;
    }
    .status-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      &.sell-badge {
        background-color: #d1fae5;
        color: #065f46;
      }
      &.donate-badge {
        background-color: #dbeafe;
        color: #1e40af;
      }
      &.gy-badge {
        background-color: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .price-chip {
      font-weight: 600;
      font-size: 0.85rem;
      color: #059669;
    }
    .notes-line,
    .sub-line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.85rem;
      color: var(--mat-sys-outline);
    }
    .tiny-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      vertical-align: middle;
    }
    .item-actions-col {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
      color: var(--mat-sys-outline);
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 0.5rem;
    }
    .threshold-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .threshold-chips {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .toolbar-label {
      font-size: 0.85rem;
      font-weight: 500;
    }
    .location-accordions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .group-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .group-loc-name {
      font-weight: 600;
    }
    .group-code {
      font-family: monospace;
      color: var(--mat-sys-outline);
      font-size: 0.85rem;
    }
    .group-desc {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }
    .group-val {
      font-weight: 600;
      color: #10b981;
    }
    .group-items-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.5rem;
    }
    .dust-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      &:last-child {
        border-bottom: none;
      }
    }
    .dust-item-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .dust-title-line {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .untouched-badge {
      background-color: #fef3c7;
      color: #92400e;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .val-badge {
      font-size: 0.8rem;
      font-weight: 600;
      color: #059669;
    }
    .dust-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .gy-filter-bar {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .search-field {
      width: 100%;
    }
    .dialog-actions {
      padding: 0.75rem 1.5rem;
    }
  `,
})
export class DeclutterGraveyardDialogComponent implements OnInit {
  protected readonly data = inject<DeclutterGraveyardDialogData>(MAT_DIALOG_DATA, {
    optional: true,
  });
  protected readonly dialogRef = inject(MatDialogRef<DeclutterGraveyardDialogComponent>);
  private readonly lifecycleService = inject(LifecycleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly ItemStatuses = ItemStatuses;
  readonly DispositionReasons = DispositionReasons;

  readonly activeTab = signal<'staged' | 'dust' | 'graveyard'>('staged');
  readonly isLoading = signal<boolean>(false);
  readonly isActionInProgress = signal<boolean>(false);

  // Staged Tab State
  readonly stagedSummary = signal<DeclutterStagingSummaryDto | null>(null);
  readonly stagedStatusFilter = signal<ItemStatus | null>(null);
  readonly selectedStagedIds = signal<Set<string>>(new Set());
  readonly bulkDispositionReason = signal<DispositionReason>(DispositionReasons.Sold);
  readonly bulkDispositionNote = signal<string>('');

  // Dust Tab State
  readonly dustInsights = signal<DustCollectorInsightsDto | null>(null);
  readonly dustThresholdDays = signal<number>(365);

  // Graveyard Tab State
  readonly graveyardSummary = signal<GraveyardSummaryDto | null>(null);
  readonly gyReasonFilter = signal<DispositionReason | null>(null);
  readonly gySearchQuery = signal<string>('');

  readonly dispositionReasonOptions = [
    { value: DispositionReasons.Sold, label: DISPOSITION_REASON_LABELS[DispositionReasons.Sold] },
    {
      value: DispositionReasons.Donated,
      label: DISPOSITION_REASON_LABELS[DispositionReasons.Donated],
    },
    {
      value: DispositionReasons.Recycled,
      label: DISPOSITION_REASON_LABELS[DispositionReasons.Recycled],
    },
    {
      value: DispositionReasons.BrokenTrashed,
      label: DISPOSITION_REASON_LABELS[DispositionReasons.BrokenTrashed],
    },
    {
      value: DispositionReasons.Consumed,
      label: DISPOSITION_REASON_LABELS[DispositionReasons.Consumed],
    },
  ];

  ngOnInit(): void {
    if (this.data?.initialTab) {
      this.activeTab.set(this.data.initialTab);
    }
    this.loadActiveTabData();
  }

  switchTab(tab: 'staged' | 'dust' | 'graveyard'): void {
    this.activeTab.set(tab);
    this.loadActiveTabData();
  }

  loadActiveTabData(): void {
    const tab = this.activeTab();
    if (tab === 'staged') {
      this.loadStaged();
    } else if (tab === 'dust') {
      this.loadDust();
    } else if (tab === 'graveyard') {
      this.loadGraveyard();
    }
  }

  loadStaged(): void {
    this.isLoading.set(true);
    const filter = this.stagedStatusFilter() ?? undefined;
    this.lifecycleService.getStagedItems(filter).subscribe({
      next: (res) => {
        this.stagedSummary.set(res);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  setStagedStatusFilter(filter: ItemStatus | null): void {
    this.stagedStatusFilter.set(filter);
    this.selectedStagedIds.set(new Set());
    this.loadStaged();
  }

  toggleStagedSelection(id: string): void {
    const set = new Set(this.selectedStagedIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedStagedIds.set(set);
  }

  toggleSelectAllStaged(items: ItemDto[]): void {
    if (this.selectedStagedIds().size === items.length) {
      this.selectedStagedIds.set(new Set());
    } else {
      this.selectedStagedIds.set(new Set(items.map((i) => i.id)));
    }
  }

  executeBulkArchive(): void {
    const ids = Array.from(this.selectedStagedIds());
    if (ids.length === 0) return;

    this.isActionInProgress.set(true);
    this.lifecycleService
      .bulkArchiveItems({
        itemIds: ids,
        dispositionReason: this.bulkDispositionReason(),
        dispositionNote: this.bulkDispositionNote() || null,
      })
      .subscribe({
        next: (res) => {
          this.isActionInProgress.set(false);
          this.selectedStagedIds.set(new Set());
          this.snackBar.open(`Archived ${res.processedCount} item(s) to Graveyard.`, 'Close', {
            duration: 3000,
          });
          this.loadStaged();
        },
        error: (err) => {
          this.isActionInProgress.set(false);
          this.snackBar.open(err?.error?.detail || 'Failed to archive items.', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  executeBulkUnstage(): void {
    const ids = Array.from(this.selectedStagedIds());
    if (ids.length === 0) return;

    this.isActionInProgress.set(true);
    this.lifecycleService.bulkUnstageItems({ itemIds: ids }).subscribe({
      next: (res) => {
        this.isActionInProgress.set(false);
        this.selectedStagedIds.set(new Set());
        this.snackBar.open(`Unstaged ${res.processedCount} item(s) back In Place.`, 'Close', {
          duration: 3000,
        });
        this.loadStaged();
      },
      error: (err) => {
        this.isActionInProgress.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to unstage items.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  quickUnstage(item: ItemDto): void {
    this.lifecycleService.unstageItem(item.id).subscribe({
      next: (updated) => {
        this.snackBar.open(`Unstaged ${updated.name}`, 'Close', { duration: 3000 });
        this.loadStaged();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to unstage item.', 'Close', {
          duration: 4000,
        }),
    });
  }

  loadDust(): void {
    this.isLoading.set(true);
    this.lifecycleService.getDustCollectors(this.dustThresholdDays()).subscribe({
      next: (res) => {
        this.dustInsights.set(res);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  setDustThreshold(days: number): void {
    this.dustThresholdDays.set(days);
    this.loadDust();
  }

  quickStageToSell(item: ItemDto): void {
    this.lifecycleService
      .stageItem(item.id, {
        isToSell: true,
        targetPrice: item.estimatedReplacementValue ?? item.purchasePrice ?? null,
      })
      .subscribe({
        next: (updated) => {
          this.snackBar.open(`Staged to Sell: ${updated.name}`, 'Close', { duration: 3000 });
          this.loadDust();
        },
        error: (err) =>
          this.snackBar.open(err?.error?.detail || 'Failed to stage item.', 'Close', {
            duration: 4000,
          }),
      });
  }

  quickStageToDonate(item: ItemDto): void {
    this.lifecycleService
      .stageItem(item.id, {
        isToSell: false,
        targetPrice: item.estimatedReplacementValue ?? item.purchasePrice ?? null,
      })
      .subscribe({
        next: (updated) => {
          this.snackBar.open(`Staged to Donate: ${updated.name}`, 'Close', { duration: 3000 });
          this.loadDust();
        },
        error: (err) =>
          this.snackBar.open(err?.error?.detail || 'Failed to stage item.', 'Close', {
            duration: 4000,
          }),
      });
  }

  quickTouch(item: ItemDto): void {
    this.lifecycleService.touchItem(item.id).subscribe({
      next: (updated) => {
        this.snackBar.open(`Reset untouched timer for ${updated.name}`, 'Close', {
          duration: 3000,
        });
        this.loadDust();
      },
      error: (err) =>
        this.snackBar.open(err?.error?.detail || 'Failed to touch item.', 'Close', {
          duration: 4000,
        }),
    });
  }

  loadGraveyard(): void {
    this.isLoading.set(true);
    const reason = this.gyReasonFilter() ?? undefined;
    const search = this.gySearchQuery().trim() || undefined;
    this.lifecycleService.getGraveyardItems(reason, search).subscribe({
      next: (res) => {
        this.graveyardSummary.set(res);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  setGraveyardReasonFilter(reason: DispositionReason | null): void {
    this.gyReasonFilter.set(reason);
    this.loadGraveyard();
  }

  applyGraveyardFilter(): void {
    this.loadGraveyard();
  }

  getDispositionLabel(reason?: DispositionReason | null): string {
    if (reason === undefined || reason === null) return 'Archived';
    return DISPOSITION_REASON_LABELS[reason] ?? 'Archived';
  }

  quickRestore(item: ItemDto): void {
    this.isActionInProgress.set(true);
    this.lifecycleService.restoreArchivedItem(item.id).subscribe({
      next: (updated) => {
        this.isActionInProgress.set(false);
        this.snackBar.open(`Restored ${updated.name} to Home Bin!`, 'Close', {
          duration: 3000,
        });
        this.loadGraveyard();
      },
      error: (err) => {
        this.isActionInProgress.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to restore item.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  openStageArchiveDialog(item: ItemDto, mode: 'stage' | 'archive'): void {
    const dialogRef = this.dialog.open(StageArchiveDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      data: { item, initialMode: mode } as StageArchiveDialogData,
    });

    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        this.loadActiveTabData();
      }
    });
  }
}
