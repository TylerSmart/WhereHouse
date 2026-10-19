import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { LocationNodeDto, MoveLocationNodeRequest } from '../../../core/models/location.models';

export interface MoveLocationDialogData {
  node: LocationNodeDto;
  availableTargets: LocationNodeDto[];
}

@Component({
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  selector: 'app-move-location-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>drive_file_move</mat-icon>
      <span>Move "{{ data.node.name }}"</span>
    </h2>

    <mat-dialog-content>
      <div class="move-info">
        <p class="current-path">
          Current Location: <strong>{{ data.node.fullPath }}</strong>
        </p>
        <p class="explanation">
          Moving a movable container or location automatically updates the path for all its contents
          and nested containers.
        </p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Select Destination Location</mat-label>
          <mat-select [(value)]="selectedParentId">
            <mat-option [value]="null">
              <em>🏠 Top-Level (Root Location)</em>
            </mat-option>
            @for (target of data.availableTargets; track target.id) {
              <mat-option [value]="target.id">
                <span class="target-option-path">
                  [{{ target.shortCode }}] {{ target.fullPath }}
                </span>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="selectedParentId === data.node.parentId"
        (click)="onConfirm()"
      >
        Move Here
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .move-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-top: 0.5rem;
    }
    .current-path {
      margin: 0;
      font-size: 0.9rem;
    }
    .explanation {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.75;
    }
    .full-width {
      width: 100%;
      margin-top: 0.5rem;
    }
    .target-option-path {
      font-size: 0.85rem;
    }
  `,
})
export class MoveLocationDialogComponent {
  protected readonly data = inject<MoveLocationDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<MoveLocationDialogComponent, MoveLocationNodeRequest>>(MatDialogRef);

  protected selectedParentId: string | null = this.data.node.parentId;

  onConfirm(): void {
    this.dialogRef.close({ newParentId: this.selectedParentId });
  }
}
