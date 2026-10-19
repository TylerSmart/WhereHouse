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
  template: `
    <h2 mat-dialog-title class="dialog-header">
      <div class="title-with-icon">
        <mat-icon class="header-icon">{{
          isCurrentlyCheckedOut ? 'move_to_inbox' : 'outbox'
        }}</mat-icon>
        <div class="header-text">
          <span class="action-label">{{
            isCurrentlyCheckedOut ? 'Return to Home Bin' : 'Check Out / Loan'
          }}</span>
          <span class="item-name"
            >{{ data.item.name }} <span class="code">[{{ data.item.shortCode }}]</span></span
          >
        </div>
      </div>
    </h2>

    <mat-dialog-content class="dialog-content">
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'action'"
          (click)="activeTab.set('action')"
        >
          <mat-icon>{{ isCurrentlyCheckedOut ? 'assignment_return' : 'exit_to_app' }}</mat-icon>
          <span>{{ isCurrentlyCheckedOut ? 'Return Action' : 'Checkout Action' }}</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'history'"
          (click)="activeTab.set('history')"
        >
          <mat-icon>history</mat-icon>
          <span>Audit History</span>
        </button>
      </div>

      @if (activeTab() === 'action') {
        @if (!isCurrentlyCheckedOut) {
          <!-- CHECK OUT FLOW -->
          <div class="checkout-form">
            <p class="section-desc">
              Record real-time usage for a household project or lend to a friend. The item's
              permanent home location will be preserved.
            </p>

            <div class="radio-selection">
              <mat-radio-group [(ngModel)]="checkoutMode" class="checkout-radio-group">
                <mat-radio-button value="inUse" class="radio-option">
                  <div class="radio-content">
                    <strong
                      ><mat-icon inline>construction</mat-icon> In Use (Household Project)</strong
                    >
                    <span class="sub">Using around the house, workshop, or yard</span>
                  </div>
                </mat-radio-button>
                <mat-radio-button value="loan" class="radio-option">
                  <div class="radio-content">
                    <strong
                      ><mat-icon inline>person_search</mat-icon> External Loan (Friend /
                      Neighbor)</strong
                    >
                    <span class="sub">Lending out with borrower details and optional due date</span>
                  </div>
                </mat-radio-button>
              </mat-radio-group>
            </div>

            @if (checkoutMode === 'inUse') {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Project or Note (Optional)</mat-label>
                <input
                  matInput
                  [(ngModel)]="projectOrNote"
                  placeholder="e.g. Kitchen Cabinet Remodel, Deck Staining"
                />
              </mat-form-field>
            } @else {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Borrower Name</mat-label>
                <input
                  matInput
                  [(ngModel)]="borrowerName"
                  placeholder="e.g. Dave Miller"
                  required
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Borrower Contact (Optional)</mat-label>
                <input
                  matInput
                  [(ngModel)]="borrowerContact"
                  placeholder="Phone number, email, or neighbor note"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Expected Return Date (Optional)</mat-label>
                <input
                  matInput
                  [matDatepicker]="returnDatePicker"
                  [(ngModel)]="expectedReturnDate"
                  placeholder="Choose return date"
                />
                <mat-datepicker-toggle
                  matIconSuffix
                  [for]="returnDatePicker"
                ></mat-datepicker-toggle>
                <mat-datepicker #returnDatePicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Project or Loan Note (Optional)</mat-label>
                <input
                  matInput
                  [(ngModel)]="projectOrNote"
                  placeholder="Reason for borrowing or details"
                />
              </mat-form-field>
            }

            @if (data.item.itemType === itemTypes.Kit) {
              <div class="info-alert">
                <mat-icon>info</mat-icon>
                <span
                  ><strong>Kit Cascade:</strong> Checking out this kit will automatically mark all
                  member items currently In Place as checked out.</span
                >
              </div>
            }
          </div>
        } @else {
          <!-- RETURN FLOW -->
          <div class="return-form">
            <div class="status-summary">
              <div class="status-banner">
                <mat-icon>{{
                  data.item.status === itemStatuses.LoanedOut ? 'handshake' : 'construction'
                }}</mat-icon>
                <div class="banner-details">
                  <span class="status-title">
                    {{
                      data.item.status === itemStatuses.LoanedOut
                        ? 'Loaned to ' + (data.item.checkedOutToBorrower || 'Borrower')
                        : 'In Use by ' + (data.item.checkedOutByUsername || 'User')
                    }}
                  </span>
                  @if (data.item.checkoutNote || data.item.activeLoadoutName) {
                    <span class="status-note">{{
                      data.item.activeLoadoutName
                        ? 'Loadout: ' + data.item.activeLoadoutName
                        : data.item.checkoutNote
                    }}</span>
                  }
                  @if (data.item.homeLocationFullPath) {
                    <span class="home-path">Home: {{ data.item.homeLocationFullPath }}</span>
                  }
                </div>
              </div>
            </div>

            @if (data.item.itemType === itemTypes.Quantity) {
              <div class="quantity-consumption">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label
                    >Quantity Consumed / Used (Available:
                    {{ data.item.currentQuantity }}
                    {{ data.item.unit || 'units' }})</mat-label
                  >
                  <input
                    matInput
                    type="number"
                    min="0"
                    [max]="data.item.currentQuantity"
                    [(ngModel)]="quantityUsed"
                  />
                </mat-form-field>
                <span class="help-text"
                  >Consumed quantity will be deducted from inventory automatically.</span
                >
              </div>
            }

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Updated Item Condition</mat-label>
              <mat-select [(ngModel)]="updatedCondition">
                <mat-option [value]="itemConditions.New">New</mat-option>
                <mat-option [value]="itemConditions.Excellent">Excellent</mat-option>
                <mat-option [value]="itemConditions.Good">Good</mat-option>
                <mat-option [value]="itemConditions.Fair">Fair</mat-option>
                <mat-option [value]="itemConditions.Broken">Broken</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Return Note (Optional)</mat-label>
              <input
                matInput
                [(ngModel)]="returnNote"
                placeholder="e.g. Returned clean, blade replaced, restocked"
              />
            </mat-form-field>

            @if (data.item.itemType === itemTypes.Kit) {
              <div class="info-alert">
                <mat-icon>info</mat-icon>
                <span
                  ><strong>Kit Cascade:</strong> Returning this kit will automatically return all
                  checked-out child items back to In Place.</span
                >
              </div>
            }
          </div>
        }
      } @else {
        <!-- AUDIT HISTORY -->
        <div class="history-view">
          @if (loadingHistory()) {
            <p class="empty-state">Loading checkout history...</p>
          } @else if (history().length === 0) {
            <p class="empty-state">No check-in / check-out history recorded.</p>
          } @else {
            <div class="history-timeline">
              @for (log of history(); track log.id) {
                <div class="history-card">
                  <div class="card-header">
                    <span
                      class="action-pill"
                      [class.in-use]="log.actionType === 0"
                      [class.loan]="log.actionType === 1"
                      [class.return]="log.actionType === 2"
                    >
                      {{
                        log.actionType === 0
                          ? 'Checked Out (In Use)'
                          : log.actionType === 1
                            ? 'Loaned Out'
                            : 'Returned'
                      }}
                    </span>
                    <span class="date">{{ log.occurredAt | date: 'medium' }}</span>
                  </div>
                  <div class="card-body">
                    <p class="actor">
                      <mat-icon inline>person</mat-icon>
                      {{ log.performedByUsername }}
                      @if (log.borrowerName) {
                        <span> $ ightarrow$ {{ log.borrowerName }}</span>
                      }
                    </p>
                    @if (log.projectOrNote) {
                      <p class="note">"{{ log.projectOrNote }}"</p>
                    }
                    @if (log.quantityConsumed) {
                      <p class="consumed">Consumed: {{ log.quantityConsumed }} units</p>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      @if (activeTab() === 'action') {
        @if (!isCurrentlyCheckedOut) {
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="submitting() || (checkoutMode === 'loan' && !borrowerName?.trim())"
            (click)="submitCheckout()"
          >
            <mat-icon>outbox</mat-icon> Check Out
          </button>
        } @else {
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="submitting()"
            (click)="submitReturn()"
          >
            <mat-icon>move_to_inbox</mat-icon> Return to Home Bin
          </button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-header {
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon {
      color: var(--mat-sys-primary, #1976d2);
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .header-text {
      display: flex;
      flex-direction: column;
    }
    .action-label {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .item-name {
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .code {
      font-weight: bold;
      color: var(--mat-sys-primary, #1976d2);
    }
    .dialog-content {
      padding: 20px 24px;
      min-width: 440px;
      max-width: 540px;
    }
    .tab-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      padding-bottom: 8px;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant, #666);
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      background: var(--mat-sys-surface-container, #f5f5f5);
    }
    .tab-btn.active {
      background: var(--mat-sys-primary-container, #e3f2fd);
      color: var(--mat-sys-on-primary-container, #0d47a1);
      font-weight: 600;
    }
    .section-desc {
      margin: 0 0 16px;
      font-size: 0.88rem;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .checkout-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }
    .radio-option {
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      padding: 10px 14px;
      transition: background 0.15s ease;
    }
    .radio-option:hover {
      background: var(--mat-sys-surface-container, #fafafa);
    }
    .radio-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .radio-content .sub {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant, #777);
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .info-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #e8f4fd;
      color: #0c5460;
      font-size: 0.85rem;
      margin-top: 8px;
    }
    .status-summary {
      margin-bottom: 16px;
    }
    .status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--mat-sys-primary-container, #e3f2fd);
      color: var(--mat-sys-on-primary-container, #0d47a1);
    }
    .banner-details {
      display: flex;
      flex-direction: column;
    }
    .status-title {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .status-note,
    .home-path {
      font-size: 0.82rem;
      opacity: 0.9;
    }
    .quantity-consumption {
      margin-bottom: 8px;
    }
    .help-text {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant, #666);
      display: block;
      margin-top: -6px;
      margin-bottom: 12px;
    }
    .history-timeline {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 350px;
      overflow-y: auto;
    }
    .history-card {
      padding: 10px 12px;
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      background: var(--mat-sys-surface, #fff);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .action-pill {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .action-pill.in-use {
      background: #fff3e0;
      color: #e65100;
    }
    .action-pill.loan {
      background: #f3e5f5;
      color: #7b1fa2;
    }
    .action-pill.return {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .date {
      font-size: 0.78rem;
      color: #888;
    }
    .actor {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .note {
      margin: 4px 0 0;
      font-size: 0.82rem;
      font-style: italic;
      color: #555;
    }
    .consumed {
      margin: 4px 0 0;
      font-size: 0.8rem;
      color: #c62828;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      color: #888;
      font-size: 0.9rem;
    }
  `,
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
