import { CommonModule } from '@angular/common';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AttachmentType,
  AttachmentTypes,
  ItemAttachmentDto,
} from '../../../core/models/attachment.models';
import { ItemDto } from '../../../core/models/item.models';
import { AttachmentService } from '../../../core/services/attachment/attachment.service';

export interface ItemAttachmentsDialogData {
  item: ItemDto;
}

interface AttachmentTypeOption {
  value: AttachmentType;
  label: string;
  icon: string;
}

@Component({
  imports: [
    CommonModule,
    FormsModule,
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
  selector: 'app-item-attachments-dialog',
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>attach_file</mat-icon>
        <span>Attachments Vault — {{ data.item.name }}</span>
        <span class="short-code">{{ data.item.shortCode }}</span>
      </h2>
      <button mat-icon-button (click)="dialogRef.close()" aria-label="Close dialog">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <!-- Upload Panel -->
      <div class="upload-panel">
        <h3 class="panel-subtitle">Upload New Attachment</h3>
        <div class="file-picker-row">
          <input
            #fileInput
            type="file"
            class="hidden-file-input"
            (change)="onFileSelected($event)"
          />
          <button
            type="button"
            mat-stroked-button
            (click)="fileInput.click()"
            [disabled]="uploading()"
          >
            <mat-icon>upload_file</mat-icon>
            {{ selectedFile() ? 'Change File' : 'Choose File' }}
          </button>
          <span class="selected-file-label" [class.empty]="!selectedFile()">
            {{
              selectedFile()
                ? selectedFile()!.name + ' (' + formatFileSize(selectedFile()!.size) + ')'
                : 'No file chosen (up to 50 MB)'
            }}
          </span>
        </div>

        <div class="form-grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Attachment Type</mat-label>
            <mat-select [(ngModel)]="uploadType" [disabled]="uploading()">
              @for (opt of attachmentTypeOptions; track opt.value) {
                <mat-option [value]="opt.value">
                  <div class="option-row">
                    <mat-icon class="option-icon">{{ opt.icon }}</mat-icon>
                    <span>{{ opt.label }}</span>
                  </div>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Notes (optional)</mat-label>
            <input
              matInput
              [(ngModel)]="uploadNotes"
              placeholder="e.g. 2026 receipt, user manual PDF"
              maxlength="500"
              [disabled]="uploading()"
            />
          </mat-form-field>
        </div>

        <div class="upload-actions">
          <mat-checkbox [(ngModel)]="isPrimaryPhoto" [disabled]="uploading()">
            Set as Primary Photo
          </mat-checkbox>
          <button
            type="button"
            mat-flat-button
            color="primary"
            (click)="upload(fileInput)"
            [disabled]="!selectedFile() || uploading()"
          >
            @if (uploading()) {
              <mat-progress-spinner diameter="18" mode="indeterminate" />
              <span>Uploading...</span>
            } @else {
              <ng-container>
                <mat-icon>cloud_upload</mat-icon>
                <span>Upload Attachment</span>
              </ng-container>
            }
          </button>
        </div>

        @if (errorMessage()) {
          <div class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }
      </div>

      <mat-divider />

      <!-- Attachments Vault List -->
      <div class="attachments-section">
        <div class="section-header">
          <h3>Attached Files ({{ attachments().length }})</h3>
          @if (loading()) {
            <mat-progress-spinner diameter="20" mode="indeterminate" />
          }
        </div>

        @if (!loading() && attachments().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">folder_open</mat-icon>
            <p>No attachments yet for this item.</p>
            <p class="empty-hint">
              Upload photos, user manuals, warranty cards, spec sheets, or receipts above.
            </p>
          </div>
        }

        <div class="attachments-list">
          @for (att of attachments(); track att.id) {
            <div class="attachment-card" [class.primary-card]="att.isPrimaryPhoto">
              <div class="card-icon-container">
                <mat-icon class="type-icon">{{ getIcon(att.attachmentType) }}</mat-icon>
              </div>

              <div class="card-main">
                <div class="card-title-row">
                  <span class="file-name" [matTooltip]="att.fileName">{{ att.fileName }}</span>
                  @if (att.isPrimaryPhoto) {
                    <mat-chip-set class="primary-chip">
                      <mat-chip highlighted color="accent">
                        <mat-icon matChipAvatar>star</mat-icon>
                        Primary Photo
                      </mat-chip>
                    </mat-chip-set>
                  }
                </div>

                <div class="card-meta">
                  <span class="type-badge">{{ getTypeLabel(att.attachmentType) }}</span>
                  <span class="bullet">•</span>
                  <span>{{ formatFileSize(att.fileSizeBytes) }}</span>
                  <span class="bullet">•</span>
                  <span>{{ att.createdAt | date: 'mediumDate' }}</span>
                </div>

                @if (att.notes) {
                  <p class="attachment-notes">{{ att.notes }}</p>
                }
              </div>

              <div class="card-actions">
                @if (!att.isPrimaryPhoto && att.attachmentType === AttachmentTypes.Photo) {
                  <button
                    mat-icon-button
                    (click)="setPrimaryPhoto(att)"
                    matTooltip="Set as Primary Photo"
                    aria-label="Set as Primary Photo"
                  >
                    <mat-icon>star_border</mat-icon>
                  </button>
                }
                <button
                  mat-icon-button
                  color="primary"
                  (click)="download(att)"
                  matTooltip="Download / View"
                  aria-label="Download Attachment"
                >
                  <mat-icon>download</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="deleteAttachment(att)"
                  matTooltip="Delete Attachment"
                  aria-label="Delete Attachment"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem 0.5rem;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .short-code {
      font-size: 0.85rem;
      font-family: monospace;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background: rgba(127, 127, 127, 0.15);
    }
    .upload-panel {
      padding: 0.5rem 0 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .panel-subtitle {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .file-picker-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .hidden-file-input {
      display: none;
    }
    .selected-file-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .selected-file-label.empty {
      font-style: italic;
      color: var(--mat-sys-outline);
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 0.75rem;
    }
    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
    .option-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .option-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .upload-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-error);
      font-size: 0.85rem;
      background: var(--mat-sys-error-container);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
    }
    .attachments-section {
      padding-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }
    .empty-state {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.5;
      margin-bottom: 0.5rem;
    }
    .empty-hint {
      font-size: 0.85rem;
      color: var(--mat-sys-outline);
      margin: 0;
    }
    .attachments-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-height: 340px;
      overflow-y: auto;
    }
    .attachment-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }
    .attachment-card:hover {
      background: var(--mat-sys-surface-container);
    }
    .attachment-card.primary-card {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary-container);
    }
    .card-icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 6px;
      background: rgba(127, 127, 127, 0.1);
      flex-shrink: 0;
    }
    .type-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: var(--mat-sys-primary);
    }
    .card-main {
      flex: 1;
      min-width: 0;
    }
    .card-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .file-name {
      font-weight: 600;
      font-size: 0.95rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .primary-chip {
      transform: scale(0.85);
      transform-origin: left center;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 0.15rem;
    }
    .type-badge {
      font-weight: 500;
    }
    .bullet {
      opacity: 0.6;
    }
    .attachment-notes {
      margin: 0.25rem 0 0;
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface);
      font-style: italic;
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }
  `,
})
export class ItemAttachmentsDialogComponent implements OnInit {
  protected readonly data = inject<ItemAttachmentsDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<ItemAttachmentsDialogComponent>);
  private readonly attachmentService = inject(AttachmentService);

  protected readonly AttachmentTypes = AttachmentTypes;
  protected readonly attachments = signal<ItemAttachmentDto[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly uploading = signal<boolean>(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected uploadType: AttachmentType = AttachmentTypes.Photo;
  protected uploadNotes = '';
  protected isPrimaryPhoto = false;

  protected readonly attachmentTypeOptions: AttachmentTypeOption[] = [
    { value: AttachmentTypes.Photo, label: 'Photo', icon: 'photo_camera' },
    { value: AttachmentTypes.ReceiptInvoice, label: 'Receipt / Invoice', icon: 'receipt_long' },
    { value: AttachmentTypes.UserManual, label: 'User Manual', icon: 'menu_book' },
    { value: AttachmentTypes.WarrantyCard, label: 'Warranty Card', icon: 'verified_user' },
    { value: AttachmentTypes.SpecSheet, label: 'Spec Sheet', icon: 'description' },
    { value: AttachmentTypes.RepairLog, label: 'Repair Log', icon: 'build' },
    { value: AttachmentTypes.Other, label: 'Other', icon: 'attach_file' },
  ];

  ngOnInit(): void {
    this.loadAttachments();
  }

  loadAttachments(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.attachmentService.getAttachments(this.data.item.id).subscribe({
      next: (list) => {
        this.attachments.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load attachments.');
        this.loading.set(false);
      },
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;
    this.selectedFile.set(file);
    if (file) {
      // Auto-detect type if image vs pdf
      if (file.type.startsWith('image/')) {
        this.uploadType = AttachmentTypes.Photo;
      } else if (file.type === 'application/pdf') {
        this.uploadType = AttachmentTypes.UserManual;
      }
    }
  }

  upload(fileInput: HTMLInputElement): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set(null);

    this.attachmentService
      .uploadAttachment(this.data.item.id, file, {
        attachmentType: this.uploadType,
        notes: this.uploadNotes.trim() || null,
        isPrimaryPhoto: this.isPrimaryPhoto,
      })
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.selectedFile.set(null);
          this.uploadNotes = '';
          this.isPrimaryPhoto = false;
          fileInput.value = '';
          this.loadAttachments();
        },
        error: (err) => {
          this.uploading.set(false);
          this.errorMessage.set(err?.error?.detail || 'Failed to upload attachment.');
        },
      });
  }

  download(attachment: ItemAttachmentDto): void {
    this.attachmentService.downloadAttachment(this.data.item.id, attachment.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to download attachment.');
      },
    });
  }

  setPrimaryPhoto(attachment: ItemAttachmentDto): void {
    this.attachmentService
      .updateAttachment(this.data.item.id, attachment.id, {
        attachmentType: attachment.attachmentType,
        notes: attachment.notes,
        isPrimaryPhoto: true,
      })
      .subscribe({
        next: () => {
          this.loadAttachments();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.detail || 'Failed to set primary photo.');
        },
      });
  }

  deleteAttachment(attachment: ItemAttachmentDto): void {
    this.attachmentService.deleteAttachment(this.data.item.id, attachment.id).subscribe({
      next: () => {
        this.loadAttachments();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to delete attachment.');
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, idx);
    return `${size.toFixed(1)} ${units[idx]}`;
  }

  getIcon(type: AttachmentType): string {
    const opt = this.attachmentTypeOptions.find((o) => o.value === type);
    return opt?.icon ?? 'attach_file';
  }

  getTypeLabel(type: AttachmentType): string {
    const opt = this.attachmentTypeOptions.find((o) => o.value === type);
    return opt?.label ?? 'Attachment';
  }
}
