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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CheckoutLoadoutRequest,
  CreateLoadoutRequest,
  LoadoutDto,
  LoadoutStatuses,
  PackBackLoadoutItemEntry,
  PackBackLoadoutRequest,
  UpsertLoadoutItemRequest,
} from '../../../core/models/checkout-loadout.models';
import { ItemDto, ItemStatuses, ItemTypes } from '../../../core/models/item.models';
import { CheckoutLoadoutService } from '../../../core/services/checkout-loadout/checkout-loadout.service';

export interface LoadoutsDialogData {
  initialTab?: 'loadouts' | 'cart' | 'loans';
  availableItems: ItemDto[];
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
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatExpansionModule,
    MatSlideToggleModule,
  ],
  selector: 'app-loadouts-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-header">
      <div class="header-content">
        <mat-icon class="header-icon">backpack</mat-icon>
        <span class="dialog-title-text">Loadouts, Project Cart & Active Loans</span>
      </div>
    </h2>

    <mat-dialog-content class="dialog-content">
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'loadouts'"
          (click)="activeTab.set('loadouts')"
        >
          <mat-icon>backpack</mat-icon>
          <span>Reusable Loadouts ({{ loadouts().length }})</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'cart'"
          (click)="activeTab.set('cart')"
        >
          <mat-icon>shopping_cart</mat-icon>
          <span>Project Cart ({{ cartItems().length }})</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'loans'"
          (click)="switchTabToLoans()"
        >
          <mat-icon>assignment</mat-icon>
          <span>Active Loans ({{ activeLoans().length }})</span>
        </button>
      </div>

      <!-- TAB 1: REUSABLE LOADOUTS -->
      @if (activeTab() === 'loadouts') {
        <div class="loadouts-tab">
          <div class="section-actions">
            <span class="section-hint"
              >Pre-planned packing lists with room-by-room pick lists and consumable tracking.</span
            >
            <button mat-stroked-button type="button" (click)="toggleCreatingNew()">
              <mat-icon>{{ creatingNew() ? 'close' : 'add_circle' }}</mat-icon>
              {{ creatingNew() ? 'Cancel' : 'New Loadout Template' }}
            </button>
          </div>

          @if (creatingNew()) {
            <!-- NEW LOADOUT TEMPLATE FORM -->
            <div class="new-loadout-panel">
              <h3>Create Reusable Loadout</h3>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Loadout Name</mat-label>
                <input
                  matInput
                  [(ngModel)]="newLoadoutName"
                  placeholder="e.g. Weekend Camping, Drywall Repair Kit"
                  required
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description (Optional)</mat-label>
                <input matInput [(ngModel)]="newLoadoutDesc" placeholder="Purpose or context" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Add Items</mat-label>
                <mat-select
                  [(ngModel)]="selectedItemIds"
                  multiple
                  placeholder="Select items to include"
                >
                  @for (itm of data.availableItems; track itm.id) {
                    <mat-option [value]="itm.id">
                      [{{ itm.shortCode }}] {{ itm.name }} ({{
                        itm.homeLocationFullPath || 'Unassigned'
                      }})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div class="form-actions">
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="!newLoadoutName.trim() || submitting()"
                  (click)="saveNewLoadout()"
                >
                  <mat-icon>save</mat-icon> Save Template
                </button>
              </div>
            </div>
          }

          @if (loadingLoadouts()) {
            <p class="empty-state">Loading loadouts...</p>
          } @else if (loadouts().length === 0 && !creatingNew()) {
            <div class="empty-state-box">
              <mat-icon class="empty-icon">backpack</mat-icon>
              <p>No reusable loadout templates yet.</p>
              <span class="sub"
                >Create a loadout for camping, sports, emergency prep, or specific tasks!</span
              >
            </div>
          } @else {
            <div class="loadout-list">
              @for (loadout of loadouts(); track loadout.id) {
                <div class="loadout-card">
                  <div class="card-summary">
                    <div class="summary-left">
                      <mat-icon class="loadout-icon">{{ loadout.icon || 'backpack' }}</mat-icon>
                      <div class="loadout-titles">
                        <span class="loadout-name">{{ loadout.name }}</span>
                        @if (loadout.description) {
                          <span class="loadout-desc">{{ loadout.description }}</span>
                        }
                        <div class="meta-row">
                          <span
                            class="status-tag"
                            [class.active]="loadout.status === loadoutStatuses.ActiveCheckout"
                          >
                            {{
                              loadout.status === loadoutStatuses.ActiveCheckout
                                ? 'Active Checkout'
                                : 'Ready to Pack'
                            }}
                          </span>
                          <span class="item-count">{{ loadout.totalItemCount }} items</span>
                          @if (loadout.preFlightWarningCount > 0) {
                            <span class="warning-tag">
                              <mat-icon inline>warning</mat-icon>
                              {{ loadout.preFlightWarningCount }} Pre-Flight Alerts
                            </span>
                          }
                        </div>
                      </div>
                    </div>

                    <div class="summary-actions">
                      @if (loadout.status === loadoutStatuses.Ready) {
                        <button
                          mat-flat-button
                          color="primary"
                          type="button"
                          [disabled]="submitting()"
                          (click)="checkoutLoadout(loadout)"
                        >
                          <mat-icon>outbox</mat-icon> Check Out Loadout
                        </button>
                      } @else {
                        <button
                          mat-flat-button
                          color="accent"
                          type="button"
                          [disabled]="submitting()"
                          (click)="openPackBack(loadout)"
                        >
                          <mat-icon>move_to_inbox</mat-icon> Pack-Back & Reconcile
                        </button>
                      }
                      <button
                        mat-icon-button
                        type="button"
                        (click)="deleteLoadout(loadout.id)"
                        title="Delete Loadout"
                      >
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>

                  <!-- PRE-FLIGHT WARNINGS BANNER -->
                  @if (loadout.preFlightWarnings.length > 0) {
                    <div class="warnings-box">
                      <strong>⚠️ Pre-Flight Check:</strong>
                      <ul>
                        @for (warn of loadout.preFlightWarnings; track warn) {
                          <li>{{ warn }}</li>
                        }
                      </ul>
                    </div>
                  }

                  <!-- ROOM-BY-ROOM PICK LIST EXPANSION -->
                  <mat-expansion-panel class="pick-list-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon inline>route</mat-icon> Room-by-Room Pick List ({{
                          loadout.pickListStops.length
                        }}
                        stops)
                      </mat-panel-title>
                    </mat-expansion-panel-header>

                    <div class="pick-list-stops">
                      @for (stop of loadout.pickListStops; track stop.locationId) {
                        <div class="stop-box">
                          <div class="stop-header">
                            <mat-icon inline>meeting_room</mat-icon>
                            <strong>{{ stop.locationFullPath }}</strong>
                          </div>
                          <ul class="stop-items">
                            @for (li of stop.items; track li.id) {
                              <li class="stop-item">
                                <span class="item-id">[{{ li.itemShortCode }}]</span>
                                <span class="item-label">{{ li.itemName }}</span>
                                <span class="qty"
                                  >Req: {{ li.requiredQuantity }} {{ li.unit || '' }}</span
                                >
                                @if (li.isConsumable) {
                                  <span class="consumable-pill">Consumable</span>
                                }
                                @if (li.hasPreFlightWarning) {
                                  <span class="item-warn">⚠️ {{ li.preFlightWarningMessage }}</span>
                                }
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>

                  <!-- PACK-BACK PANEL -->
                  @if (activePackBackLoadoutId() === loadout.id) {
                    <div class="pack-back-drawer">
                      <div class="pb-header">
                        <h4>Pack-Back Checklist & Consumable Reconciliation</h4>
                        <button
                          mat-button
                          type="button"
                          (click)="activePackBackLoadoutId.set(null)"
                        >
                          Close
                        </button>
                      </div>
                      <p class="pb-hint">
                        Unreturned items stay marked In Use. Consumed quantities will be
                        automatically deducted from inventory.
                      </p>

                      <div class="pb-items">
                        @for (entry of packBackEntries(); track entry.itemId) {
                          <div class="pb-row">
                            <label class="pb-checkbox-label">
                              <input type="checkbox" [(ngModel)]="entry.isReturned" />
                              <span class="pb-item-name">{{ entry.itemName }}</span>
                            </label>

                            @if (entry.isConsumable || entry.isQuantity) {
                              <div class="pb-qty-box">
                                <span class="pb-qty-label">Qty Used:</span>
                                <input
                                  type="number"
                                  min="0"
                                  [max]="entry.quantityCheckedOut"
                                  [(ngModel)]="entry.quantityUsed"
                                />
                                <button
                                  type="button"
                                  class="chip-btn"
                                  (click)="entry.quantityUsed = 0"
                                >
                                  None
                                </button>
                                <button
                                  type="button"
                                  class="chip-btn"
                                  (click)="entry.quantityUsed = entry.quantityCheckedOut"
                                >
                                  All
                                </button>
                              </div>
                            }
                          </div>
                        }
                      </div>

                      <div class="pb-actions">
                        <button
                          mat-flat-button
                          color="primary"
                          type="button"
                          [disabled]="submitting()"
                          (click)="submitPackBack(loadout.id)"
                        >
                          <mat-icon>check_circle</mat-icon> Complete Pack-Back
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- TAB 2: PROJECT CART -->
      @if (activeTab() === 'cart') {
        <div class="cart-tab">
          <div class="cart-header-row">
            <span class="section-hint"
              >Ad-hoc cart for gathering items across multiple rooms for a household task.</span
            >
            @if (cartItems().length > 0) {
              <button mat-button color="warn" type="button" (click)="clearCart()">
                <mat-icon>delete_sweep</mat-icon> Clear Cart
              </button>
            }
          </div>

          @if (cartItems().length === 0) {
            <div class="empty-state-box">
              <mat-icon class="empty-icon">shopping_cart</mat-icon>
              <p>Your Project Cart is empty.</p>
              <span class="sub"
                >Click "Add to Cart" on any item card in the dashboard or scanner.</span
              >
            </div>
          } @else {
            <div class="cart-controls">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Project or Note for Cart Checkout</mat-label>
                <input
                  matInput
                  [(ngModel)]="cartProjectNote"
                  placeholder="e.g. Garage cleanup, Deck sanding"
                />
              </mat-form-field>
            </div>

            <!-- CART ROOM-BY-ROOM PICK LIST -->
            <div class="cart-items-grouped">
              @for (group of groupedCartItems(); track group.locationFullPath) {
                <div class="cart-room-group">
                  <div class="group-header">
                    <mat-icon inline>meeting_room</mat-icon>
                    <strong>{{ group.locationFullPath }}</strong>
                  </div>
                  <div class="group-items">
                    @for (item of group.items; track item.id) {
                      <div class="cart-item-row">
                        <span class="code">[{{ item.shortCode }}]</span>
                        <span class="name">{{ item.name }}</span>
                        <button
                          mat-icon-button
                          type="button"
                          (click)="removeFromCart(item.id)"
                          title="Remove from Cart"
                        >
                          <mat-icon>remove_shopping_cart</mat-icon>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="cart-actions-bar">
              <button
                mat-flat-button
                color="primary"
                type="button"
                [disabled]="submitting()"
                (click)="checkoutCart()"
              >
                <mat-icon>outbox</mat-icon> Check Out All Cart Items ({{ cartItems().length }})
              </button>

              <button
                mat-stroked-button
                type="button"
                [disabled]="submitting()"
                (click)="saveCartAsLoadout()"
              >
                <mat-icon>save</mat-icon> Save Cart as Reusable Loadout
              </button>
            </div>
          }
        </div>
      }

      <!-- TAB 3: ACTIVE LOANS & CHECKOUTS -->
      @if (activeTab() === 'loans') {
        <div class="loans-tab">
          <div class="filter-row">
            <span class="section-hint"
              >Real-time view of all items currently out of place or loaned out.</span
            >
            <div class="filter-toggles">
              <mat-slide-toggle [(ngModel)]="loansOnlyFilter" (change)="loadActiveLoans()">
                External Loans Only
              </mat-slide-toggle>
              <mat-slide-toggle [(ngModel)]="overdueOnlyFilter" (change)="loadActiveLoans()">
                Overdue Only
              </mat-slide-toggle>
            </div>
          </div>

          @if (loadingLoans()) {
            <p class="empty-state">Loading active loans...</p>
          } @else if (activeLoans().length === 0) {
            <div class="empty-state-box">
              <mat-icon class="empty-icon">check_circle</mat-icon>
              <p>Everything is currently in its home bin!</p>
              <span class="sub">No items are currently checked out or loaned out.</span>
            </div>
          } @else {
            <div class="loans-list">
              @for (itm of activeLoans(); track itm.id) {
                <div class="loan-card" [class.overdue]="itm.isOverdueLoan">
                  <div class="loan-details">
                    <div class="loan-title-row">
                      <span class="code">[{{ itm.shortCode }}]</span>
                      <strong class="name">{{ itm.name }}</strong>
                      @if (itm.isOverdueLoan) {
                        <span class="overdue-tag">OVERDUE</span>
                      }
                    </div>

                    <div class="loan-meta">
                      <span class="borrower">
                        <mat-icon inline>{{
                          itm.status === itemStatuses.LoanedOut ? 'person_search' : 'construction'
                        }}</mat-icon>
                        {{
                          itm.status === itemStatuses.LoanedOut
                            ? 'Loaned to ' + (itm.checkedOutToBorrower || 'N/A')
                            : 'In Use by ' + (itm.checkedOutByUsername || 'User')
                        }}
                      </span>
                      @if (itm.checkoutNote || itm.activeLoadoutName) {
                        <span class="note"
                          >"{{
                            itm.activeLoadoutName
                              ? 'Loadout: ' + itm.activeLoadoutName
                              : itm.checkoutNote
                          }}"</span
                        >
                      }
                      @if (itm.checkoutDueAt) {
                        <span class="due">Due: {{ itm.checkoutDueAt | date: 'shortDate' }}</span>
                      }
                      @if (itm.homeLocationFullPath) {
                        <span class="home">Home: {{ itm.homeLocationFullPath }}</span>
                      }
                    </div>
                  </div>

                  <div class="loan-actions">
                    <button
                      mat-stroked-button
                      type="button"
                      [disabled]="submitting()"
                      (click)="returnLoanItem(itm)"
                    >
                      <mat-icon>move_to_inbox</mat-icon> Return to Home
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-header {
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .header-content {
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
    .dialog-title-text {
      font-size: 1.15rem;
      font-weight: 600;
    }
    .dialog-content {
      padding: 16px 24px;
      min-width: 600px;
      max-width: 820px;
      max-height: 80vh;
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
      padding: 8px 14px;
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
    .section-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .section-hint {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .new-loadout-panel {
      padding: 16px;
      border: 1px solid var(--mat-sys-primary, #1976d2);
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #fafafa);
      margin-bottom: 16px;
    }
    .new-loadout-panel h3 {
      margin: 0 0 12px;
      font-size: 1rem;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
    }
    .loadout-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .loadout-card {
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      padding: 14px 16px;
      background: var(--mat-sys-surface, #fff);
    }
    .card-summary {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .summary-left {
      display: flex;
      gap: 12px;
    }
    .loadout-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: var(--mat-sys-primary, #1976d2);
      margin-top: 2px;
    }
    .loadout-titles {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .loadout-name {
      font-size: 1rem;
      font-weight: 600;
    }
    .loadout-desc {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .status-tag {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 10px;
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status-tag.active {
      background: #fff3e0;
      color: #e65100;
    }
    .item-count {
      font-size: 0.78rem;
      color: #777;
    }
    .warning-tag {
      font-size: 0.72rem;
      font-weight: 600;
      color: #d32f2f;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .summary-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .warnings-box {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #fff8e1;
      border-left: 4px solid #ffb300;
      font-size: 0.82rem;
      color: #795548;
    }
    .warnings-box ul {
      margin: 4px 0 0 16px;
      padding: 0;
    }
    .pick-list-panel {
      margin-top: 10px;
      box-shadow: none !important;
      border: 1px solid var(--mat-sys-outline-variant, #f0f0f0);
    }
    .pick-list-stops {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0;
    }
    .stop-box {
      padding: 8px 10px;
      background: var(--mat-sys-surface-container, #f9f9f9);
      border-radius: 6px;
    }
    .stop-header {
      font-size: 0.82rem;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      color: var(--mat-sys-primary, #1976d2);
    }
    .stop-items {
      list-style: none;
      margin: 0;
      padding: 0 0 0 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stop-item {
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .item-id {
      font-weight: bold;
      color: #555;
    }
    .item-label {
      font-weight: 500;
    }
    .qty {
      color: #777;
    }
    .consumable-pill {
      font-size: 0.7rem;
      background: #e0f2f1;
      color: #00695c;
      padding: 1px 6px;
      border-radius: 8px;
    }
    .item-warn {
      color: #d32f2f;
      font-weight: 500;
    }
    .pack-back-drawer {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      background: #e8f5e9;
      border: 1px solid #c8e6c9;
    }
    .pb-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .pb-header h4 {
      margin: 0;
      font-size: 0.95rem;
      color: #1b5e20;
    }
    .pb-hint {
      margin: 0 0 10px;
      font-size: 0.8rem;
      color: #388e3c;
    }
    .pb-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pb-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      padding: 6px 10px;
      border-radius: 6px;
    }
    .pb-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .pb-qty-box {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
    }
    .pb-qty-box input {
      width: 50px;
      padding: 4px;
      border: 1px solid #ccc;
      border-radius: 4px;
      text-align: center;
    }
    .chip-btn {
      background: #eee;
      border: none;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.72rem;
      cursor: pointer;
    }
    .chip-btn:hover {
      background: #ddd;
    }
    .pb-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .cart-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .cart-room-group {
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 6px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .group-header {
      background: var(--mat-sys-surface-container, #f5f5f5);
      padding: 8px 12px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .group-items {
      padding: 6px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cart-item-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }
    .cart-item-row .code {
      font-weight: bold;
      color: var(--mat-sys-primary, #1976d2);
    }
    .cart-item-row .name {
      flex: 1;
    }
    .cart-actions-bar {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
    .loans-tab {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .filter-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .filter-toggles {
      display: flex;
      gap: 16px;
    }
    .loans-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .loan-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      border-radius: 8px;
      background: #fff;
    }
    .loan-card.overdue {
      border-color: #d32f2f;
      background: #fff8f8;
    }
    .loan-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .overdue-tag {
      font-size: 0.7rem;
      font-weight: bold;
      background: #d32f2f;
      color: #fff;
      padding: 1px 6px;
      border-radius: 6px;
    }
    .loan-meta {
      font-size: 0.82rem;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: #555;
    }
    .empty-state-box {
      text-align: center;
      padding: 36px 16px;
      color: #888;
    }
    .empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: #bbb;
      margin-bottom: 8px;
    }
    .empty-state-box p {
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
    }
    .empty-state-box .sub {
      font-size: 0.85rem;
      color: #aaa;
    }
  `,
})
export class LoadoutsDialogComponent implements OnInit {
  readonly data = inject<LoadoutsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LoadoutsDialogComponent>);
  private readonly checkoutLoadoutService = inject(CheckoutLoadoutService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loadoutStatuses = LoadoutStatuses;
  readonly itemStatuses = ItemStatuses;
  readonly itemTypes = ItemTypes;

  readonly activeTab = signal<'loadouts' | 'cart' | 'loans'>('loadouts');
  readonly submitting = signal(false);
  readonly loadingLoadouts = signal(false);
  readonly loadingLoans = signal(false);
  readonly loadouts = signal<LoadoutDto[]>([]);
  readonly activeLoans = signal<ItemDto[]>([]);
  readonly cartItems = this.checkoutLoadoutService.cartItems;

  creatingNew = signal(false);
  newLoadoutName = '';
  newLoadoutDesc = '';
  selectedItemIds: string[] = [];

  activePackBackLoadoutId = signal<string | null>(null);
  packBackEntries = signal<
    {
      itemId: string;
      itemName: string;
      isReturned: boolean;
      quantityUsed: number;
      quantityCheckedOut: number;
      isConsumable: boolean;
      isQuantity: boolean;
    }[]
  >([]);

  cartProjectNote = '';
  loansOnlyFilter = false;
  overdueOnlyFilter = false;

  ngOnInit(): void {
    if (this.data.initialTab) {
      this.activeTab.set(this.data.initialTab);
    }
    this.loadLoadouts();
    if (this.activeTab() === 'loans') {
      this.loadActiveLoans();
    }
  }

  switchTabToLoans(): void {
    this.activeTab.set('loans');
    this.loadActiveLoans();
  }

  loadLoadouts(): void {
    this.loadingLoadouts.set(true);
    this.checkoutLoadoutService.getLoadouts().subscribe({
      next: (res) => {
        this.loadouts.set(res);
        this.loadingLoadouts.set(false);
      },
      error: () => {
        this.loadingLoadouts.set(false);
      },
    });
  }

  loadActiveLoans(): void {
    this.loadingLoans.set(true);
    this.checkoutLoadoutService
      .getActiveCheckouts(
        this.loansOnlyFilter ? true : undefined,
        this.overdueOnlyFilter ? true : undefined,
      )
      .subscribe({
        next: (items) => {
          this.activeLoans.set(items);
          this.loadingLoans.set(false);
        },
        error: () => {
          this.loadingLoans.set(false);
        },
      });
  }

  toggleCreatingNew(): void {
    this.creatingNew.set(!this.creatingNew());
    this.newLoadoutName = '';
    this.newLoadoutDesc = '';
    this.selectedItemIds = [];
  }

  saveNewLoadout(): void {
    if (!this.newLoadoutName.trim() || this.submitting()) return;
    this.submitting.set(true);

    const items: UpsertLoadoutItemRequest[] = this.selectedItemIds.map((itemId) => {
      const found = this.data.availableItems.find((i) => i.id === itemId);
      return {
        itemId,
        requiredQuantity: 1,
        isConsumable: found?.itemType === ItemTypes.Quantity,
      };
    });

    const req: CreateLoadoutRequest = {
      name: this.newLoadoutName.trim(),
      description: this.newLoadoutDesc.trim() || null,
      items,
    };

    this.checkoutLoadoutService.createLoadout(req).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.creatingNew.set(false);
        this.snackBar.open(`Created loadout "${created.name}"`, 'OK', {
          duration: 3000,
        });
        this.loadLoadouts();
      },
      error: (err) => {
        this.submitting.set(false);
        this.snackBar.open(err.error?.detail || 'Failed to create loadout.', 'OK', {
          duration: 4000,
        });
      },
    });
  }

  deleteLoadout(id: string): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.checkoutLoadoutService.deleteLoadout(id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackBar.open('Loadout deleted', 'OK', { duration: 3000 });
        this.loadLoadouts();
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  checkoutLoadout(loadout: LoadoutDto): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const req: CheckoutLoadoutRequest = {
      checkoutNote: loadout.description || null,
    };

    this.checkoutLoadoutService.checkoutLoadout(loadout.id, req).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.snackBar.open(
          `Checked out ${updated.checkedOutItemCount} items for "${updated.name}"`,
          'OK',
          { duration: 3500 },
        );
        this.loadLoadouts();
      },
      error: (err) => {
        this.submitting.set(false);
        this.snackBar.open(err.error?.detail || 'Failed to check out loadout.', 'OK', {
          duration: 4000,
        });
      },
    });
  }

  openPackBack(loadout: LoadoutDto): void {
    this.activePackBackLoadoutId.set(loadout.id);
    const entries = loadout.items.map((li) => ({
      itemId: li.itemId,
      itemName: li.itemName,
      isReturned: true,
      quantityUsed: 0,
      quantityCheckedOut: li.quantityCheckedOut,
      isConsumable: li.isConsumable,
      isQuantity: li.itemType === ItemTypes.Quantity,
    }));
    this.packBackEntries.set(entries);
  }

  submitPackBack(loadoutId: string): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const items: PackBackLoadoutItemEntry[] = this.packBackEntries().map((e) => ({
      itemId: e.itemId,
      isReturned: e.isReturned,
      quantityUsed: Number(e.quantityUsed) || 0,
    }));

    const req: PackBackLoadoutRequest = {
      items,
      returnNote: 'Returned via Pack-Back checklist',
    };

    this.checkoutLoadoutService.packBackLoadout(loadoutId, req).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.activePackBackLoadoutId.set(null);
        this.snackBar.open(
          `Pack-back complete for "${updated.name}" (${updated.status === LoadoutStatuses.Ready ? 'All Items Returned' : 'Some Items Still In Use'})`,
          'OK',
          { duration: 4000 },
        );
        this.loadLoadouts();
      },
      error: (err) => {
        this.submitting.set(false);
        this.snackBar.open(err.error?.detail || 'Failed to submit pack-back.', 'OK', {
          duration: 4000,
        });
      },
    });
  }

  // --- Cart Helpers ---

  groupedCartItems(): {
    locationFullPath: string;
    items: ItemDto[];
  }[] {
    const items = this.cartItems();
    const map = new Map<string, ItemDto[]>();

    for (const item of items) {
      const loc = item.homeLocationFullPath || 'Unassigned Location';
      if (!map.has(loc)) {
        map.set(loc, []);
      }
      map.get(loc)!.push(item);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locationFullPath, groupItems]) => ({
        locationFullPath,
        items: groupItems,
      }));
  }

  removeFromCart(itemId: string): void {
    this.checkoutLoadoutService.removeFromCart(itemId);
  }

  clearCart(): void {
    this.checkoutLoadoutService.clearCart();
  }

  checkoutCart(): void {
    const items = this.cartItems();
    if (items.length === 0 || this.submitting()) return;
    this.submitting.set(true);

    this.checkoutLoadoutService
      .batchCheckout({
        itemIds: items.map((i) => i.id),
        projectOrNote: this.cartProjectNote.trim() || 'Project Cart Checkout',
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.checkoutLoadoutService.clearCart();
          this.snackBar.open(
            `Checked out ${res.processedCount} items from your project cart!`,
            'OK',
            { duration: 3500 },
          );
          this.dialogRef.close();
        },
        error: (err) => {
          this.submitting.set(false);
          this.snackBar.open(err.error?.detail || 'Failed to check out cart.', 'OK', {
            duration: 4000,
          });
        },
      });
  }

  saveCartAsLoadout(): void {
    const items = this.cartItems();
    if (items.length === 0) return;

    this.creatingNew.set(true);
    this.newLoadoutName = this.cartProjectNote.trim() || 'Project Loadout';
    this.selectedItemIds = items.map((i) => i.id);
    this.activeTab.set('loadouts');
  }

  returnLoanItem(item: ItemDto): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    this.checkoutLoadoutService
      .returnItem(item.id, { returnNote: 'Returned from active loans view' })
      .subscribe({
        next: (ret) => {
          this.submitting.set(false);
          this.snackBar.open(`Returned "${ret.name}" to ${ret.homeLocationName || 'home'}`, 'OK', {
            duration: 3000,
          });
          this.loadActiveLoans();
        },
        error: (err) => {
          this.submitting.set(false);
          this.snackBar.open(err.error?.detail || 'Failed to return item.', 'OK', {
            duration: 4000,
          });
        },
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
