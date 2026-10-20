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
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';

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
  templateUrl: './scanner-dialog.component.html',
  styleUrl: './scanner-dialog.component.scss',
})
export class ScannerDialogComponent implements OnInit, OnDestroy {
  readonly data = inject<ScannerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ScannerDialogComponent>);
  private readonly qrcodeService = inject(QrCodeService);
  private readonly checkoutLoadoutService = inject(CheckoutLoadoutService);
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

  quickGrabItem(itm: ItemDto): void {
    this.checkoutLoadoutService
      .checkoutItem(itm.id, {
        isExternalLoan: false,
        projectOrNote: 'Grabbed via QR Scanner',
      })
      .subscribe({
        next: (updated) => {
          this.snackBar.open(`Checked out "${updated.name}" (In Use)`, 'OK', { duration: 3000 });
          this.updateItemInView(updated);
        },
        error: (err) => {
          this.snackBar.open(err.error?.detail || 'Failed to grab item', 'OK', { duration: 3000 });
        },
      });
  }

  quickReturnItem(itm: ItemDto): void {
    this.checkoutLoadoutService
      .returnItem(itm.id, {
        returnNote: 'Returned via QR Scanner',
      })
      .subscribe({
        next: (updated) => {
          this.snackBar.open(`Returned "${updated.name}" to home bin`, 'OK', { duration: 3000 });
          this.updateItemInView(updated);
        },
        error: (err) => {
          this.snackBar.open(err.error?.detail || 'Failed to return item', 'OK', {
            duration: 3000,
          });
        },
      });
  }

  private updateItemInView(updated: ItemDto): void {
    const cur = this.resolution();
    if (!cur) return;
    if (cur.item?.id === updated.id) {
      this.resolution.set({ ...cur, item: updated });
    }
    if (cur.locationItems) {
      const updatedList = cur.locationItems.map((i) => (i.id === updated.id ? updated : i));
      this.resolution.set({ ...cur, locationItems: updatedList });
    }
  }
}
