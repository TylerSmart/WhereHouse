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
  template: `
    <h2 mat-dialog-title class="dialog-header">
      <div class="title-with-icon">
        <mat-icon class="header-icon">{{ mode() === 'stage' ? 'sell' : 'inventory_2' }}</mat-icon>
        <div class="header-text">
          <span class="action-label">{{
            mode() === 'stage' ? 'Declutter Staging' : 'Send to Graveyard (Archive)'
          }}</span>
          <span class="item-name-subtitle">{{ item.name }} ({{ item.shortCode }})</span>
        </div>
      </div>
      <div class="mode-toggle-group">
        <button
          mat-stroked-button
          type="button"
          class="mode-btn"
          [class.active]="mode() === 'stage'"
          (click)="mode.set('stage')"
        >
          <mat-icon>sell</mat-icon>
          <span>Stage</span>
        </button>
        <button
          mat-stroked-button
          type="button"
          class="mode-btn"
          [class.active]="mode() === 'archive'"
          (click)="mode.set('archive')"
        >
          <mat-icon>inventory_2</mat-icon>
          <span>Archive</span>
        </button>
      </div>
    </h2>

    <mat-dialog-content class="dialog-body">
      @if (item.homeLocationFullPath) {
        <div class="home-location-info-banner">
          <mat-icon>place</mat-icon>
          <span
            >Home Location: <strong>{{ item.homeLocationFullPath }}</strong></span
          >
        </div>
      }

      @if (mode() === 'stage') {
        <!-- STAGING FORM -->
        <div class="form-section">
          <span class="section-label">Staging Intent</span>
          <mat-radio-group
            class="radio-vertical"
            [ngModel]="isToSell()"
            (ngModelChange)="isToSell.set($event)"
          >
            <mat-radio-button [value]="true">
              <div class="radio-content">
                <strong>Stage to Sell</strong>
                <span class="radio-desc"
                  >Prepare to list on Facebook Marketplace, eBay, garage sale, etc.</span
                >
              </div>
            </mat-radio-button>
            <mat-radio-button [value]="false">
              <div class="radio-content">
                <strong>Stage to Donate</strong>
                <span class="radio-desc"
                  >Place in physical donate bin or stage for thrift store drop-off.</span
                >
              </div>
            </mat-radio-button>
          </mat-radio-group>
        </div>

        <div class="fields-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{
              isToSell() ? 'Target Asking Price ($)' : 'Estimated Donation Tax Value ($)'
            }}</mat-label>
            <input
              matInput
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              [ngModel]="targetPrice()"
              (ngModelChange)="targetPrice.set($event)"
            />
            <span matTextPrefix>$&nbsp;</span>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Listing Notes / Staging Platform</mat-label>
            <textarea
              matInput
              rows="3"
              placeholder="e.g. List on FB Marketplace for $40 OBO, clean before photographing, in Donate Box by garage door"
              [ngModel]="listingNotes()"
              (ngModelChange)="listingNotes.set($event)"
            ></textarea>
          </mat-form-field>
        </div>
      } @else {
        <!-- ARCHIVE / GRAVEYARD FORM -->
        <div class="form-section">
          <p class="archive-explainer">
            Archiving moves this item to the <strong>Graveyard</strong>. It will be hidden from
            active bins and container counts, but will appear in search results with its previous
            home location and disposition record preserved.
          </p>

          <div class="fields-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Disposition Reason</mat-label>
              <mat-select
                [ngModel]="dispositionReason()"
                (ngModelChange)="dispositionReason.set($event)"
              >
                @for (entry of dispositionReasonOptions; track entry.value) {
                  <mat-option [value]="entry.value">{{ entry.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            @if (dispositionReason() === DispositionReasons.Sold) {
              <mat-form-field appearance="outline">
                <mat-label>Actual Sale Price ($)</mat-label>
                <input
                  matInput
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  [ngModel]="salePrice()"
                  (ngModelChange)="salePrice.set($event)"
                />
                <span matTextPrefix>$&nbsp;</span>
              </mat-form-field>
            }

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Disposition Notes</mat-label>
              <textarea
                matInput
                rows="3"
                placeholder="e.g. Sold on eBay to user @buyer, Dropped off at Goodwill on Main St, Battery depleted and discarded at county depot"
                [ngModel]="dispositionNote()"
                (ngModelChange)="dispositionNote.set($event)"
              ></textarea>
            </mat-form-field>
          </div>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button type="button" [disabled]="isSubmitting()" (click)="dialogRef.close(false)">
        Cancel
      </button>

      @if (
        item.status === ItemStatuses.StagedToSell || item.status === ItemStatuses.StagedToDonate
      ) {
        <button
          mat-stroked-button
          color="warn"
          type="button"
          [disabled]="isSubmitting()"
          (click)="submitUnstage()"
        >
          <mat-icon>undo</mat-icon>
          <span>Unstage (Keep in Place)</span>
        </button>
      }

      @if (item.status === ItemStatuses.Archived) {
        <button
          mat-stroked-button
          color="primary"
          type="button"
          [disabled]="isSubmitting()"
          (click)="submitRestore()"
        >
          <mat-icon>restore_from_trash</mat-icon>
          <span>Restore to Home Bin</span>
        </button>
      }

      @if (mode() === 'stage') {
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="isSubmitting()"
          (click)="submitStage()"
        >
          <mat-icon>sell</mat-icon>
          <span>{{ isToSell() ? 'Stage to Sell' : 'Stage to Donate' }}</span>
        </button>
      } @else {
        <button
          mat-flat-button
          color="warn"
          type="button"
          [disabled]="isSubmitting()"
          (click)="submitArchive()"
        >
          <mat-icon>archive</mat-icon>
          <span>Confirm Archive</span>
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      margin: 0;
      gap: 1rem;
    }
    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--mat-sys-primary);
    }
    .header-text {
      display: flex;
      flex-direction: column;
    }
    .action-label {
      font-size: 1.25rem;
      font-weight: 600;
    }
    .item-name-subtitle {
      font-size: 0.85rem;
      color: var(--mat-sys-outline);
    }
    .mode-toggle-group {
      display: flex;
      gap: 0.5rem;
    }
    .mode-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      &.active {
        background-color: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }
    }
    .dialog-body {
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-width: 320px;
      max-width: 560px;
    }
    .home-location-info-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: var(--mat-sys-surface-container);
      padding: 0.6rem 0.9rem;
      border-radius: 8px;
      font-size: 0.9rem;
      mat-icon {
        color: var(--mat-sys-primary);
      }
    }
    .section-label {
      font-weight: 500;
      margin-bottom: 0.5rem;
      display: block;
    }
    .radio-vertical {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .radio-content {
      display: flex;
      flex-direction: column;
      margin-left: 0.25rem;
    }
    .radio-desc {
      font-size: 0.8rem;
      color: var(--mat-sys-outline);
    }
    .fields-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .full-width {
      width: 100%;
    }
    .archive-explainer {
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.4;
      margin-top: 0;
    }
    .dialog-actions {
      padding: 1rem 1.5rem;
      gap: 0.5rem;
    }
  `,
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
