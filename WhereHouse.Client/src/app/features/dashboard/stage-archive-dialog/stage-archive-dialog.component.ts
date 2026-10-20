import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  DISPOSITION_REASON_LABELS,
  DispositionReason,
  DispositionReasons,
  ItemDto,
  ItemStatuses,
} from '../../../core/models/item.models';
import { LifecycleService } from '../../../core/services/lifecycle/lifecycle.service';

export interface StageArchiveDialogData {
  item: ItemDto;
  initialMode?: 'stage' | 'archive';
}

@Component({
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  selector: 'app-stage-archive-dialog',
  templateUrl: './stage-archive-dialog.component.html',
  styleUrl: './stage-archive-dialog.component.scss',
})
export class StageArchiveDialogComponent implements OnInit {
  protected readonly data = inject<StageArchiveDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<StageArchiveDialogComponent>);
  private readonly lifecycleService = inject(LifecycleService);
  private readonly snackBar = inject(MatSnackBar);

  readonly item = this.data.item;
  readonly DispositionReasons = DispositionReasons;
  readonly ItemStatuses = ItemStatuses;

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

  readonly mode = signal<'stage' | 'archive'>('stage');
  readonly isToSell = signal<boolean>(true);
  readonly targetPrice = signal<number | null>(null);
  readonly listingNotes = signal<string>('');

  readonly dispositionReason = signal<DispositionReason>(DispositionReasons.Donated);
  readonly salePrice = signal<number | null>(null);
  readonly dispositionNote = signal<string>('');

  readonly isSubmitting = signal<boolean>(false);

  ngOnInit(): void {
    if (this.data.initialMode) {
      this.mode.set(this.data.initialMode);
    } else if (this.item.status === ItemStatuses.Archived) {
      this.mode.set('archive');
    }

    if (this.item.status === ItemStatuses.StagedToDonate) {
      this.isToSell.set(false);
    } else {
      this.isToSell.set(true);
    }

    this.targetPrice.set(
      this.item.stagingTargetPrice ??
        this.item.estimatedReplacementValue ??
        this.item.purchasePrice ??
        null,
    );
    this.listingNotes.set(this.item.stagingListingNotes ?? '');

    if (this.item.dispositionReason !== undefined && this.item.dispositionReason !== null) {
      this.dispositionReason.set(this.item.dispositionReason);
    }
    this.salePrice.set(this.item.salePrice ?? this.item.stagingTargetPrice ?? null);
    this.dispositionNote.set(this.item.dispositionNote ?? '');
  }

  submitStage(): void {
    this.isSubmitting.set(true);
    this.lifecycleService
      .stageItem(this.item.id, {
        isToSell: this.isToSell(),
        targetPrice: this.targetPrice(),
        listingNotes: this.listingNotes(),
      })
      .subscribe({
        next: (updated) => {
          this.isSubmitting.set(false);
          this.snackBar.open(
            `Item staged to ${this.isToSell() ? 'sell' : 'donate'}: ${updated.name}`,
            'Close',
            { duration: 3000 },
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.snackBar.open(err?.error?.detail || 'Failed to stage item.', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  submitUnstage(): void {
    this.isSubmitting.set(true);
    this.lifecycleService.unstageItem(this.item.id).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.snackBar.open(`Item unstaged and kept In Place: ${updated.name}`, 'Close', {
          duration: 3000,
        });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to unstage item.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  submitArchive(): void {
    this.isSubmitting.set(true);
    this.lifecycleService
      .archiveItem(this.item.id, {
        dispositionReason: this.dispositionReason(),
        dispositionNote: this.dispositionNote(),
        salePrice: this.salePrice(),
      })
      .subscribe({
        next: (updated) => {
          this.isSubmitting.set(false);
          this.snackBar.open(`Item moved to Graveyard: ${updated.name}`, 'Close', {
            duration: 3000,
          });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.snackBar.open(err?.error?.detail || 'Failed to archive item.', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  submitRestore(): void {
    this.isSubmitting.set(true);
    this.lifecycleService.restoreArchivedItem(this.item.id).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.snackBar.open(`Item restored to Home Bin: ${updated.name}`, 'Close', {
          duration: 3000,
        });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to restore item.', 'Close', {
          duration: 4000,
        });
      },
    });
  }
}
