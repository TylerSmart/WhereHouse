import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryDto } from '../../../core/models/category.models';
import {
  InsuranceClaimFilterParams,
  InsuranceClaimPreviewDto,
} from '../../../core/models/insurance.models';
import { LocationNodeDto } from '../../../core/models/location.models';
import { InsuranceService } from '../../../core/services/insurance/insurance.service';

export interface InsuranceExportDialogData {
  availableLocations: LocationNodeDto[];
  availableCategories: CategoryDto[];
}

@Component({
  imports: [
    FormsModule,
    CurrencyPipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="insurance-dialog-container">
      <div class="dialog-header">
        <div class="title-row">
          <mat-icon class="header-icon">verified_user</mat-icon>
          <div class="header-titles">
            <h2 mat-dialog-title>Home Insurance & Loss Claim Export</h2>
            <span class="subtitle">
              Export comprehensive itemized claim schedules, replacement valuations, photos &
              proof-of-purchase receipts
            </span>
          </div>
        </div>

        <button mat-icon-button (click)="close()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Filter Controls Bar -->
      <div class="filters-bar">
        <div class="filter-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="loc-field">
            <mat-label>Location Scope</mat-label>
            <mat-select [(ngModel)]="selectedLocationId" (ngModelChange)="loadPreview()">
              <mat-option [value]="null">All Household Locations</mat-option>
              @for (loc of data.availableLocations; track loc.id) {
                <mat-option [value]="loc.id"> {{ loc.shortCode }} — {{ loc.name }} </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cat-field">
            <mat-label>Category</mat-label>
            <mat-select [(ngModel)]="selectedCategoryId" (ngModelChange)="loadPreview()">
              <mat-option [value]="null">All Categories</mat-option>
              @for (cat of data.availableCategories; track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="min-field">
            <mat-label>Min Value ($)</mat-label>
            <input
              matInput
              type="number"
              min="0"
              [(ngModel)]="minValue"
              placeholder="0.00"
              (ngModelChange)="loadPreview()"
            />
          </mat-form-field>
        </div>

        <div class="options-row">
          <mat-checkbox
            [(ngModel)]="includeSubtree"
            (ngModelChange)="loadPreview()"
            [disabled]="!selectedLocationId"
          >
            Include sub-locations & containers
          </mat-checkbox>

          <mat-checkbox [(ngModel)]="includeArchived" (ngModelChange)="loadPreview()">
            Include archived / graveyard items
          </mat-checkbox>

          <mat-checkbox [(ngModel)]="includeAttachments">
            Include photos & receipts in ZIP package
          </mat-checkbox>
        </div>
      </div>

      <!-- Valuation Summary Banner -->
      @if (preview(); as p) {
        <div class="summary-banner">
          <div class="metric-box total-val">
            <span class="metric-title">Effective Claim Valuation</span>
            <span class="metric-number highlight">{{ p.totalEffectiveClaimValue | currency }}</span>
            <span class="metric-caption"> Based on replacement cost or purchase price </span>
          </div>

          <div class="metric-box">
            <span class="metric-title">Eligible Items</span>
            <span class="metric-number">{{ p.totalItemsCount }}</span>
            <span class="metric-caption">Total Qty: {{ p.totalQuantitySum }}</span>
          </div>

          <div class="metric-box">
            <span class="metric-title">Original Purchase</span>
            <span class="metric-number">{{ p.totalPurchaseValue | currency }}</span>
            <span class="metric-caption">Historical cost</span>
          </div>

          <div class="metric-box">
            <span class="metric-title">Replacement Cost</span>
            <span class="metric-number">{{ p.totalReplacementValue | currency }}</span>
            <span class="metric-caption">Estimated new</span>
          </div>

          <div class="metric-box">
            <span class="metric-title">Documentation</span>
            <span class="metric-number">
              {{ p.totalPhotoCount + p.totalReceiptAndDocCount }}
            </span>
            <span class="metric-caption">
              {{ p.totalPhotoCount }} photos, {{ p.totalReceiptAndDocCount }} receipts/docs
            </span>
          </div>
        </div>
      }

      <mat-dialog-content class="dialog-content">
        @if (loading()) {
          <div class="loading-state">
            <mat-progress-spinner diameter="32" mode="indeterminate" />
            <span>Calculating insurance claim valuations...</span>
          </div>
        } @else if (!preview() || preview()!.items.length === 0) {
          <div class="empty-state">
            <mat-icon>inventory_2</mat-icon>
            <p>No inventory items match the selected claim export filter.</p>
            <span class="empty-sub">
              Broaden your location or category selection, or lower the minimum claim value
              threshold.
            </span>
          </div>
        } @else {
          <div class="table-container">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Name</th>
                  <th>Location</th>
                  <th>Brand / Model</th>
                  <th>Serial #</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Claim Value</th>
                  <th class="text-center">Attachments</th>
                </tr>
              </thead>
              <tbody>
                @for (item of preview()!.items; track item.id) {
                  <tr>
                    <td class="code-cell">
                      <strong>{{ item.shortCode }}</strong>
                    </td>
                    <td class="name-cell">
                      <span class="item-name">{{ item.name }}</span>
                      @if (item.categoryName) {
                        <span class="cat-pill">{{ item.categoryName }}</span>
                      }
                    </td>
                    <td class="loc-cell" [matTooltip]="item.locationFullPath">
                      {{ item.locationFullPath }}
                    </td>
                    <td class="brand-cell">
                      @if (item.brand || item.modelNumber) {
                        <span>{{ item.brand }} {{ item.modelNumber }}</span>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="serial-cell">
                      @if (item.serialNumber) {
                        <code class="serial-code">{{ item.serialNumber }}</code>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="text-right qty-cell">{{ item.quantity }} {{ item.unit ?? '' }}</td>
                    <td class="text-right val-cell">
                      <strong>{{ item.effectiveClaimValue | currency }}</strong>
                    </td>
                    <td class="text-center att-cell">
                      <div class="badges-row">
                        @if (item.photoCount > 0) {
                          <span class="att-badge photo" matTooltip="{{ item.photoCount }} photo(s)">
                            <mat-icon>photo_camera</mat-icon>
                            {{ item.photoCount }}
                          </span>
                        }
                        @if (item.receiptAndDocCount > 0) {
                          <span
                            class="att-badge doc"
                            matTooltip="{{ item.receiptAndDocCount }} receipt/manual doc(s)"
                          >
                            <mat-icon>receipt_long</mat-icon>
                            {{ item.receiptAndDocCount }}
                          </span>
                        }
                        @if (item.photoCount === 0 && item.receiptAndDocCount === 0) {
                          <span class="muted">—</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button (click)="close()">Cancel</button>
        <button
          mat-flat-button
          color="primary"
          (click)="downloadZip()"
          [disabled]="exporting() || !preview() || preview()!.items.length === 0"
        >
          @if (exporting()) {
            <mat-progress-spinner diameter="18" mode="indeterminate" />
            <span>Building Claim ZIP Package...</span>
          } @else {
            <ng-container>
              <mat-icon>folder_zip</mat-icon>
              <span>Download Claim Package (.ZIP)</span>
            </ng-container>
          }
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .insurance-dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      min-width: 340px;
      max-width: 960px;
      width: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.25rem 0.5rem;
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .header-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--mat-sys-primary);
      margin-top: 2px;
    }
    .header-titles h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .subtitle {
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .filters-bar {
      padding: 0.75rem 1.25rem;
      background: var(--mat-sys-surface-container-low);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .loc-field {
      flex: 2;
      min-width: 200px;
    }
    .cat-field {
      flex: 1.5;
      min-width: 160px;
    }
    .min-field {
      flex: 1;
      min-width: 110px;
    }
    .options-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.85rem;
    }
    .summary-banner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.6rem;
      padding: 0.75rem 1.25rem;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .metric-box {
      display: flex;
      flex-direction: column;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .metric-box.total-val {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-color: var(--mat-sys-primary);
    }
    .metric-title {
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
      opacity: 0.8;
    }
    .metric-number {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0.15rem 0;
    }
    .metric-number.highlight {
      color: var(--mat-sys-primary);
    }
    .metric-caption {
      font-size: 0.7rem;
      opacity: 0.7;
    }
    .dialog-content {
      padding: 0;
      overflow-y: auto;
      max-height: calc(90vh - 300px);
    }
    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
      text-align: center;
      gap: 0.5rem;
      color: var(--mat-sys-outline);
    }
    .empty-state mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.4;
    }
    .empty-sub {
      font-size: 0.82rem;
      max-width: 440px;
    }
    .table-container {
      overflow-x: auto;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: left;
    }
    .items-table th {
      padding: 0.6rem 0.75rem;
      font-weight: 600;
      border-bottom: 2px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-lowest);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }
    .items-table td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .items-table tr:hover {
      background: var(--mat-sys-surface-container-low);
    }
    .code-cell {
      white-space: nowrap;
      font-family: monospace;
      font-size: 0.8rem;
    }
    .name-cell {
      min-width: 160px;
    }
    .item-name {
      font-weight: 500;
    }
    .cat-pill {
      display: inline-block;
      font-size: 0.68rem;
      background: var(--mat-sys-surface-container-high);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      margin-left: 0.4rem;
      color: var(--mat-sys-outline);
    }
    .loc-cell {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.8rem;
    }
    .serial-code {
      font-family: monospace;
      font-size: 0.78rem;
      background: var(--mat-sys-surface-container-high);
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }
    .badges-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
    }
    .att-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .att-badge mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }
    .att-badge.photo {
      background: #e3f2fd;
      color: #1565c0;
    }
    .att-badge.doc {
      background: #ede7f6;
      color: #512da8;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .muted {
      color: var(--mat-sys-outline);
    }
    .dialog-actions {
      padding: 0.75rem 1.25rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
  `,
})
export class InsuranceExportDialogComponent implements OnInit {
  protected readonly data = inject<InsuranceExportDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<InsuranceExportDialogComponent>);
  private readonly insuranceService = inject(InsuranceService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal<boolean>(false);
  protected readonly exporting = signal<boolean>(false);
  protected readonly preview = signal<InsuranceClaimPreviewDto | null>(null);

  protected selectedLocationId: string | null = null;
  protected selectedCategoryId: string | null = null;
  protected minValue: number | null = null;
  protected includeSubtree = true;
  protected includeArchived = false;
  protected includeAttachments = true;

  ngOnInit(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    this.loading.set(true);

    const params: InsuranceClaimFilterParams = {
      locationId: this.selectedLocationId,
      includeSubtree: this.includeSubtree,
      categoryId: this.selectedCategoryId,
      minValue: this.minValue,
      includeArchived: this.includeArchived,
      includeAttachments: this.includeAttachments,
    };

    this.insuranceService.getPreview(params).subscribe({
      next: (res) => {
        this.preview.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to load claim preview.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  downloadZip(): void {
    this.exporting.set(true);

    const params: InsuranceClaimFilterParams = {
      locationId: this.selectedLocationId,
      includeSubtree: this.includeSubtree,
      categoryId: this.selectedCategoryId,
      minValue: this.minValue,
      includeArchived: this.includeArchived,
      includeAttachments: this.includeAttachments,
    };

    this.insuranceService.exportZip(params).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `WhereHouse_Insurance_Claim_${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        this.snackBar.open('Insurance claim ZIP downloaded successfully!', 'Close', {
          duration: 3500,
        });
      },
      error: (err) => {
        this.exporting.set(false);
        this.snackBar.open(
          err?.error?.detail || 'Failed to export insurance claim package.',
          'Close',
          {
            duration: 4000,
          },
        );
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
