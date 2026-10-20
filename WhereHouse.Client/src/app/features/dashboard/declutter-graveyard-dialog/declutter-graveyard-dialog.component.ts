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
  templateUrl: './declutter-graveyard-dialog.component.html',
  styleUrl: './declutter-graveyard-dialog.component.scss',
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
    if (this.stagedStatusFilter() === filter) return;
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
    if (this.dustThresholdDays() === days) return;
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
    if (this.gyReasonFilter() === reason) return;
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
