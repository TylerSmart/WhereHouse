import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { TodoItemDto } from '../../core/models/todo.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { TodoService } from '../../core/services/todo/todo.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockTodos: TodoItemDto[] = [
    {
      id: 't-1',
      title: 'Configure Database',
      description: 'Set up SQL Server connection string',
      isCompleted: false,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
    {
      id: 't-2',
      title: 'Deploy Container',
      description: 'Push Docker image to GHCR',
      isCompleted: true,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
  ];

  let mockTodoService: {
    getTodos: ReturnType<typeof vi.fn>;
    createTodo: ReturnType<typeof vi.fn>;
    updateTodo: ReturnType<typeof vi.fn>;
    deleteTodo: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockTodoService = {
      getTodos: vi.fn().mockReturnValue(of(mockTodos)),
      createTodo: vi.fn().mockReturnValue(
        of({
          id: 't-new',
          title: 'Brand New Task',
          description: null,
          isCompleted: false,
          createdAt: '2026-10-18T00:00:00Z',
          modifiedAt: '2026-10-18T00:00:00Z',
        }),
      ),
      updateTodo: vi.fn().mockReturnValue(
        of({
          ...mockTodos[0],
          isCompleted: true,
        }),
      ),
      deleteTodo: vi.fn().mockReturnValue(of(undefined)),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'u-1',
        email: 'alice@example.com',
        username: 'alice',
      }),
      logout: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: TodoService, useValue: mockTodoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        ThemeService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load tasks', () => {
    expect(component).toBeTruthy();
    expect(mockTodoService.getTodos).toHaveBeenCalled();
    expect(component['todos']().length).toBe(2);
  });

  it('should filter tasks based on search query', () => {
    component['searchQuery'].set('Database');
    expect(component['filteredTodos']().length).toBe(1);
    expect(component['filteredTodos']()[0].title).toBe('Configure Database');

    component['searchQuery'].set('GHCR');
    expect(component['filteredTodos']().length).toBe(1);
    expect(component['filteredTodos']()[0].title).toBe('Deploy Container');

    component['searchQuery'].set('nonexistent');
    expect(component['filteredTodos']().length).toBe(0);
  });

  it('should toggle task completion status', () => {
    component.toggleTodoCompletion(mockTodos[0]);
    expect(mockTodoService.updateTodo).toHaveBeenCalledWith('t-1', {
      title: 'Configure Database',
      description: 'Set up SQL Server connection string',
      isCompleted: true,
    });
  });

  it('should call logout on AuthService', () => {
    component.onLogout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should delete task when confirmed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.deleteTodo(mockTodos[0]);

    expect(mockTodoService.deleteTodo).toHaveBeenCalledWith('t-1');
    expect(component['todos']().length).toBe(1);
    expect(mockSnackBar.open).toHaveBeenCalled();
  });
});
