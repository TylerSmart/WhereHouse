import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryDto } from '../../core/models/category.models';
import {
  ItemConditions,
  ItemDto,
  ItemStatus,
  ItemStatuses,
  ItemType,
  ItemTypes,
} from '../../core/models/item.models';
import {
  LocationNodeDto,
  LocationNodeType,
  LocationNodeTypes,
  LocationTreeNodeDto,
} from '../../core/models/location.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { CategoryService } from '../../core/services/category/category.service';
import { ItemService } from '../../core/services/item/item.service';
import { LocationService } from '../../core/services/location/location.service';
import { LifecycleService } from '../../core/services/lifecycle/lifecycle.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';
import { CategoryManagerDialogComponent } from './category-manager-dialog/category-manager-dialog.component';
import { ConfirmDialogComponent } from './confirm-delete-dialog/confirm-delete-dialog.component';
import { ItemAttachmentsDialogComponent } from './item-attachments-dialog/item-attachments-dialog.component';
import {
  ItemDialogComponent,
  ItemDialogData,
  ItemDialogResult,
} from './item-dialog/item-dialog.component';
import {
  LocationDialogComponent,
  LocationDialogData,
  LocationDialogResult,
} from './location-dialog/location-dialog.component';
import { LocationAttachmentsDialogComponent } from './location-attachments-dialog/location-attachments-dialog.component';
import {
  MoveLocationDialogComponent,
  MoveLocationDialogData,
} from './move-location-dialog/move-location-dialog.component';
import { ActivatedRoute } from '@angular/router';
import { PrintableLabelItem } from '../../core/models/qrcode.models';
import {
  ScannerDialogAction,
  ScannerDialogComponent,
} from './scanner-dialog/scanner-dialog.component';
import { LabelGeneratorDialogComponent } from './label-generator-dialog/label-generator-dialog.component';
import {
  SmartSearchDialogComponent,
  SmartSearchResultAction,
} from './smart-search-dialog/smart-search-dialog.component';
import { RapidIntakeDialogComponent } from './rapid-intake-dialog/rapid-intake-dialog.component';
import { ImportExportDialogComponent } from './import-export-dialog/import-export-dialog.component';
import { CheckoutLoadoutService } from '../../core/services/checkout-loadout/checkout-loadout.service';
import { CheckoutReturnDialogComponent } from './checkout-return-dialog/checkout-return-dialog.component';
import { LoadoutsDialogComponent } from './loadouts-dialog/loadouts-dialog.component';
import {
  DeclutterGraveyardDialogComponent,
  DeclutterGraveyardDialogData,
} from './declutter-graveyard-dialog/declutter-graveyard-dialog.component';
import {
  StageArchiveDialogComponent,
  StageArchiveDialogData,
} from './stage-archive-dialog/stage-archive-dialog.component';
import {
  MaintenanceDialogComponent,
  MaintenanceDialogData,
} from './maintenance-dialog/maintenance-dialog.component';
import {
  InsuranceExportDialogComponent,
  InsuranceExportDialogData,
} from './insurance-export-dialog/insurance-export-dialog.component';
import {
  ActionCenterDialogComponent,
  ActionCenterDialogData,
} from './action-center-dialog/action-center-dialog.component';
import { ActionCenterOverviewDto } from '../../core/models/action-center.models';
import { ActionCenterService } from '../../core/services/action-center/action-center.service';

const THEME_ICONS: Record<ThemeMode, string> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'brightness_auto',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

@Component({
  host: {
    '(window:keydown)': 'onGlobalKeydown($event)',
  },
  imports: [
    DatePipe,
    CurrencyPipe,
    NgTemplateOutlet,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  selector: 'app-dashboard',
  styleUrl: './dashboard.component.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly locationService = inject(LocationService);
  private readonly categoryService = inject(CategoryService);
  private readonly itemService = inject(ItemService);
  private readonly lifecycleService = inject(LifecycleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  protected readonly checkoutLoadoutService = inject(CheckoutLoadoutService);
  private readonly actionCenterService = inject(ActionCenterService);

  readonly cartCount = computed(() => this.checkoutLoadoutService.cartItems().length);
  readonly actionCenterOverview = signal<ActionCenterOverviewDto | null>(null);
  readonly actionCenterAlertCount = computed(
    () => this.actionCenterOverview()?.totalAlertsCount ?? 0,
  );

  protected readonly LocationNodeTypes = LocationNodeTypes;
  protected readonly ItemTypes = ItemTypes;
  protected readonly ItemStatuses = ItemStatuses;
  protected readonly ItemConditions = ItemConditions;

  protected readonly treeNodes = signal<LocationTreeNodeDto[]>([]);
  protected readonly allNodes = signal<LocationNodeDto[]>([]);
  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly items = signal<ItemDto[]>([]);
  protected readonly selectedNodeId = signal<string | null>(null);
  protected readonly expandedIds = signal<Set<string>>(new Set());
  protected readonly searchQuery = signal<string>('');
  protected readonly filterType = signal<'all' | 'fixed' | 'container' | 'items'>('all');
  protected readonly sidebarOpen = signal<boolean>(true);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  readonly itemViewMode = signal<'grid' | 'table'>('grid');
  readonly selectedItemIds = signal<Set<string>>(new Set());
  readonly selectedItemsCount = computed(() => this.selectedItemIds().size);
  readonly allDisplayedItemsSelected = computed(() => {
    const displayed = this.displayedItems();
    const selected = this.selectedItemIds();
    return displayed.length > 0 && displayed.every((i) => selected.has(i.id));
  });

  readonly showBulkMoveBar = signal<boolean>(false);
  readonly showBulkTagBar = signal<boolean>(false);
  readonly bulkTargetLocationId = signal<string | null>(null);
  readonly bulkTagInput = signal<string>('');

  readonly draggedNodeId = signal<string | null>(null);
  readonly dragOverNodeId = signal<string | null>(null);

  protected readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    if (!id) {
      return null;
    }
    return this.allNodes().find((n) => n.id === id) ?? null;
  });

  protected readonly currentBreadcrumbs = computed(() => {
    return this.selectedNode()?.breadcrumbs ?? [];
  });

  protected readonly displayedNodes = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.filterType();
    const all = this.allNodes();
    const parentId = this.selectedNodeId();

    if (filter === 'items') {
      return [];
    }

    let list: LocationNodeDto[];

    if (query) {
      list = all.filter(
        (n) =>
          n.name.toLowerCase().includes(query) ||
          n.shortCode.toLowerCase().includes(query) ||
          (n.description && n.description.toLowerCase().includes(query)) ||
          (n.containerStyle && n.containerStyle.toLowerCase().includes(query)) ||
          (n.colorLabel && n.colorLabel.toLowerCase().includes(query)) ||
          n.fullPath.toLowerCase().includes(query),
      );
    } else {
      list = all.filter((n) => n.parentId === parentId);
    }

    if (filter === 'fixed') {
      list = list.filter((n) => n.nodeType === LocationNodeTypes.FixedLocation);
    } else if (filter === 'container') {
      list = list.filter((n) => n.nodeType === LocationNodeTypes.MovableContainer);
    }

    return list.sort((a, b) => {
      if (a.nodeType !== b.nodeType) {
        return a.nodeType - b.nodeType;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  });

  protected readonly displayedItems = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.filterType();
    const all = this.items();
    const parentId = this.selectedNodeId();

    if (filter === 'fixed' || filter === 'container') {
      return [];
    }

    let list: ItemDto[];

    if (query) {
      list = all.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          i.shortCode.toLowerCase().includes(query) ||
          (i.brand && i.brand.toLowerCase().includes(query)) ||
          (i.modelNumber && i.modelNumber.toLowerCase().includes(query)) ||
          (i.serialNumber && i.serialNumber.toLowerCase().includes(query)) ||
          (i.categoryName && i.categoryName.toLowerCase().includes(query)) ||
          (i.description && i.description.toLowerCase().includes(query)) ||
          (i.tags && i.tags.some((t) => t.toLowerCase().includes(query))) ||
          (i.aliases && i.aliases.some((a) => a.toLowerCase().includes(query))),
      );
    } else {
      list = all.filter((i) => i.homeLocationId === parentId);
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  });

  protected readonly stats = computed(() => {
    const all = this.allNodes();
    const allItms = this.items();
    const fixedCount = all.filter((n) => n.nodeType === LocationNodeTypes.FixedLocation).length;
    const containerCount = all.filter(
      (n) => n.nodeType === LocationNodeTypes.MovableContainer,
    ).length;
    const privateCount = all.filter((n) => n.isPrivate).length;
    const itemCount = allItms.length;
    return { fixedCount, containerCount, privateCount, itemCount, total: all.length };
  });

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  ngOnInit(): void {
    this.refreshAll();
    const codeParam = this.route.snapshot.paramMap.get('code');
    if (codeParam && codeParam.trim()) {
      this.openScannerDialog(codeParam.trim());
    }
  }

  refreshAll(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.locationService.getTree().subscribe({
      next: (tree) => {
        this.treeNodes.set(tree);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.detail || err?.error?.title || 'Failed to load location tree.',
        );
      },
    });

    this.locationService.getLocations({ includeAllDepths: true }).subscribe({
      next: (nodes) => {
        this.allNodes.set(nodes);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.detail || err?.error?.title || 'Failed to load locations.',
        );
      },
    });

    this.categoryService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.detail || err?.error?.title || 'Failed to load categories.',
        );
      },
    });

    this.itemService.getItems().subscribe({
      next: (itms) => {
        this.items.set(itms);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || err?.error?.title || 'Failed to load items.');
      },
    });

    this.loadActionCenterOverview();
  }

  loadActionCenterOverview(): void {
    this.actionCenterService.getOverview().subscribe({
      next: (overview) => {
        this.actionCenterOverview.set(overview);
      },
      error: () => {
        // Silently handle overview load error
      },
    });
  }

  selectNode(id: string | null): void {
    this.selectedNodeId.set(id);
    if (id) {
      this.expandedIds.update((set) => {
        const next = new Set(set);
        next.add(id);
        return next;
      });
    }
  }

  toggleNodeExpanded(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  setFilterType(type: 'all' | 'fixed' | 'container' | 'items'): void {
    this.filterType.set(type);
  }

  openCreateDialog(nodeType?: LocationNodeType): void {
    const parent = this.selectedNode();
    const dialogRef = this.dialog.open<
      LocationDialogComponent,
      LocationDialogData,
      LocationDialogResult
    >(LocationDialogComponent, {
      width: '560px',
      data: {
        parentId: parent?.id ?? null,
        parentName: parent?.name ?? null,
        defaultNodeType: nodeType,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || result.mode !== 'create') {
        return;
      }

      this.locationService.createLocation(result.request).subscribe({
        next: (created) => {
          this.snackBar.open(`"${created.name}" created`, 'Close', { duration: 3000 });
          this.refreshAll();
          if (created.parentId) {
            this.expandedIds.update((s) => new Set(s).add(created.parentId!));
          }
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to create location', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openEditDialog(node: LocationNodeDto): void {
    const dialogRef = this.dialog.open<
      LocationDialogComponent,
      LocationDialogData,
      LocationDialogResult
    >(LocationDialogComponent, {
      width: '560px',
      data: {
        node,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || result.mode !== 'update') {
        return;
      }

      this.locationService.updateLocation(node.id, result.request).subscribe({
        next: (updated) => {
          this.snackBar.open(`"${updated.name}" updated`, 'Close', { duration: 3000 });
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to update location', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openMoveDialog(node: LocationNodeDto): void {
    const all = this.allNodes();
    const availableTargets = all.filter((n) => {
      if (n.id === node.id) {
        return false;
      }
      return !n.breadcrumbs.some((b) => b.id === node.id);
    });

    const dialogRef = this.dialog.open(MoveLocationDialogComponent, {
      width: '500px',
      data: {
        node,
        availableTargets,
      } as MoveLocationDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.locationService.moveLocation(node.id, result).subscribe({
        next: (moved) => {
          this.snackBar.open(`Moved "${moved.name}" to ${moved.fullPath}`, 'Close', {
            duration: 3500,
          });
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to move location', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  deleteNode(node: LocationNodeDto): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete ${node.nodeType === LocationNodeTypes.MovableContainer ? 'Container' : 'Location'}`,
        message: `Are you sure you want to delete "${node.name}" (${node.shortCode})? This action cannot be undone.`,
        confirmText: 'Delete',
        isDestructive: true,
      },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.locationService.deleteLocation(node.id).subscribe({
        next: () => {
          this.snackBar.open(`"${node.name}" deleted`, 'Close', { duration: 3000 });
          if (this.selectedNodeId() === node.id) {
            this.selectedNodeId.set(node.parentId);
          }
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to delete location', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  getCoverPhotoUrl(locationId: string): string {
    return this.locationService.getCoverPhotoUrl(locationId);
  }

  openLocationAttachmentsDialog(node: LocationNodeDto): void {
    const ref = this.dialog.open(LocationAttachmentsDialogComponent, {
      width: '580px',
      maxWidth: '96vw',
      data: { location: node },
    });

    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.refreshAll();
      }
    });
  }

  openEditItemById(childId: string): void {
    this.itemService.getItemById(childId).subscribe({
      next: (item: ItemDto) => this.openEditItemDialog(item),
      error: (err: { error?: { message?: string } }) => {
        this.snackBar.open(err?.error?.message ?? 'Failed to load component item', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  openCreateItemDialog(homeLocationId?: string | null): void {
    const dialogRef = this.dialog.open<ItemDialogComponent, ItemDialogData, ItemDialogResult>(
      ItemDialogComponent,
      {
        width: '720px',
        data: {
          availableLocations: this.allNodes(),
          availableCategories: this.categories(),
          availableParentItems: this.items(),
          homeLocationId: homeLocationId !== undefined ? homeLocationId : this.selectedNodeId(),
        },
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || result.mode !== 'create') {
        return;
      }

      this.itemService.createItem(result.request).subscribe({
        next: (created) => {
          this.snackBar.open(`Item "${created.name}" (${created.shortCode}) created`, 'Close', {
            duration: 3000,
          });
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to create item', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openEditItemDialog(item: ItemDto): void {
    const dialogRef = this.dialog.open<ItemDialogComponent, ItemDialogData, ItemDialogResult>(
      ItemDialogComponent,
      {
        width: '720px',
        data: {
          item,
          availableLocations: this.allNodes(),
          availableCategories: this.categories(),
          availableParentItems: this.items().filter((i) => i.id !== item.id),
          homeLocationId: item.homeLocationId,
        },
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || result.mode !== 'update') {
        return;
      }

      this.itemService.updateItem(item.id, result.request).subscribe({
        next: (updated) => {
          this.snackBar.open(`"${updated.name}" updated`, 'Close', { duration: 3000 });
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to update item', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openCloneItemDialog(item: ItemDto): void {
    const dialogRef = this.dialog.open<ItemDialogComponent, ItemDialogData, ItemDialogResult>(
      ItemDialogComponent,
      {
        width: '720px',
        data: {
          cloneFromItem: item,
          availableLocations: this.allNodes(),
          availableCategories: this.categories(),
          availableParentItems: this.items().filter((i) => i.id !== item.id),
          homeLocationId: item.homeLocationId,
        },
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || result.mode !== 'create') {
        return;
      }

      this.itemService.createItem(result.request).subscribe({
        next: (created) => {
          this.snackBar.open(`Item "${created.name}" (${created.shortCode}) created`, 'Close', {
            duration: 3000,
          });
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to create item', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openDuplicateItemDialog(item: ItemDto): void {
    this.itemService.duplicateItem(item.id).subscribe({
      next: (cloned) => {
        this.snackBar.open(`Cloned "${cloned.name}" (${cloned.shortCode})`, 'Close', {
          duration: 3500,
        });
        this.refreshAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.detail || 'Failed to duplicate item', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  openRapidIntakeDialog(locationId?: string | null): void {
    const dialogRef = this.dialog.open(RapidIntakeDialogComponent, {
      width: '780px',
      maxWidth: '96vw',
      data: {
        initialLocationId: locationId !== undefined ? locationId : this.selectedNodeId(),
        availableLocations: this.allNodes(),
        availableCategories: this.categories(),
      },
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res && res.createdCount > 0) {
        this.refreshAll();
      }
    });
  }

  openImportExportDialog(): void {
    const dialogRef = this.dialog.open(ImportExportDialogComponent, {
      width: '820px',
      maxWidth: '96vw',
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res?.imported) {
        this.refreshAll();
      }
    });
  }

  adjustItemQuantity(item: ItemDto, change: number, event: MouseEvent): void {
    event.stopPropagation();
    this.itemService.adjustQuantity(item.id, { delta: change }).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
        if (updated.minQuantity !== null && updated.currentQuantity <= updated.minQuantity) {
          this.snackBar.open(
            `Low stock warning: "${updated.name}" is at ${updated.currentQuantity} (min: ${updated.minQuantity})`,
            'Close',
            { duration: 4000 },
          );
        }
      },
      error: (err) => {
        this.snackBar.open(err?.error?.detail || 'Failed to adjust quantity', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  deleteItem(item: ItemDto): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Item',
        message: `Are you sure you want to delete "${item.name}" (${item.shortCode})? This action cannot be undone.`,
        confirmText: 'Delete',
        isDestructive: true,
      },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.itemService.deleteItem(item.id).subscribe({
        next: () => {
          this.snackBar.open(`"${item.name}" deleted`, 'Close', { duration: 3000 });
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to delete item', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openCategoryManagerDialog(): void {
    const ref = this.dialog.open(CategoryManagerDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
    });

    ref.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  getItemTypeIcon(type: ItemType): string {
    switch (type) {
      case ItemTypes.Quantity:
        return 'layers';
      case ItemTypes.Kit:
        return 'cases';
      case ItemTypes.Nested:
        return 'account_tree';
      default:
        return 'fingerprint';
    }
  }

  getItemTypeName(type: ItemType): string {
    switch (type) {
      case ItemTypes.Quantity:
        return 'Quantity';
      case ItemTypes.Kit:
        return 'Kit';
      case ItemTypes.Nested:
        return 'Nested';
      default:
        return 'Unique';
    }
  }

  getItemStatusName(status: ItemStatus): string {
    switch (status) {
      case ItemStatuses.InUse:
        return 'In Use';
      case ItemStatuses.LoanedOut:
        return 'Loaned Out';
      case ItemStatuses.StagedToSell:
        return 'Staged (Sell)';
      case ItemStatuses.StagedToDonate:
        return 'Staged (Donate)';
      case ItemStatuses.Archived:
        return 'Archived';
      default:
        return 'In Place';
    }
  }

  openCheckoutReturnDialog(item: ItemDto, event?: MouseEvent): void {
    event?.stopPropagation();
    const ref = this.dialog.open(CheckoutReturnDialogComponent, {
      data: { item },
      width: '540px',
      maxWidth: '96vw',
    });

    ref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      }
    });
  }

  openLoadoutsDialog(initialTab: 'loadouts' | 'cart' | 'loans' = 'loadouts'): void {
    const ref = this.dialog.open(LoadoutsDialogComponent, {
      data: {
        initialTab,
        availableItems: this.items(),
      },
      width: '840px',
      maxWidth: '96vw',
    });

    ref.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  addToCart(item: ItemDto, event?: MouseEvent): void {
    event?.stopPropagation();
    this.checkoutLoadoutService.addToCart(item);
    this.snackBar.open(`Added "${item.name}" to Project Cart`, 'OK', {
      duration: 2500,
    });
  }

  quickReturnItem(item: ItemDto, event?: MouseEvent): void {
    event?.stopPropagation();
    this.checkoutLoadoutService
      .returnItem(item.id, {
        returnNote: 'Returned to home bin from dashboard',
      })
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
          this.snackBar.open(
            `Returned "${updated.name}" to ${updated.homeLocationName || 'home bin'}`,
            'OK',
            { duration: 3000 },
          );
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to return item', 'OK', {
            duration: 4000,
          });
        },
      });
  }

  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSmartSearchDialog(this.searchQuery());
    }
  }

  openSmartSearchDialog(initialQuery?: string): void {
    const dialogRef = this.dialog.open<
      SmartSearchDialogComponent,
      {
        availableLocations: LocationNodeDto[];
        availableCategories: CategoryDto[];
        initialQuery?: string;
      },
      SmartSearchResultAction
    >(SmartSearchDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      data: {
        availableLocations: this.allNodes(),
        availableCategories: this.categories(),
        initialQuery,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      if (result.action === 'selectLocation' && result.locationId) {
        this.selectLocationAndExpand(result.locationId);
      } else if (result.action === 'editItem' && result.item) {
        this.openEditItemDialog(result.item);
      } else if (result.action === 'openAttachments' && result.item) {
        this.openItemAttachmentsDialog(result.item);
      }
    });
  }

  selectLocationAndExpand(locationId: string): void {
    const node = this.allNodes().find((n) => n.id === locationId);
    if (node) {
      this.expandedIds.update((set) => {
        const next = new Set(set);
        for (const b of node.breadcrumbs) {
          next.add(b.id);
        }
        next.add(locationId);
        return next;
      });
    }
    this.selectedNodeId.set(locationId);
  }

  openItemAttachmentsDialog(item: ItemDto): void {
    const dialogRef = this.dialog.open(ItemAttachmentsDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { item },
    });

    dialogRef.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  openScannerDialog(initialCode?: string | null): void {
    const dialogRef = this.dialog.open<
      ScannerDialogComponent,
      {
        initialCode?: string | null;
        availableLocations: LocationNodeDto[];
        availableItems: ItemDto[];
      },
      ScannerDialogAction
    >(ScannerDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        initialCode: initialCode ?? null,
        availableLocations: this.allNodes(),
        availableItems: this.items(),
      },
    });

    dialogRef.afterClosed().subscribe((res?: ScannerDialogAction) => {
      if (!res) {
        return;
      }
      if (res.action === 'selectLocation') {
        this.selectLocationAndExpand(res.locationId);
      } else if (res.action === 'editItem') {
        this.openEditItemDialog(res.item);
      } else if (res.action === 'printLabel') {
        this.openLabelGeneratorDialog([res.label]);
      }
    });
  }

  openLabelGeneratorDialog(preselectedLabels?: PrintableLabelItem[]): void {
    this.dialog.open(LabelGeneratorDialogComponent, {
      width: '860px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        availableLocations: this.allNodes(),
        availableItems: this.items(),
        preselectedLabels,
      },
    });
  }

  printLocationLabel(loc: LocationNodeDto): void {
    const label: PrintableLabelItem = {
      code: loc.shortCode,
      title: loc.name,
      subtitle: loc.fullPath,
      badgeText:
        loc.containerStyle || (loc.nodeType === LocationNodeTypes.MovableContainer ? 'BIN' : 'LOC'),
      primaryColor: loc.primaryColor || null,
      accentColor: loc.accentColor || null,
    };
    this.openLabelGeneratorDialog([label]);
  }

  printItemLabel(item: ItemDto): void {
    const label: PrintableLabelItem = {
      code: item.shortCode,
      title: item.name,
      subtitle: item.homeLocationFullPath || item.brand || null,
      badgeText: item.unit ? `${item.currentQuantity} ${item.unit}` : 'ITEM',
      primaryColor: null,
      accentColor: null,
    };
    this.openLabelGeneratorDialog([label]);
  }

  openDeclutterGraveyardDialog(initialTab?: 'staged' | 'dust' | 'graveyard'): void {
    const dialogRef = this.dialog.open(DeclutterGraveyardDialogComponent, {
      width: '900px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: { initialTab } as DeclutterGraveyardDialogData,
    });

    dialogRef.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  openStageArchiveDialog(item: ItemDto, initialMode: 'stage' | 'archive'): void {
    const dialogRef = this.dialog.open(StageArchiveDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      data: { item, initialMode } as StageArchiveDialogData,
    });

    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        this.refreshAll();
      }
    });
  }

  unstageItem(item: ItemDto): void {
    this.lifecycleService.unstageItem(item.id).subscribe({
      next: (updated) => {
        this.snackBar.open(`Unstaged "${updated.name}"`, 'Close', { duration: 3000 });
        this.refreshAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.detail || 'Failed to unstage item', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  openMaintenanceDialog(item?: ItemDto | null): void {
    const ref = this.dialog.open<MaintenanceDialogComponent, MaintenanceDialogData>(
      MaintenanceDialogComponent,
      {
        data: {
          item,
          availableItems: this.items(),
        },
        width: '840px',
        maxWidth: '96vw',
      },
    );

    ref.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  openInsuranceExportDialog(): void {
    this.dialog.open<InsuranceExportDialogComponent, InsuranceExportDialogData>(
      InsuranceExportDialogComponent,
      {
        data: {
          availableLocations: this.allNodes(),
          availableCategories: this.categories(),
        },
        width: '940px',
        maxWidth: '96vw',
      },
    );
  }

  openActionCenterDialog(
    initialFilter:
      'all' | 'out-of-place' | 'loans' | 'maintenance' | 'warranties' | 'low-stock' = 'all',
    initialTab: 'alerts' | 'channels' | 'history' = 'alerts',
  ): void {
    const ref = this.dialog.open<ActionCenterDialogComponent, ActionCenterDialogData>(
      ActionCenterDialogComponent,
      {
        data: {
          initialFilter,
          initialTab,
        },
        width: '960px',
        maxWidth: '96vw',
      },
    );

    ref.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  setItemViewMode(mode: 'grid' | 'table'): void {
    this.itemViewMode.set(mode);
  }

  toggleItemSelection(id: string, eventOrChecked?: Event | boolean): void {
    if (
      eventOrChecked &&
      typeof eventOrChecked === 'object' &&
      'stopPropagation' in eventOrChecked
    ) {
      eventOrChecked.stopPropagation();
    }
    const current = new Set(this.selectedItemIds());
    if (typeof eventOrChecked === 'boolean') {
      if (eventOrChecked) {
        current.add(id);
      } else {
        current.delete(id);
      }
    } else {
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
    }
    this.selectedItemIds.set(current);
  }

  toggleSelectAllDisplayed(): void {
    const displayed = this.displayedItems();
    if (displayed.length === 0) {
      return;
    }
    const current = new Set(this.selectedItemIds());
    const allSelected = displayed.every((i) => current.has(i.id));
    if (allSelected) {
      for (const i of displayed) {
        current.delete(i.id);
      }
    } else {
      for (const i of displayed) {
        current.add(i.id);
      }
    }
    this.selectedItemIds.set(current);
  }

  clearItemSelection(): void {
    this.selectedItemIds.set(new Set());
    this.showBulkMoveBar.set(false);
    this.showBulkTagBar.set(false);
  }

  isItemSelected(id: string): boolean {
    return this.selectedItemIds().has(id);
  }

  toggleBulkMoveBar(): void {
    this.showBulkMoveBar.update((v) => !v);
    this.showBulkTagBar.set(false);
  }

  toggleBulkTagBar(): void {
    this.showBulkTagBar.update((v) => !v);
    this.showBulkMoveBar.set(false);
  }

  executeBulkMove(): void {
    const targetLocId = this.bulkTargetLocationId();
    const itemIds = Array.from(this.selectedItemIds());
    if (itemIds.length === 0) {
      return;
    }
    this.itemService
      .bulkUpdateItems({
        itemIds,
        updateHomeLocation: true,
        targetHomeLocationId: targetLocId || null,
      })
      .subscribe({
        next: (res) => {
          this.snackBar.open(`Moved ${res.updatedCount} item(s) successfully.`, 'Close', {
            duration: 3000,
          });
          this.showBulkMoveBar.set(false);
          this.clearItemSelection();
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to bulk move items.', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  executeBulkTag(mode: 'add' | 'remove'): void {
    const tag = this.bulkTagInput().trim();
    if (!tag) {
      return;
    }
    const itemIds = Array.from(this.selectedItemIds());
    if (itemIds.length === 0) {
      return;
    }
    this.itemService
      .bulkUpdateItems({
        itemIds,
        addTags: mode === 'add' ? [tag] : undefined,
        removeTags: mode === 'remove' ? [tag] : undefined,
      })
      .subscribe({
        next: (res) => {
          this.snackBar.open(
            `${mode === 'add' ? 'Added tag to' : 'Removed tag from'} ${res.updatedCount} item(s).`,
            'Close',
            { duration: 3000 },
          );
          this.bulkTagInput.set('');
          this.showBulkTagBar.set(false);
          this.refreshAll();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to update tags.', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  bulkPrintSelectedItemLabels(): void {
    const selected = this.items().filter((i) => this.selectedItemIds().has(i.id));
    if (selected.length === 0) {
      return;
    }
    const labels: PrintableLabelItem[] = selected.map((item) => ({
      code: item.shortCode,
      title: item.name,
      subtitle: item.homeLocationFullPath || item.brand || null,
      badgeText: item.unit ? `${item.currentQuantity} ${item.unit}` : 'ITEM',
      primaryColor: null,
      accentColor: null,
    }));
    this.openLabelGeneratorDialog(labels);
  }

  bulkAddSelectedToCart(): void {
    const selected = this.items().filter((i) => this.selectedItemIds().has(i.id));
    let addedCount = 0;
    for (const item of selected) {
      if (!this.checkoutLoadoutService.isInCart(item.id)) {
        this.checkoutLoadoutService.addToCart(item);
        addedCount++;
      }
    }
    this.snackBar.open(`Added ${addedCount} item(s) to Project Cart.`, 'Close', {
      duration: 3000,
    });
  }

  onTreeNodeDragStart(event: DragEvent, node: LocationTreeNodeDto): void {
    this.draggedNodeId.set(node.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.id);
    }
  }

  onTreeNodeDragOver(event: DragEvent, node: LocationTreeNodeDto | null): void {
    const dragged = this.draggedNodeId();
    if (!dragged) {
      return;
    }
    if (node && node.id === dragged) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverNodeId.set(node ? node.id : 'root');
  }

  onTreeNodeDragLeave(_event: DragEvent, node: LocationTreeNodeDto | null): void {
    const targetId = node ? node.id : 'root';
    if (this.dragOverNodeId() === targetId) {
      this.dragOverNodeId.set(null);
    }
  }

  onTreeNodeDrop(event: DragEvent, targetParentId: string | null): void {
    event.preventDefault();
    const dragged = this.draggedNodeId();
    this.dragOverNodeId.set(null);
    this.draggedNodeId.set(null);

    if (!dragged || dragged === targetParentId) {
      return;
    }

    this.dropNodeOnTarget(dragged, targetParentId);
  }

  onTreeNodeDragEnd(): void {
    this.draggedNodeId.set(null);
    this.dragOverNodeId.set(null);
  }

  dropNodeOnTarget(draggedId: string, targetParentId: string | null): void {
    this.locationService.moveLocation(draggedId, { newParentId: targetParentId }).subscribe({
      next: (moved) => {
        const targetName = targetParentId
          ? (this.allNodes().find((n) => n.id === targetParentId)?.name ?? 'target')
          : 'Root';
        this.snackBar.open(`Moved "${moved.name}" into "${targetName}".`, 'Close', {
          duration: 3000,
        });
        this.refreshAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.detail || 'Failed to move location.', 'Close', {
          duration: 4000,
        });
      },
    });
  }

  onLogout(): void {
    this.authService.logout();
  }
}
