import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

@Component({
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule],
  selector: 'app-confirm-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      @if (data.isDestructive) {
        <mat-icon color="warn" aria-hidden="true">warning</mat-icon>
      }
      <span>{{ data.title }}</span>
    </h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button
        mat-flat-button
        [color]="data.isDestructive ? 'warn' : 'primary'"
        (click)="dialogRef.close(true)"
      >
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
