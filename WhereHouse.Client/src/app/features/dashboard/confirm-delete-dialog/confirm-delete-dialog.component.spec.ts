import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-delete-dialog.component';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const testData: ConfirmDialogData = {
    title: 'Test Confirmation',
    message: 'Are you certain?',
    confirmText: 'Yes',
    cancelText: 'No',
    isDestructive: true,
  };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: testData },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and render dialog text', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Confirmation');
    expect(compiled.textContent).toContain('Are you certain?');
  });

  it('should close with true on confirm', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const confirmButton = buttons[1];
    confirmButton.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close with false on cancel', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const cancelButton = buttons[0];
    cancelButton.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });
});
