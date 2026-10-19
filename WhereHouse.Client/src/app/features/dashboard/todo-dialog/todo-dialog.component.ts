import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TodoItemDto } from '../../../core/models/todo.models';

export interface TodoDialogData {
  todo?: TodoItemDto;
}

export interface TodoDialogResult {
  title: string;
  description: string | null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  selector: 'app-todo-dialog',
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? 'Edit Task' : 'New Task' }}</h2>
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-dialog-content class="dialog-content">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input
            matInput
            formControlName="title"
            placeholder="e.g., Configure production deployment"
            maxlength="200"
            required
          />
          @if (form.controls.title.hasError('required') && form.controls.title.touched) {
            <mat-error>Title is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea
            matInput
            formControlName="description"
            placeholder="Add extra context or notes..."
            rows="3"
            maxlength="1000"
          ></textarea>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
          {{ isEditMode ? 'Save Changes' : 'Create Task' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    :host {
      display: block;
    }
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.5rem;
    }
    .full-width {
      width: 100%;
    }
  `,
})
export class TodoDialogComponent {
  protected readonly data = inject<TodoDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly dialogRef = inject(MatDialogRef<TodoDialogComponent, TodoDialogResult>);

  protected readonly isEditMode = Boolean(this.data?.todo);

  protected readonly form = new FormGroup({
    title: new FormControl(this.data?.todo?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl(this.data?.todo?.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.dialogRef.close({
      title: raw.title.trim(),
      description: raw.description.trim() || null,
    });
  }
}
