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
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>{{ location().nodeType === 1 ? 'inventory_2' : 'location_on' }}</mat-icon>
        <span>Cover Photo &amp; Files — {{ location().name }}</span>
        <span class="short-code">{{ location().shortCode }}</span>
      </h2>
      <button mat-icon-button (click)="dialogRef.close(location())" aria-label="Close dialog">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-body">
      @if (location().coverAttachmentId) {
        <div class="current-photo-card">
          <div class="photo-preview-wrap">
            <img
              [src]="coverPhotoUrl()"
              alt="Cover photo for {{ location().name }}"
              class="cover-photo-img"
            />
          </div>
          <div class="photo-actions">
            <div class="photo-info">
              <span class="photo-label">Current Cover Photo</span>
              <span class="photo-hint">Displayed on location header and container cards</span>
            </div>
            <button
              mat-stroked-button
              color="warn"
              (click)="deletePhoto()"
              [disabled]="processing()"
              aria-label="Delete cover photo"
            >
              @if (processing()) {
                <mat-progress-spinner diameter="18" mode="indeterminate" />
              } @else {
                <mat-icon>delete</mat-icon>
              }
              <span>Delete Photo</span>
            </button>
          </div>
        </div>
      } @else {
        <div class="no-photo-card">
          <mat-icon class="no-photo-icon">add_a_photo</mat-icon>
          <h3>No Cover Photo Set</h3>
          <p>
            Upload a reference photo of this shelf, tote, or container to help family members
            identify it at a glance.
          </p>
        </div>
      }

      <div class="upload-section">
        <h3 class="upload-title">
          {{ location().coverAttachmentId ? 'Replace Cover Photo' : 'Upload Cover Photo' }}
        </h3>
        <div class="upload-dropzone">
          <input
            #fileInput
            type="file"
            accept="image/*"
            class="hidden-input"
            (change)="onFileSelected($event)"
          />
          <button
            type="button"
            mat-flat-button
            color="primary"
            (click)="fileInput.click()"
            [disabled]="processing()"
          >
            @if (processing()) {
              <mat-progress-spinner diameter="18" mode="indeterminate" />
            } @else {
              <mat-icon>upload</mat-icon>
            }
            <span>{{
              processing()
                ? 'Uploading...'
                : location().coverAttachmentId
                  ? 'Choose Replacement Photo'
                  : 'Choose Photo'
            }}</span>
          </button>
          <span class="upload-hint">Supports JPEG, PNG, WebP up to 15 MB</span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(location())">Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0.5rem;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .short-code {
      font-family: monospace;
      font-size: 0.8rem;
      background: var(--mat-sys-surface-container-high, #e0e0e0);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1rem 1.25rem;
      min-width: 320px;
      max-width: 580px;
    }
    .current-photo-card {
      border: 1px solid var(--mat-sys-outline-variant, #ccc);
      border-radius: 8px;
      overflow: hidden;
      background: var(--mat-sys-surface-container-low, #f9f9f9);
    }
    .photo-preview-wrap {
      width: 100%;
      height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
      overflow: hidden;
    }
    .cover-photo-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .photo-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
    }
    .photo-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .photo-label {
      font-weight: 600;
      font-size: 0.9rem;
    }
    .photo-hint {
      font-size: 0.75rem;
      color: var(--mat-sys-outline);
    }
    .no-photo-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1rem;
      text-align: center;
      background: var(--mat-sys-surface-container-low, #f9f9f9);
      border: 1px dashed var(--mat-sys-outline-variant, #ccc);
      border-radius: 8px;
    }
    .no-photo-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--mat-sys-outline);
      margin-bottom: 0.5rem;
    }
    .no-photo-card h3 {
      margin: 0 0 0.25rem;
      font-size: 1rem;
    }
    .no-photo-card p {
      margin: 0;
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface-variant);
      max-width: 360px;
    }
    .upload-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .upload-title {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .upload-dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 1.25rem;
      border: 1px dashed var(--mat-sys-primary, #1976d2);
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #f0f4f8);
    }
    .hidden-input {
      display: none;
    }
    .upload-hint {
      font-size: 0.75rem;
      color: var(--mat-sys-outline);
    }
  `,
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
