import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ItemDto } from '../../../core/models/item.models';
import { LocationNodeDto } from '../../../core/models/location.models';
import {
  BulkAuditOutcomeType,
  BulkAuditOutcomeTypes,
  BulkScanAuditItemResultDto,
  PrintableLabelItem,
  QrTargetType,
  QrTargetTypes,
  ScanResolutionDto,
  ScanResolutionTypes,
} from '../../../core/models/qrcode.models';
import { QrCodeService } from '../../../core/services/qrcode/qrcode.service';

export interface ScannerDialogData {
  initialCode?: string | null;
  availableLocations: LocationNodeDto[];
  availableItems: ItemDto[];
}

export type ScannerDialogAction =
  | { action: 'selectLocation'; locationId: string }
  | { action: 'editItem'; item: ItemDto }
  | { action: 'printLabel'; label: PrintableLabelItem };

@Component({
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  selector: 'app-scanner-dialog',
  template: `
    <div class="scanner-modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title">
          <mat-icon class="header-icon">qr_code_scanner</mat-icon>
          <h2>QR & Barcode Scanner</h2>
        </div>
        <button mat-icon-button (click)="close()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-tab-group
        animationDuration="150ms"
        [selectedIndex]="selectedTabIndex()"
        (selectedIndexChange)="selectedTabIndex.set($event)"
      >
        <!-- TAB 1: Scan-to-View ("X-Ray Vision") & Blank QR Binding -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">visibility</mat-icon>
            Scan & X-Ray View
          </ng-template>

          <div class="tab-content">
            <!-- Camera / Video Feed Area (Optional toggle) -->
            @if (cameraActive()) {
              <div class="camera-viewport">
                <video #videoElement autoplay playsinline muted></video>
                <div class="scanner-laser-line"></div>
                <button
                  mat-mini-fab
                  color="warn"
                  class="camera-stop-btn"
                  (click)="stopCamera()"
                  matTooltip="Stop Camera"
                >
                  <mat-icon>videocam_off</mat-icon>
                </button>
              </div>
            }

            <!-- Scan Input Bar -->
            <div class="scan-bar">
              <mat-icon class="scan-bar-icon">barcode_scanner</mat-icon>
              <input
                #scanInput
                type="text"
                class="scan-text-input"
                placeholder="Scan QR / barcode or enter BIN-001, ITM-001, QR-0001..."
                [ngModel]="scanCodeInput()"
                (ngModelChange)="scanCodeInput.set($event)"
                (keydown.enter)="executeScan()"
              />
              @if (!cameraActive()) {
                <button
                  mat-icon-button
                  color="primary"
                  (click)="startCamera()"
                  matTooltip="Use Device Camera"
                >
                  <mat-icon>videocam</mat-icon>
                </button>
              }
              <button
                mat-flat-button
                color="primary"
                [disabled]="!scanCodeInput().trim() || isLoading()"
                (click)="executeScan()"
              >
                Scan
              </button>
            </div>

            <!-- Loading Spinner -->
            @if (isLoading()) {
              <div class="loading-state">
                <mat-spinner diameter="36"></mat-spinner>
                <span>Resolving code...</span>
              </div>
            }

            <!-- Scan Resolution View -->
            @if (!isLoading() && resolution()) {
              <div class="resolution-container">
                @switch (resolution()!.resolutionType) {
                  <!-- 1. Location / Movable Container ("X-Ray Vision") -->
                  @case (ResolutionTypes.LocationNode) {
                    @if (resolution()!.location; as loc) {
                      <div class="resolution-card location-card">
                        <div class="card-header">
                          <div class="entity-badge">
                            <mat-icon [style.color]="loc.primaryColor || 'inherit'">
                              {{ loc.icon || 'inventory_2' }}
                            </mat-icon>
                            <div class="entity-title-group">
                              <div class="entity-codes">
                                <span class="badge-code">{{ loc.shortCode }}</span>
                                @if (resolution()!.qrCode; as qr) {
                                  <span class="badge-qr">{{ qr.token }}</span>
                                }
                              </div>
                              <h3 class="entity-name">{{ loc.name }}</h3>
                              <span class="entity-path">{{ loc.fullPath }}</span>
                            </div>
                          </div>
                          <div class="card-actions">
                            <button mat-stroked-button (click)="printLocationLabel(loc)">
                              <mat-icon>print</mat-icon>
                              Print Label
                            </button>
                            <button mat-flat-button color="primary" (click)="openLocation(loc.id)">
                              <mat-icon>open_in_new</mat-icon>
                              Open in Tree
                            </button>
                          </div>
                        </div>

                        <!-- Nested Child Containers -->
                        @if (
                          resolution()!.childLocations && resolution()!.childLocations!.length > 0
                        ) {
                          <div class="sub-section">
                            <h4>
                              <mat-icon>snippet_folder</mat-icon>
                              Child Containers ({{ resolution()!.childLocations!.length }})
                            </h4>
                            <div class="child-locations-grid">
                              @for (child of resolution()!.childLocations!; track child.id) {
                                <button
                                  type="button"
                                  class="child-chip"
                                  (click)="openLocation(child.id)"
                                >
                                  <mat-icon>{{ child.icon || 'inventory_2' }}</mat-icon>
                                  <span class="child-code">{{ child.shortCode }}</span>
                                  <span class="child-name">{{ child.name }}</span>
                                </button>
                              }
                            </div>
                          </div>
                        }

                        <!-- X-Ray Items Checklist -->
                        <div class="sub-section">
                          <h4>
                            <mat-icon>format_list_bulleted</mat-icon>
                            Items Inside ({{ resolution()!.locationItems?.length || 0 }})
                          </h4>
                          @if (
                            resolution()!.locationItems && resolution()!.locationItems!.length > 0
                          ) {
                            <div class="xray-items-list">
                              @for (itm of resolution()!.locationItems!; track itm.id) {
                                <div class="xray-item-row">
                                  <div class="item-info">
                                    <span class="item-code">{{ itm.shortCode }}</span>
                                    <span class="item-name">{{ itm.name }}</span>
                                    @if (itm.brand) {
                                      <span class="item-brand">{{ itm.brand }}</span>
                                    }
                                  </div>
                                  <div class="item-meta">
                                    <span class="item-qty">
                                      Qty: {{ itm.currentQuantity }}
                                      @if (itm.unit) {
                                        {{ itm.unit }}
                                      }
                                    </span>
                                    <button
                                      mat-icon-button
                                      matTooltip="Edit Item"
                                      (click)="openItem(itm)"
                                    >
                                      <mat-icon>edit</mat-icon>
                                    </button>
                                  </div>
                                </div>
                              }
                            </div>
                          } @else {
                            <p class="empty-state-text">
                              This container currently has no cataloged items.
                            </p>
                          }
                        </div>
                      </div>
                    }
                  }

                  <!-- 2. Cataloged Item View -->
                  @case (ResolutionTypes.Item) {
                    @if (resolution()!.item; as itm) {
                      <div class="resolution-card item-card">
                        <div class="card-header">
                          <div class="entity-badge">
                            <mat-icon class="item-icon">category</mat-icon>
                            <div class="entity-title-group">
                              <div class="entity-codes">
                                <span class="badge-code">{{ itm.shortCode }}</span>
                                @if (resolution()!.qrCode; as qr) {
                                  <span class="badge-qr">{{ qr.token }}</span>
                                }
                              </div>
                              <h3 class="entity-name">{{ itm.name }}</h3>
                              @if (itm.brand) {
                                <span class="entity-brand"
                                  >{{ itm.brand }} {{ itm.modelNumber || '' }}</span
                                >
                              }
                            </div>
                          </div>
                          <div class="card-actions">
                            <button mat-stroked-button (click)="printItemLabel(itm)">
                              <mat-icon>print</mat-icon>
                              Print Label
                            </button>
                            <button mat-flat-button color="primary" (click)="openItem(itm)">
                              <mat-icon>edit</mat-icon>
                              Edit Item
                            </button>
                          </div>
                        </div>

                        <div class="item-details-grid">
                          <div class="detail-cell">
                            <span class="label">Home Container</span>
                            <span class="value">
                              {{ itm.homeLocationFullPath || 'Unassigned' }}
                            </span>
                          </div>
                          <div class="detail-cell">
                            <span class="label">Current Quantity</span>
                            <span class="value">
                              {{ itm.currentQuantity }} {{ itm.unit || '' }}
                            </span>
                          </div>
                          <div class="detail-cell">
                            <span class="label">Status</span>
                            <span class="value">{{ getStatusText(itm.status) }}</span>
                          </div>
                          <div class="detail-cell">
                            <span class="label">Condition</span>
                            <span class="value">{{ getConditionText(itm.condition) }}</span>
                          </div>
                        </div>
                      </div>
                    }
                  }

                  <!-- 3. Unassigned QR Code ("Blank QR Sticker Scanned!") -->
                  @case (ResolutionTypes.UnassignedQr) {
                    <div class="resolution-card unassigned-card">
                      <div class="unassigned-header">
                        <mat-icon class="unassigned-icon">qr_code_2</mat-icon>
                        <div class="unassigned-text">
                          <h3>Blank QR Sticker Scanned!</h3>
                          <p>
                            Token <strong>{{ resolution()!.scannedCode }}</strong> is unassigned.
                            Bind this physical sticker to an existing container or item below.
                          </p>
                        </div>
                      </div>

                      <div class="binding-form">
                        <mat-form-field appearance="outline">
                          <mat-label>Bind Target Type</mat-label>
                          <mat-select
                            [ngModel]="bindTargetType()"
                            (ngModelChange)="bindTargetType.set($event); bindTargetId.set('')"
                          >
                            <mat-option [value]="TargetTypes.LocationNode">
                              Movable Container or Location
                            </mat-option>
                            <mat-option [value]="TargetTypes.Item"> Inventory Item </mat-option>
                          </mat-select>
                        </mat-form-field>

                        @if (bindTargetType() === TargetTypes.LocationNode) {
                          <mat-form-field appearance="outline">
                            <mat-label>Select Container / Location</mat-label>
                            <mat-select
                              [ngModel]="bindTargetId()"
                              (ngModelChange)="bindTargetId.set($event)"
                            >
                              @for (loc of data.availableLocations; track loc.id) {
                                <mat-option [value]="loc.id">
                                  {{ loc.shortCode }} — {{ loc.name }} ({{ loc.fullPath }})
                                </mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        } @else {
                          <mat-form-field appearance="outline">
                            <mat-label>Select Item</mat-label>
                            <mat-select
                              [ngModel]="bindTargetId()"
                              (ngModelChange)="bindTargetId.set($event)"
                            >
                              @for (itm of data.availableItems; track itm.id) {
                                <mat-option [value]="itm.id">
                                  {{ itm.shortCode }} — {{ itm.name }} ({{
                                    itm.brand || 'No Brand'
                                  }})
                                </mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        }

                        <mat-form-field appearance="outline">
                          <mat-label>Label Note (Optional)</mat-label>
                          <input
                            matInput
                            placeholder="e.g. Blue Bin Lid sticker"
                            [ngModel]="bindLabelNote()"
                            (ngModelChange)="bindLabelNote.set($event)"
                          />
                        </mat-form-field>

                        <button
                          mat-flat-button
                          color="primary"
                          [disabled]="!bindTargetId() || isBinding()"
                          (click)="executeBind()"
                        >
                          <mat-icon>link</mat-icon>
                          Bind Sticker to Selected Entity
                        </button>
                      </div>
                    </div>
                  }

                  <!-- 4. Secret / Gift Mode (Private Restricted) -->
                  @case (ResolutionTypes.PrivateRestricted) {
                    <div class="resolution-card restricted-card">
                      <mat-icon class="lock-icon">lock</mat-icon>
                      <div class="restricted-text">
                        <h3>Private Restricted Container</h3>
                        <p>{{ resolution()!.message }}</p>
                      </div>
                    </div>
                  }

                  <!-- 5. Not Found -->
                  @case (ResolutionTypes.NotFound) {
                    <div class="resolution-card notfound-card">
                      <mat-icon class="help-icon">help_outline</mat-icon>
                      <div class="notfound-text">
                        <h3>No Match Found</h3>
                        <p>{{ resolution()!.message }}</p>
                      </div>
                    </div>
                  }
                }
              </div>
            }
          </div>
        </mat-tab>

        <!-- TAB 2: Scan-to-Audit / Bulk Move Mode -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">move_down</mat-icon>
            Scan-to-Audit / Move
          </ng-template>

          <div class="tab-content audit-tab">
            <!-- Step 1: Destination Selector -->
            <div class="audit-destination-panel">
              <mat-form-field appearance="outline" class="dest-selector">
                <mat-label>Destination Location / Shelf</mat-label>
                <mat-select
                  [ngModel]="auditDestinationId()"
                  (ngModelChange)="auditDestinationId.set($event)"
                >
                  @for (loc of data.availableLocations; track loc.id) {
                    <mat-option [value]="loc.id">
                      {{ loc.shortCode }} — {{ loc.name }} ({{ loc.fullPath }})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              @if (auditDestination(); as dest) {
                <div class="destination-badge">
                  <mat-icon>storefront</mat-icon>
                  <div>
                    <span class="dest-name">{{ dest.name }} ({{ dest.shortCode }})</span>
                    <span class="dest-path">{{ dest.fullPath }}</span>
                  </div>
                </div>
              }
            </div>

            <!-- Step 2: Rapid Scan Input Bar -->
            <div class="scan-bar">
              <mat-icon class="scan-bar-icon">flash_on</mat-icon>
              <input
                #auditInput
                type="text"
                class="scan-text-input"
                placeholder="Continuously scan container or item codes (BIN-001, ITM-002)..."
                [ngModel]="auditCodeInput()"
                (ngModelChange)="auditCodeInput.set($event)"
                (keydown.enter)="executeAuditScan()"
                [disabled]="!auditDestinationId()"
              />
              <button
                mat-flat-button
                color="primary"
                [disabled]="!auditDestinationId() || !auditCodeInput().trim() || isAuditing()"
                (click)="executeAuditScan()"
              >
                Audit Move
              </button>
            </div>

            <!-- Live Audit Counters -->
            <div class="audit-stats-bar">
              <div class="stat-item moved">
                <span class="stat-count">{{ totalMovedCount() }}</span>
                <span class="stat-label">Moved</span>
              </div>
              <div class="stat-item verified">
                <span class="stat-count">{{ totalVerifiedCount() }}</span>
                <span class="stat-label">Confirmed In-Place</span>
              </div>
              <div class="stat-item skipped">
                <span class="stat-count">{{ totalSkippedCount() }}</span>
                <span class="stat-label">Errors / Skipped</span>
              </div>
              @if (auditLog().length > 0) {
                <button mat-button color="warn" (click)="clearAuditLog()">Clear Log</button>
              }
            </div>

            <!-- Live Audit Log Feed -->
            <div class="audit-log-feed">
              @if (auditLog().length === 0) {
                <div class="empty-audit-hint">
                  <mat-icon>inventory</mat-icon>
                  <p>
                    Select a destination shelf above, then scan items or containers to move them
                    here!
                  </p>
                </div>
              } @else {
                <div class="audit-log-table">
                  @for (entry of auditLog(); track $index) {
                    <div class="log-entry-row" [class]="getOutcomeClass(entry.outcome)">
                      <mat-icon class="outcome-icon">
                        {{ getOutcomeIcon(entry.outcome) }}
                      </mat-icon>
                      <div class="outcome-details">
                        <span class="outcome-code">{{ entry.scannedCode }}</span>
                        <span class="outcome-msg">{{ entry.message }}</span>
                      </div>
                      <span class="outcome-badge">{{ getOutcomeLabel(entry.outcome) }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .scanner-modal-container {
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        min-width: 320px;
        max-width: 720px;
        width: 100%;
        color: var(--mat-sys-on-surface, #1f1f1f);
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 8px 20px;
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 12px;

        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .header-icon {
          color: var(--mat-sys-primary, #006494);
        }
      }

      .tab-icon {
        margin-right: 8px;
      }

      .tab-content {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
      }

      .camera-viewport {
        position: relative;
        width: 100%;
        height: 220px;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;

        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scanner-laser-line {
          position: absolute;
          width: 80%;
          height: 2px;
          background: #ff3b30;
          box-shadow: 0 0 8px #ff3b30;
          animation: scanLaser 2s infinite ease-in-out;
        }

        .camera-stop-btn {
          position: absolute;
          top: 12px;
          right: 12px;
        }
      }

      @keyframes scanLaser {
        0%,
        100% {
          top: 15%;
        }
        50% {
          top: 85%;
        }
      }

      .scan-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--mat-sys-surface-container, #f0f4f8);
        border: 1px solid var(--mat-sys-outline-variant, #cbd5e1);
        border-radius: 28px;
        padding: 4px 6px 4px 16px;

        .scan-bar-icon {
          color: var(--mat-sys-on-surface-variant, #64748b);
        }

        .scan-text-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.95rem;
          outline: none;
          color: inherit;
        }
      }

      .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 24px;
        color: var(--mat-sys-on-surface-variant, #64748b);
      }

      .resolution-card {
        border-radius: 12px;
        padding: 16px;
        border: 1px solid var(--mat-sys-outline-variant, #cbd5e1);
        background: var(--mat-sys-surface-container-low, #f8fafc);
        display: flex;
        flex-direction: column;
        gap: 16px;

        &.unassigned-card {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.05);
        }

        &.restricted-card {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 16px;

          .lock-icon {
            font-size: 36px;
            width: 36px;
            height: 36px;
            color: #ef4444;
          }

          h3 {
            margin: 0 0 4px 0;
            color: #ef4444;
          }

          p {
            margin: 0;
          }
        }

        &.notfound-card {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 16px;

          .help-icon {
            font-size: 36px;
            width: 36px;
            height: 36px;
            color: var(--mat-sys-on-surface-variant, #64748b);
          }

          h3 {
            margin: 0 0 4px 0;
          }

          p {
            margin: 0;
          }
        }
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 12px;
      }

      .entity-badge {
        display: flex;
        align-items: flex-start;
        gap: 12px;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          margin-top: 2px;
        }
      }

      .entity-title-group {
        display: flex;
        flex-direction: column;

        .entity-codes {
          display: flex;
          gap: 6px;
          margin-bottom: 2px;

          .badge-code {
            font-family: monospace;
            font-weight: 700;
            font-size: 0.8rem;
            background: var(--mat-sys-primary-container, #dbeafe);
            color: var(--mat-sys-on-primary-container, #1e40af);
            padding: 1px 6px;
            border-radius: 4px;
          }

          .badge-qr {
            font-family: monospace;
            font-weight: 700;
            font-size: 0.8rem;
            background: #fef3c7;
            color: #92400e;
            padding: 1px 6px;
            border-radius: 4px;
          }
        }

        .entity-name {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 600;
        }

        .entity-path,
        .entity-brand {
          font-size: 0.85rem;
          color: var(--mat-sys-on-surface-variant, #64748b);
        }
      }

      .card-actions {
        display: flex;
        gap: 8px;
      }

      .sub-section {
        display: flex;
        flex-direction: column;
        gap: 8px;

        h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }

      .child-locations-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .child-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--mat-sys-surface, #ffffff);
          border: 1px solid var(--mat-sys-outline-variant, #cbd5e1);
          border-radius: 16px;
          cursor: pointer;
          font-size: 0.85rem;

          &:hover {
            background: var(--mat-sys-primary-container, #dbeafe);
          }

          .child-code {
            font-weight: 700;
            font-family: monospace;
          }
        }
      }

      .xray-items-list {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .xray-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
          background: var(--mat-sys-surface, #ffffff);
          border: 1px solid var(--mat-sys-outline-variant, #e2e8f0);
          border-radius: 8px;

          .item-info {
            display: flex;
            align-items: center;
            gap: 8px;

            .item-code {
              font-family: monospace;
              font-weight: 700;
              font-size: 0.8rem;
              color: var(--mat-sys-primary, #006494);
            }

            .item-name {
              font-weight: 500;
              font-size: 0.9rem;
            }

            .item-brand {
              font-size: 0.8rem;
              color: var(--mat-sys-on-surface-variant, #64748b);
            }
          }

          .item-meta {
            display: flex;
            align-items: center;
            gap: 8px;

            .item-qty {
              font-size: 0.85rem;
              font-weight: 600;
            }
          }
        }
      }

      .unassigned-header {
        display: flex;
        gap: 12px;
        align-items: flex-start;

        .unassigned-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #f59e0b;
        }

        h3 {
          margin: 0 0 4px 0;
          color: #b45309;
        }

        p {
          margin: 0;
          font-size: 0.9rem;
        }
      }

      .binding-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .audit-tab {
        gap: 14px;
      }

      .audit-destination-panel {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .dest-selector {
          width: 100%;
        }

        .destination-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--mat-sys-primary-container, #dbeafe);
          color: var(--mat-sys-on-primary-container, #1e40af);
          border-radius: 8px;

          .dest-name {
            font-weight: 600;
            display: block;
          }

          .dest-path {
            font-size: 0.8rem;
            opacity: 0.85;
          }
        }
      }

      .audit-stats-bar {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;

        .stat-item {
          display: flex;
          align-items: baseline;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.85rem;

          .stat-count {
            font-weight: 700;
            font-size: 1.1rem;
          }

          &.moved {
            background: #ecfdf5;
            color: #065f46;
          }

          &.verified {
            background: #eff6ff;
            color: #1e40af;
          }

          &.skipped {
            background: #fef2f2;
            color: #991b1b;
          }
        }
      }

      .audit-log-feed {
        max-height: 240px;
        overflow-y: auto;
        border: 1px solid var(--mat-sys-outline-variant, #e2e8f0);
        border-radius: 8px;
        background: var(--mat-sys-surface, #ffffff);

        .empty-audit-hint {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          color: var(--mat-sys-on-surface-variant, #64748b);
          text-align: center;

          mat-icon {
            font-size: 32px;
            width: 32px;
            height: 32px;
            margin-bottom: 8px;
          }

          p {
            margin: 0;
            font-size: 0.9rem;
          }
        }

        .audit-log-table {
          display: flex;
          flex-direction: column;

          .log-entry-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            border-bottom: 1px solid var(--mat-sys-outline-variant, #f1f5f9);
            font-size: 0.85rem;

            .outcome-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
            }

            .outcome-details {
              flex: 1;
              display: flex;
              flex-direction: column;

              .outcome-code {
                font-family: monospace;
                font-weight: 700;
              }

              .outcome-msg {
                font-size: 0.8rem;
                color: var(--mat-sys-on-surface-variant, #64748b);
              }
            }

            .outcome-badge {
              font-size: 0.75rem;
              font-weight: 600;
              padding: 2px 6px;
              border-radius: 4px;
            }

            &.row-moved {
              .outcome-icon {
                color: #10b981;
              }
              .outcome-badge {
                background: #d1fae5;
                color: #065f46;
              }
            }

            &.row-present {
              .outcome-icon {
                color: #3b82f6;
              }
              .outcome-badge {
                background: #dbeafe;
                color: #1e40af;
              }
            }

            &.row-skipped {
              .outcome-icon {
                color: #ef4444;
              }
              .outcome-badge {
                background: #fee2e2;
                color: #991b1b;
              }
            }
          }
        }
      }

      .empty-state-text {
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant, #64748b);
        margin: 4px 0;
      }
    `,
  ],
})
export class ScannerDialogComponent implements OnInit, OnDestroy {
  readonly data = inject<ScannerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ScannerDialogComponent>);
  private readonly qrcodeService = inject(QrCodeService);
  private readonly snackBar = inject(MatSnackBar);

  readonly ResolutionTypes = ScanResolutionTypes;
  readonly TargetTypes = QrTargetTypes;
  readonly OutcomeTypes = BulkAuditOutcomeTypes;

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('scanInput') scanInput?: ElementRef<HTMLInputElement>;
  @ViewChild('auditInput') auditInput?: ElementRef<HTMLInputElement>;

  // Tab state (0: View/X-Ray, 1: Audit Move)
  readonly selectedTabIndex = signal(0);

  // Tab 1 state
  readonly scanCodeInput = signal('');
  readonly isLoading = signal(false);
  readonly resolution = signal<ScanResolutionDto | null>(null);
  readonly cameraActive = signal(false);

  // Binding sub-form state
  readonly bindTargetType = signal<QrTargetType>(QrTargetTypes.LocationNode);
  readonly bindTargetId = signal('');
  readonly bindLabelNote = signal('');
  readonly isBinding = signal(false);

  // Tab 2 Audit Move state
  readonly auditDestinationId = signal('');
  readonly auditCodeInput = signal('');
  readonly isAuditing = signal(false);
  readonly auditLog = signal<BulkScanAuditItemResultDto[]>([]);

  readonly auditDestination = computed(() => {
    const id = this.auditDestinationId();
    return this.data.availableLocations.find((l) => l.id === id) ?? null;
  });

  readonly totalMovedCount = computed(
    () =>
      this.auditLog().filter(
        (e) =>
          e.outcome === BulkAuditOutcomeTypes.MovedContainer ||
          e.outcome === BulkAuditOutcomeTypes.MovedItem,
      ).length,
  );

  readonly totalVerifiedCount = computed(
    () => this.auditLog().filter((e) => e.outcome === BulkAuditOutcomeTypes.AuditedPresent).length,
  );

  readonly totalSkippedCount = computed(
    () =>
      this.auditLog().filter(
        (e) =>
          e.outcome !== BulkAuditOutcomeTypes.MovedContainer &&
          e.outcome !== BulkAuditOutcomeTypes.MovedItem &&
          e.outcome !== BulkAuditOutcomeTypes.AuditedPresent,
      ).length,
  );

  private mediaStream: MediaStream | null = null;
  private cameraScanTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (this.data.initialCode && this.data.initialCode.trim()) {
      this.scanCodeInput.set(this.data.initialCode.trim());
      this.executeScan();
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  close(): void {
    this.stopCamera();
    this.dialogRef.close();
  }

  // --- Scan-to-View ---
  executeScan(): void {
    const raw = this.scanCodeInput().trim();
    if (!raw) return;

    this.isLoading.set(true);
    this.qrcodeService.resolveScan(raw).subscribe({
      next: (res) => {
        this.resolution.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.detail || err?.error?.title || 'Failed to resolve scan.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  executeBind(): void {
    const res = this.resolution();
    if (!res || !this.bindTargetId()) return;

    this.isBinding.set(true);
    this.qrcodeService
      .bindQrCode(res.scannedCode, {
        targetType: this.bindTargetType(),
        targetId: this.bindTargetId(),
        labelNote: this.bindLabelNote() || null,
      })
      .subscribe({
        next: () => {
          this.isBinding.set(false);
          this.snackBar.open('QR code bound successfully!', 'OK', {
            duration: 3000,
          });
          // Re-scan to show the live X-Ray view
          this.executeScan();
        },
        error: (err) => {
          this.isBinding.set(false);
          const msg = err?.error?.detail || err?.error?.title || 'Failed to bind QR code.';
          this.snackBar.open(msg, 'Close', { duration: 4000 });
        },
      });
  }

  // --- Camera controls ---
  async startCamera(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.snackBar.open('Camera access not supported on this device/browser.', 'Close', {
          duration: 4000,
        });
        return;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.cameraActive.set(true);

      setTimeout(() => {
        if (this.videoElement?.nativeElement && this.mediaStream) {
          this.videoElement.nativeElement.srcObject = this.mediaStream;
        }
      }, 50);

      // Check for BarcodeDetector API
      const BarcodeDetectorGlobal = (
        window as unknown as {
          BarcodeDetector?: new (opts?: { formats: string[] }) => {
            detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;
      if (BarcodeDetectorGlobal) {
        const detector = new BarcodeDetectorGlobal({
          formats: ['qr_code', 'code_128', 'ean_13', 'upc_a'],
        });
        this.cameraScanTimer = setInterval(async () => {
          if (this.videoElement?.nativeElement && this.cameraActive()) {
            try {
              const barcodes = await detector.detect(this.videoElement.nativeElement);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                this.scanCodeInput.set(barcodes[0].rawValue);
                this.stopCamera();
                this.executeScan();
              }
            } catch {
              // Frame scan error, ignore
            }
          }
        }, 500);
      }
    } catch {
      this.cameraActive.set(false);
      this.snackBar.open('Unable to access camera. Check permissions.', 'Close', {
        duration: 4000,
      });
    }
  }

  stopCamera(): void {
    if (this.cameraScanTimer) {
      clearInterval(this.cameraScanTimer);
      this.cameraScanTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  // --- Actions ---
  openLocation(locationId: string): void {
    this.close();
    this.dialogRef.close({ action: 'selectLocation', locationId } as ScannerDialogAction);
  }

  openItem(item: ItemDto): void {
    this.close();
    this.dialogRef.close({ action: 'editItem', item } as ScannerDialogAction);
  }

  printLocationLabel(loc: LocationNodeDto): void {
    const label: PrintableLabelItem = {
      code: loc.shortCode,
      title: loc.name,
      subtitle: loc.fullPath,
      badgeText: loc.containerStyle || (loc.nodeType === 1 ? 'BIN' : 'LOC'),
      primaryColor: loc.primaryColor || null,
      accentColor: loc.accentColor || null,
    };
    this.close();
    this.dialogRef.close({ action: 'printLabel', label } as ScannerDialogAction);
  }

  printItemLabel(item: ItemDto): void {
    const label: PrintableLabelItem = {
      code: item.shortCode,
      title: item.name,
      subtitle: item.homeLocationFullPath || item.brand || null,
      badgeText: item.unit ? `${item.currentQuantity} ${item.unit}` : 'ITEM',
      primaryColor: null,
      accentColor: null,
    };
    this.close();
    this.dialogRef.close({ action: 'printLabel', label } as ScannerDialogAction);
  }

  // --- Tab 2: Audit Move ---
  executeAuditScan(): void {
    const destId = this.auditDestinationId();
    const rawCode = this.auditCodeInput().trim();
    if (!destId || !rawCode) return;

    this.isAuditing.set(true);
    this.qrcodeService
      .bulkMoveAudit({
        destinationLocationId: destId,
        scannedCodes: [rawCode],
      })
      .subscribe({
        next: (res) => {
          this.isAuditing.set(false);
          this.auditCodeInput.set('');
          if (res.results.length > 0) {
            this.auditLog.update((log) => [...res.results, ...log]);
          }
        },
        error: (err) => {
          this.isAuditing.set(false);
          const msg = err?.error?.detail || err?.error?.title || 'Failed to execute audit move.';
          this.snackBar.open(msg, 'Close', { duration: 4000 });
        },
      });
  }

  clearAuditLog(): void {
    this.auditLog.set([]);
  }

  getOutcomeClass(outcome: BulkAuditOutcomeType): string {
    if (
      outcome === BulkAuditOutcomeTypes.MovedContainer ||
      outcome === BulkAuditOutcomeTypes.MovedItem
    ) {
      return 'row-moved';
    }
    if (outcome === BulkAuditOutcomeTypes.AuditedPresent) {
      return 'row-present';
    }
    return 'row-skipped';
  }

  getOutcomeIcon(outcome: BulkAuditOutcomeType): string {
    switch (outcome) {
      case BulkAuditOutcomeTypes.MovedContainer:
        return 'inventory_2';
      case BulkAuditOutcomeTypes.MovedItem:
        return 'category';
      case BulkAuditOutcomeTypes.AuditedPresent:
        return 'check_circle';
      case BulkAuditOutcomeTypes.SkippedPrivate:
        return 'lock';
      case BulkAuditOutcomeTypes.SkippedInvalidCycle:
        return 'change_circle';
      case BulkAuditOutcomeTypes.UnassignedQr:
        return 'qr_code_2';
      default:
        return 'help_outline';
    }
  }

  getOutcomeLabel(outcome: BulkAuditOutcomeType): string {
    switch (outcome) {
      case BulkAuditOutcomeTypes.MovedContainer:
        return 'Moved Container';
      case BulkAuditOutcomeTypes.MovedItem:
        return 'Moved Item';
      case BulkAuditOutcomeTypes.AuditedPresent:
        return 'Confirmed';
      case BulkAuditOutcomeTypes.SkippedPrivate:
        return 'Private';
      case BulkAuditOutcomeTypes.SkippedInvalidCycle:
        return 'Invalid Loop';
      case BulkAuditOutcomeTypes.UnassignedQr:
        return 'Unassigned';
      default:
        return 'Not Found';
    }
  }

  getStatusText(status: number): string {
    switch (status) {
      case 0:
        return 'In Place';
      case 1:
        return 'In Use';
      case 2:
        return 'Loaned Out';
      case 3:
        return 'Staged to Sell';
      case 4:
        return 'Staged to Donate';
      case 5:
        return 'Archived';
      default:
        return 'Unknown';
    }
  }

  getConditionText(cond: number): string {
    switch (cond) {
      case 0:
        return 'New';
      case 1:
        return 'Excellent';
      case 2:
        return 'Good';
      case 3:
        return 'Fair';
      case 4:
        return 'Broken';
      default:
        return 'Unknown';
    }
  }
}
