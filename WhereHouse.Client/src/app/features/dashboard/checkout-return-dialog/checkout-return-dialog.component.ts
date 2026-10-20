import { DatePipe } from '@angular/common';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  CheckoutItemRequest,
  CheckoutLogDto,
  ReturnItemRequest,
} from '../../../core/models/checkout-loadout.models';
import {
  ItemCondition,
  ItemConditions,
  ItemDto,
  ItemStatuses,
  ItemTypes,
} from '../../../core/models/item.models';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';

export interface CheckoutReturnDialogData {
  item: ItemDto;
}

@Component({
  imports: [
    FormsModule,
    DatePipe,
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
    MatDatepickerModule,
  ],
  providers: [provideNativeDateAdapter()],
  selector: 'app-checkout-return-dialog',
  templateUrl: './checkout-return-dialog.component.html',
  styleUrl: './checkout-return-dialog.component.scss',
})
export class CheckoutReturnDialogComponent implements OnInit {
  readonly data = inject<CheckoutReturnDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CheckoutReturnDialogComponent>);
  private readonly checkoutLoadoutService = inject(CheckoutLoadoutService);
  private readonly snackBar = inject(MatSnackBar);

  readonly itemStatuses = ItemStatuses;
  readonly itemTypes = ItemTypes;
  readonly itemConditions = ItemConditions;

  readonly isCurrentlyCheckedOut =
    this.data.item.status === ItemStatuses.InUse ||
    this.data.item.status === ItemStatuses.LoanedOut;

  readonly activeTab = signal<'action' | 'history'>('action');
  readonly submitting = signal(false);
  readonly loadingHistory = signal(false);
  readonly history = signal<CheckoutLogDto[]>([]);

  checkoutMode: 'inUse' | 'loan' = 'inUse';
  projectOrNote = '';
  borrowerName = '';
  borrowerContact = '';
  expectedReturnDate: Date | string | null = null;

  quantityUsed = 0;
  updatedCondition: ItemCondition = this.data.item.condition;
  returnNote = '';

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loadingHistory.set(true);
    this.checkoutLoadoutService.getItemCheckoutHistory(this.data.item.id).subscribe({
      next: (logs) => {
        this.history.set(logs);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.loadingHistory.set(false);
      },
    });
  }

  submitCheckout(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const isLoan = this.checkoutMode === 'loan';
    const req: CheckoutItemRequest = {
      isExternalLoan: isLoan,
      borrowerName: isLoan ? this.borrowerName.trim() : null,
      borrowerContact: isLoan ? this.borrowerContact.trim() : null,
      projectOrNote: this.projectOrNote.trim() || null,
      expectedReturnAt:
        isLoan && this.expectedReturnDate ? new Date(this.expectedReturnDate).toISOString() : null,
    };

    this.checkoutLoadoutService.checkoutItem(this.data.item.id, req).subscribe({
      next: (updatedItem) => {
        this.submitting.set(false);
        this.snackBar.open(
          isLoan
            ? `Loaned "${updatedItem.name}" to ${updatedItem.checkedOutToBorrower}`
            : `Checked out "${updatedItem.name}"`,
          'OK',
          { duration: 3000 },
        );
        this.dialogRef.close(updatedItem);
      },
      error: (err) => {
        this.submitting.set(false);
        this.snackBar.open(err.error?.detail || 'Failed to check out item.', 'OK', {
          duration: 4000,
        });
      },
    });
  }

  submitReturn(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const req: ReturnItemRequest = {
      returnNote: this.returnNote.trim() || null,
      quantityUsed:
        this.data.item.itemType === ItemTypes.Quantity ? Number(this.quantityUsed) : null,
      updatedCondition:
        this.updatedCondition !== this.data.item.condition ? this.updatedCondition : null,
    };

    this.checkoutLoadoutService.returnItem(this.data.item.id, req).subscribe({
      next: (updatedItem) => {
        this.submitting.set(false);
        this.snackBar.open(
          `Returned "${updatedItem.name}" to ${updatedItem.homeLocationName || 'home location'}`,
          'OK',
          { duration: 3000 },
        );
        this.dialogRef.close(updatedItem);
      },
      error: (err) => {
        this.submitting.set(false);
        this.snackBar.open(err.error?.detail || 'Failed to return item.', 'OK', { duration: 4000 });
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
