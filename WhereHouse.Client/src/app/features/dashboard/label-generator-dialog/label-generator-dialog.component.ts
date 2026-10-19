import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { LabelPreset, LabelPresetId, PrintableLabelItem } from '../../../core/models/qrcode.models';
import { QrCodeService } from '../../../core/services/qrcode/qrcode.service';
import { generateQrSvgDataUrl } from '../../../core/utils/qr-svg';

export interface LabelGeneratorDialogData {
  availableLocations: LocationNodeDto[];
  availableItems: ItemDto[];
  preselectedLabels?: PrintableLabelItem[];
}

export const LABEL_PRESETS: LabelPreset[] = [
  {
    id: 'avery-5160',
    name: 'Avery 5160 / 8160 (30-up Sheet)',
    category: 'sheet',
    columns: 3,
    rows: 10,
    widthInches: 2.625,
    heightInches: 1.0,
    description: '30 labels per sheet (2-5/8" x 1"). Standard bin/shelf sticker.',
  },
  {
    id: 'avery-5163',
    name: 'Avery 5163 / 8163 (10-up Sheet)',
    category: 'sheet',
    columns: 2,
    rows: 5,
    widthInches: 4.0,
    heightInches: 2.0,
    description: '10 labels per sheet (4" x 2"). Large tote and storage bin placard.',
  },
  {
    id: 'avery-22806',
    name: 'Avery 22806 (12-up Square)',
    category: 'sheet',
    columns: 3,
    rows: 4,
    widthInches: 2.0,
    heightInches: 2.0,
    description: '12 square labels per sheet (2" x 2"). Great for plastic part drawers.',
  },
  {
    id: 'thermal-2x1',
    name: 'Thermal Roll (2" x 1")',
    category: 'thermal',
    columns: 1,
    rows: 1,
    widthInches: 2.0,
    heightInches: 1.0,
    description: 'Continuous thermal label roll for Rollo, Zebra, or Munbyn printers.',
  },
  {
    id: 'thermal-225x125',
    name: 'Thermal Roll (2.25" x 1.25")',
    category: 'thermal',
    columns: 1,
    rows: 1,
    widthInches: 2.25,
    heightInches: 1.25,
    description: 'Standard desktop thermal roll (Brother / Dymo / Zebra).',
  },
  {
    id: 'thermal-4x6',
    name: 'Thermal Roll (4" x 6")',
    category: 'thermal',
    columns: 1,
    rows: 1,
    widthInches: 4.0,
    heightInches: 6.0,
    description: 'Large pallet / master tote thermal placard.',
  },
];

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
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  selector: 'app-label-generator-dialog',
  template: `
    <div class="label-generator-container no-print">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-title">
          <mat-icon class="header-icon">print</mat-icon>
          <h2>Barcode & QR Label Generator</h2>
        </div>
        <button mat-icon-button (click)="close()" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="generator-body">
        <!-- LEFT PANEL: Controls & Queue -->
        <div class="controls-panel">
          <mat-tab-group animationDuration="150ms">
            <!-- Source 1: Pick Entities -->
            <mat-tab label="Add Items & Containers">
              <div class="tab-pane">
                <mat-form-field appearance="outline">
                  <mat-label>Add Container / Location</mat-label>
                  <mat-select
                    [ngModel]="selectedLocationId()"
                    (ngModelChange)="addLocationToQueue($event)"
                  >
                    @for (loc of data.availableLocations; track loc.id) {
                      <mat-option [value]="loc.id">
                        {{ loc.shortCode }} — {{ loc.name }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Add Cataloged Item</mat-label>
                  <mat-select [ngModel]="selectedItemId()" (ngModelChange)="addItemToQueue($event)">
                    @for (itm of data.availableItems; track itm.id) {
                      <mat-option [value]="itm.id">
                        {{ itm.shortCode }} — {{ itm.name }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            </mat-tab>

            <!-- Source 2: Mint Blank QR Batch -->
            <mat-tab label="Mint Blank QR Batch">
              <div class="tab-pane">
                <p class="tab-info">
                  Pre-print numbered unassigned QR stickers (e.g. <code>QR-0001</code>) on Avery
                  sheets or thermal rolls. Stick them on bins ahead of time and scan to bind later!
                </p>

                <div class="inline-fields">
                  <mat-form-field appearance="outline">
                    <mat-label>Sticker Count</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      max="60"
                      [ngModel]="batchCount()"
                      (ngModelChange)="batchCount.set($event)"
                    />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Label Note</mat-label>
                    <input
                      matInput
                      placeholder="e.g. 2026 Tote Stickers"
                      [ngModel]="batchNote()"
                      (ngModelChange)="batchNote.set($event)"
                    />
                  </mat-form-field>
                </div>

                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="isMinting() || batchCount() < 1"
                  (click)="mintBlankBatch()"
                >
                  @if (isMinting()) {
                    <mat-spinner diameter="18"></mat-spinner>
                  } @else {
                    <mat-icon>add_circle</mat-icon>
                  }
                  Generate & Queue Stickers
                </button>
              </div>
            </mat-tab>
          </mat-tab-group>

          <mat-divider></mat-divider>

          <!-- Preset & Layout Settings -->
          <div class="settings-group">
            <h4>Format & Layout</h4>
            <mat-form-field appearance="outline">
              <mat-label>Label Format Preset</mat-label>
              <mat-select
                [ngModel]="selectedPresetId()"
                (ngModelChange)="selectedPresetId.set($event)"
              >
                @for (preset of presets; track preset.id) {
                  <mat-option [value]="preset.id">
                    {{ preset.name }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            <span class="preset-desc">{{ currentPreset().description }}</span>

            <!-- Offset Controls for Partial Sheet Reuse -->
            @if (currentPreset().category === 'sheet') {
              <div class="offset-controls">
                <span class="offset-label"> Reuse Partial Sheet (Start Offset): </span>
                <div class="inline-fields">
                  <mat-form-field appearance="outline">
                    <mat-label>Start Row</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      [max]="currentPreset().rows"
                      [ngModel]="startRow()"
                      (ngModelChange)="startRow.set($event)"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Start Column</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      [max]="currentPreset().columns"
                      [ngModel]="startColumn()"
                      (ngModelChange)="startColumn.set($event)"
                    />
                  </mat-form-field>
                </div>
              </div>
            }

            <!-- Content Toggles -->
            <div class="toggles-group">
              <mat-checkbox [ngModel]="encodeFullUrl()" (ngModelChange)="encodeFullUrl.set($event)">
                Encode Deep Link URL (<code>/scan/{{ '{' }}code{{ '}' }}</code
                >)
              </mat-checkbox>
              <mat-checkbox [ngModel]="showSubtitle()" (ngModelChange)="showSubtitle.set($event)">
                Show Subtitle / Full Path
              </mat-checkbox>
              <mat-checkbox
                [ngModel]="showColorBadge()"
                (ngModelChange)="showColorBadge.set($event)"
              >
                Show Color Indicator Dot
              </mat-checkbox>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Queue Management -->
          <div class="queue-header">
            <h4>Print Queue ({{ printQueue().length }} labels)</h4>
            @if (printQueue().length > 0) {
              <button mat-button color="warn" (click)="clearQueue()">Clear All</button>
            }
          </div>

          <div class="queue-list">
            @for (item of printQueue(); track $index) {
              <div class="queue-item-row">
                <span class="q-code">{{ item.code }}</span>
                <span class="q-title">{{ item.title }}</span>
                <button mat-icon-button (click)="removeFromQueue($index)" aria-label="Remove label">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </div>

          <!-- Print Trigger Button -->
          <div class="modal-footer">
            <button
              mat-flat-button
              color="primary"
              class="print-action-btn"
              [disabled]="printQueue().length === 0"
              (click)="triggerPrint()"
            >
              <mat-icon>print</mat-icon>
              Print {{ printQueue().length }} Label{{ printQueue().length === 1 ? '' : 's' }}
            </button>
          </div>
        </div>

        <!-- RIGHT PANEL: Live Print Preview -->
        <div class="preview-panel">
          <div class="preview-toolbar">
            <span class="preview-title"> Live Layout Preview ({{ currentPreset().name }}) </span>
          </div>

          <div class="preview-canvas-wrapper">
            <div
              class="printable-sheet-grid"
              [style.--cols]="currentPreset().columns"
              [style.--rows]="currentPreset().rows"
              [style.--label-width]="currentPreset().widthInches + 'in'"
              [style.--label-height]="currentPreset().heightInches + 'in'"
            >
              <!-- Blank Spacer Cells (Offset) -->
              @for (spacer of spacerArray(); track $index) {
                <div class="label-cell spacer-cell">
                  <span class="spacer-text">Skipped (Used)</span>
                </div>
              }

              <!-- Queued Labels -->
              @for (item of printQueue(); track $index) {
                <div class="label-cell active-label">
                  <div class="qr-col">
                    <img [src]="getQrDataUrl(item.code)" alt="QR" class="qr-img" />
                  </div>
                  <div class="info-col">
                    <div class="code-badge-row">
                      <span class="label-code">{{ item.code }}</span>
                      @if (showColorBadge() && item.primaryColor) {
                        <span class="color-dot" [style.background-color]="item.primaryColor"></span>
                      }
                      @if (item.badgeText) {
                        <span class="badge-text">{{ item.badgeText }}</span>
                      }
                    </div>
                    <div class="label-title">{{ item.title }}</div>
                    @if (showSubtitle() && item.subtitle) {
                      <div class="label-subtitle">{{ item.subtitle }}</div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .label-generator-container {
        display: flex;
        flex-direction: column;
        height: min(82vh, 720px);
        max-width: 100%;
        width: 100%;
        box-sizing: border-box;
        color: var(--mat-sys-on-surface, #1f1f1f);
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        border-bottom: 1px solid var(--mat-sys-outline-variant, #cbd5e1);

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
      }

      .generator-body {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .controls-panel {
        width: 300px;
        flex-shrink: 0;
        border-right: 1px solid var(--mat-sys-outline-variant, #cbd5e1);
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 14px;
        overflow-y: auto;
      }

      .tab-pane {
        padding: 12px 0 4px 0;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .tab-info {
          font-size: 0.85rem;
          color: var(--mat-sys-on-surface-variant, #64748b);
          margin: 0 0 4px 0;
        }
      }

      .inline-fields {
        display: flex;
        gap: 8px;

        mat-form-field {
          flex: 1;
          min-width: 0;
        }
      }

      .settings-group {
        display: flex;
        flex-direction: column;
        gap: 8px;

        h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .preset-desc {
          font-size: 0.8rem;
          color: var(--mat-sys-on-surface-variant, #64748b);
          margin-top: -4px;
        }
      }

      .offset-controls {
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: var(--mat-sys-surface-container, #f1f5f9);
        padding: 8px 12px;
        border-radius: 8px;

        .offset-label {
          font-size: 0.8rem;
          font-weight: 600;
        }
      }

      .toggles-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .queue-header {
        display: flex;
        align-items: center;
        justify-content: space-between;

        h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
        }
      }

      .queue-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 180px;
        overflow-y: auto;
        border: 1px solid var(--mat-sys-outline-variant, #e2e8f0);
        border-radius: 8px;
        padding: 4px;

        .queue-item-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          background: var(--mat-sys-surface, #ffffff);
          border-radius: 6px;
          font-size: 0.85rem;

          .q-code {
            font-family: monospace;
            font-weight: 700;
            color: var(--mat-sys-primary, #006494);
          }

          .q-title {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .modal-footer {
        margin-top: auto;
        padding-top: 8px;

        .print-action-btn {
          width: 100%;
          height: 44px;
          font-size: 1rem;
        }
      }

      .preview-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #e2e8f0;
        overflow: hidden;
      }

      .preview-toolbar {
        padding: 12px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #cbd5e1;
        font-weight: 600;
        font-size: 0.9rem;
      }

      .preview-canvas-wrapper {
        flex: 1;
        overflow: auto;
        padding: 24px;
        display: flex;
        justify-content: center;
      }

      .printable-sheet-grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 3), var(--label-width, 2.625in));
        grid-auto-rows: var(--label-height, 1in);
        gap: 0.125in 0.14in;
        background: #ffffff;
        padding: 0.5in 0.1875in;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        border-radius: 4px;
      }

      .label-cell {
        box-sizing: border-box;
        border: 1px dashed #cbd5e1;
        padding: 4px 6px;
        display: flex;
        align-items: center;
        gap: 6px;
        overflow: hidden;
        background: #ffffff;

        &.spacer-cell {
          background: #f8fafc;
          border-style: dotted;
          justify-content: center;

          .spacer-text {
            font-size: 0.75rem;
            color: #94a3b8;
            font-style: italic;
          }
        }

        &.active-label {
          border-color: #94a3b8;
        }

        .qr-col {
          flex-shrink: 0;

          .qr-img {
            width: 0.8in;
            height: 0.8in;
            display: block;
          }
        }

        .info-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          line-height: 1.15;

          .code-badge-row {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 2px;

            .label-code {
              font-family: monospace;
              font-weight: 800;
              font-size: 0.85rem;
              letter-spacing: -0.2px;
            }

            .color-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
            }

            .badge-text {
              font-size: 0.65rem;
              font-weight: 700;
              background: #e2e8f0;
              padding: 1px 4px;
              border-radius: 3px;
            }
          }

          .label-title {
            font-weight: 700;
            font-size: 0.8rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .label-subtitle {
            font-size: 0.68rem;
            color: #64748b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      @media screen {
        .preview-canvas-wrapper .printable-sheet-grid {
          zoom: 0.65;
        }
      }

      @media print {
        .no-print {
          display: none !important;
        }
        .preview-canvas-wrapper .printable-sheet-grid {
          zoom: 1;
        }
      }

      @media (max-width: 768px) {
        .generator-body {
          flex-direction: column;
          overflow-y: auto;
        }
        .controls-panel {
          width: 100%;
          border-right: none;
          border-bottom: 1px solid #cbd5e1;
        }
      }
    `,
  ],
})
export class LabelGeneratorDialogComponent {
  readonly data = inject<LabelGeneratorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LabelGeneratorDialogComponent>);
  private readonly qrcodeService = inject(QrCodeService);
  private readonly snackBar = inject(MatSnackBar);

  readonly presets = LABEL_PRESETS;

  readonly selectedPresetId = signal<LabelPresetId>('avery-5160');
  readonly startRow = signal(1);
  readonly startColumn = signal(1);
  readonly encodeFullUrl = signal(true);
  readonly showSubtitle = signal(true);
  readonly showColorBadge = signal(true);

  // Pickers & Minting
  readonly selectedLocationId = signal('');
  readonly selectedItemId = signal('');
  readonly batchCount = signal(10);
  readonly batchNote = signal('');
  readonly isMinting = signal(false);

  // Print Queue
  readonly printQueue = signal<PrintableLabelItem[]>(
    this.data.preselectedLabels ? [...this.data.preselectedLabels] : [],
  );

  readonly currentPreset = computed(
    () => this.presets.find((p) => p.id === this.selectedPresetId()) ?? this.presets[0],
  );

  readonly spacerArray = computed(() => {
    const preset = this.currentPreset();
    if (preset.category !== 'sheet') return [];
    const r = Math.max(1, Math.min(this.startRow(), preset.rows));
    const c = Math.max(1, Math.min(this.startColumn(), preset.columns));
    const count = (r - 1) * preset.columns + (c - 1);
    return Array.from({ length: count });
  });

  close(): void {
    this.dialogRef.close();
  }

  addLocationToQueue(locationId: string): void {
    if (!locationId) return;
    const loc = this.data.availableLocations.find((l) => l.id === locationId);
    if (!loc) return;

    this.printQueue.update((q) => [
      ...q,
      {
        code: loc.shortCode,
        title: loc.name,
        subtitle: loc.fullPath,
        badgeText: loc.containerStyle || (loc.nodeType === 1 ? 'BIN' : 'LOC'),
        primaryColor: loc.primaryColor || null,
        accentColor: loc.accentColor || null,
      },
    ]);
    this.selectedLocationId.set('');
  }

  addItemToQueue(itemId: string): void {
    if (!itemId) return;
    const itm = this.data.availableItems.find((i) => i.id === itemId);
    if (!itm) return;

    this.printQueue.update((q) => [
      ...q,
      {
        code: itm.shortCode,
        title: itm.name,
        subtitle: itm.homeLocationFullPath || itm.brand || null,
        badgeText: itm.unit ? `${itm.currentQuantity} ${itm.unit}` : 'ITEM',
        primaryColor: null,
        accentColor: null,
      },
    ]);
    this.selectedItemId.set('');
  }

  mintBlankBatch(): void {
    const count = this.batchCount();
    if (count < 1) return;

    this.isMinting.set(true);
    this.qrcodeService
      .generateBatch({
        count,
        prefix: 'QR',
        labelNote: this.batchNote().trim() || null,
      })
      .subscribe({
        next: (qrs) => {
          this.isMinting.set(false);
          const labels: PrintableLabelItem[] = qrs.map((qr) => ({
            code: qr.token,
            title: 'Blank QR Sticker',
            subtitle: qr.labelNote || 'Unassigned',
            badgeText: 'QR',
            primaryColor: null,
            accentColor: null,
          }));
          this.printQueue.update((q) => [...q, ...labels]);
          this.snackBar.open(`Minted ${labels.length} blank QR stickers into queue!`, 'OK', {
            duration: 3000,
          });
        },
        error: (err) => {
          this.isMinting.set(false);
          const msg = err?.error?.detail || err?.error?.title || 'Failed to mint QR batch.';
          this.snackBar.open(msg, 'Close', { duration: 4000 });
        },
      });
  }

  removeFromQueue(index: number): void {
    this.printQueue.update((q) => q.filter((_, i) => i !== index));
  }

  clearQueue(): void {
    this.printQueue.set([]);
  }

  getQrDataUrl(code: string): string {
    const payload = this.encodeFullUrl()
      ? `${window.location.origin}/scan/${encodeURIComponent(code)}`
      : code;
    return generateQrSvgDataUrl(payload, 100);
  }

  triggerPrint(): void {
    window.print();
  }
}
