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
  templateUrl: './item-attachments-dialog.component.html',
  styleUrl: './item-attachments-dialog.component.scss',
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
