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
  templateUrl: './label-generator-dialog.component.html',
  styleUrl: './label-generator-dialog.component.scss',
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
