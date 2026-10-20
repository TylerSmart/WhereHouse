import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LocationNodeDto } from '../../../core/models/location.models';
import { LocationService } from '../../../core/services/location/location.service';

export interface LocationAttachmentsDialogData {
  location: LocationNodeDto;
}

@Component({
  imports: [
    CommonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-location-attachments-dialog',
  templateUrl: './location-attachments-dialog.component.html',
  styleUrl: './location-attachments-dialog.component.scss',
})
export class LocationAttachmentsDialogComponent {
  protected readonly data = inject<LocationAttachmentsDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<LocationAttachmentsDialogComponent>);
  private readonly locationService = inject(LocationService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly location = signal<LocationNodeDto>(this.data.location);
  protected readonly processing = signal(false);

  coverPhotoUrl(): string {
    return this.locationService.getCoverPhotoUrl(this.location().id);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.processing.set(true);

    this.locationService.uploadCoverPhoto(this.location().id, file).subscribe({
      next: (updated) => {
        this.location.set(updated);
        this.processing.set(false);
        this.snackBar.open('Cover photo uploaded successfully!', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.processing.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to upload photo.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  deletePhoto(): void {
    if (!confirm('Are you sure you want to delete this cover photo?')) {
      return;
    }

    this.processing.set(true);
    this.locationService.deleteCoverPhoto(this.location().id).subscribe({
      next: (updated) => {
        this.location.set(updated);
        this.processing.set(false);
        this.snackBar.open('Cover photo removed.', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.processing.set(false);
        this.snackBar.open(err?.error?.detail || 'Failed to remove cover photo.', 'Close', {
          duration: 4000,
        });
      },
    });
  }
}
