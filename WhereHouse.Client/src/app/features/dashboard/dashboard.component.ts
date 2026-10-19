import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  LocationNodeDto,
  LocationNodeType,
  LocationNodeTypes,
  LocationTreeNodeDto,
} from '../../core/models/location.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';
import { ConfirmDialogComponent } from './confirm-delete-dialog/confirm-delete-dialog.component';
import {
  LocationDialogComponent,
  LocationDialogData,
  LocationDialogResult,
} from './location-dialog/location-dialog.component';
import {
  MoveLocationDialogComponent,
  MoveLocationDialogData,
} from './move-location-dialog/move-location-dialog.component';

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
  imports: [
    NgTemplateOutlet,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly LocationNodeTypes = LocationNodeTypes;

  protected readonly treeNodes = signal<LocationTreeNodeDto[]>([]);
  protected readonly allNodes = signal<LocationNodeDto[]>([]);
  protected readonly selectedNodeId = signal<string | null>(null);
  protected readonly expandedIds = signal<Set<string>>(new Set());
  protected readonly searchQuery = signal<string>('');
  protected readonly filterNodeType = signal<'all' | 'fixed' | 'container'>('all');
  protected readonly sidebarOpen = signal<boolean>(true);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

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
    const filterType = this.filterNodeType();
    const all = this.allNodes();
    const parentId = this.selectedNodeId();

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

    if (filterType === 'fixed') {
      list = list.filter((n) => n.nodeType === LocationNodeTypes.FixedLocation);
    } else if (filterType === 'container') {
      list = list.filter((n) => n.nodeType === LocationNodeTypes.MovableContainer);
    }

    return list.sort((a, b) => {
      if (a.nodeType !== b.nodeType) {
        return a.nodeType - b.nodeType;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  });

  protected readonly stats = computed(() => {
    const all = this.allNodes();
    const fixedCount = all.filter((n) => n.nodeType === LocationNodeTypes.FixedLocation).length;
    const containerCount = all.filter(
      (n) => n.nodeType === LocationNodeTypes.MovableContainer,
    ).length;
    const privateCount = all.filter((n) => n.isPrivate).length;
    return { fixedCount, containerCount, privateCount, total: all.length };
  });

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  ngOnInit(): void {
    this.refreshAll();
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

  setFilterType(type: 'all' | 'fixed' | 'container'): void {
    this.filterNodeType.set(type);
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
    // Exclude the node itself and any of its descendants
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

  onLogout(): void {
    this.authService.logout();
  }
}
