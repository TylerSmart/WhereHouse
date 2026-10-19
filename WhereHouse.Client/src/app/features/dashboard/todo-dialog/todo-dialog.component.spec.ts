import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TodoDialogComponent } from './todo-dialog.component';

describe('TodoDialogComponent', () => {
  let component: TodoDialogComponent;
  let fixture: ComponentFixture<TodoDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TodoDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: null },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TodoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in create mode when no todo is passed', () => {
    expect(component).toBeTruthy();
    expect(component['isEditMode']).toBe(false);
  });

  it('should close dialog with trimmed values when form is valid', () => {
    component['form'].setValue({
      title: '  My New Task  ',
      description: '  Task details  ',
    });

    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      title: 'My New Task',
      description: 'Task details',
    });
  });
});
