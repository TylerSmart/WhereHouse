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
  templateUrl: './loadouts-dialog.component.html',
  styleUrl: './loadouts-dialog.component.scss',
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
