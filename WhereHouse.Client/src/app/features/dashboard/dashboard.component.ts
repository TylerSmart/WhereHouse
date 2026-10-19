import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TodoItemDto } from '../../core/models/todo.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';
import { TodoService } from '../../core/services/todo/todo.service';
import { ConfirmDialogComponent } from './confirm-delete-dialog/confirm-delete-dialog.component';
import {
  TodoDialogComponent,
  TodoDialogData,
  TodoDialogResult,
} from './todo-dialog/todo-dialog.component';

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
    DatePipe,
    MatCardModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-dashboard',
  styleUrl: './dashboard.component.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly todoService = inject(TodoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly todos = signal<TodoItemDto[]>([]);
  protected readonly searchQuery = signal<string>('');
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly filteredTodos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.todos();
    if (!query) {
      return list;
    }
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)),
    );
  });

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  ngOnInit(): void {
    this.loadTodos();
  }

  loadTodos(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.todoService.getTodos().subscribe({
      next: (list) => {
        this.todos.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || err?.error?.title || 'Failed to load tasks.');
      },
    });
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  openCreateTodoDialog(): void {
    const dialogRef = this.dialog.open<TodoDialogComponent, TodoDialogData, TodoDialogResult>(
      TodoDialogComponent,
      {
        width: '480px',
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.todoService.createTodo(result).subscribe({
        next: (created) => {
          this.todos.update((list) => [created, ...list]);
          this.snackBar.open(`Task "${created.title}" created`, 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to create task', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openEditTodoDialog(todo: TodoItemDto): void {
    const dialogRef = this.dialog.open<TodoDialogComponent, TodoDialogData, TodoDialogResult>(
      TodoDialogComponent,
      {
        width: '480px',
        data: { todo },
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.todoService
        .updateTodo(todo.id, {
          title: result.title,
          description: result.description,
          isCompleted: todo.isCompleted,
        })
        .subscribe({
          next: (updated) => {
            this.todos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
            this.snackBar.open(`Task "${updated.title}" updated`, 'Close', {
              duration: 3000,
            });
          },
          error: (err) => {
            this.snackBar.open(err?.error?.detail || 'Failed to update task', 'Close', {
              duration: 4000,
            });
          },
        });
    });
  }

  toggleTodoCompletion(todo: TodoItemDto): void {
    const nextCompleted = !todo.isCompleted;

    this.todoService
      .updateTodo(todo.id, {
        title: todo.title,
        description: todo.description,
        isCompleted: nextCompleted,
      })
      .subscribe({
        next: (updated) => {
          this.todos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to update task status', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  deleteTodo(todo: TodoItemDto): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Task',
        message: `Are you sure you want to delete "${todo.title}"? This action cannot be undone.`,
        confirmText: 'Delete',
        isDestructive: true,
      },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.todoService.deleteTodo(todo.id).subscribe({
        next: () => {
          this.todos.update((list) => list.filter((t) => t.id !== todo.id));
          this.snackBar.open(`Task "${todo.title}" deleted`, 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to delete task', 'Close', {
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
