import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LocationNodeTypes } from '../../../core/models/location.models';
import { LocationDialogComponent, LocationDialogData } from './location-dialog.component';

describe('LocationDialogComponent', () => {
  let component: LocationDialogComponent;
  let fixture: ComponentFixture<LocationDialogComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockData: LocationDialogData = {
    parentId: 'parent-1',
    parentName: 'Garage',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and initialize form for create mode', () => {
    expect(component).toBeTruthy();
    expect(component['isEditMode']).toBe(false);
    expect(component['form'].controls['name'].value).toBe('');
    expect(component['form'].controls['nodeType'].value).toBe(LocationNodeTypes.FixedLocation);
  });

  it('should submit create request on valid form', () => {
    component['form'].patchValue({
      name: 'Shelf 1',
      nodeType: LocationNodeTypes.FixedLocation,
    });

    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      mode: 'create',
      request: expect.objectContaining({
        name: 'Shelf 1',
        nodeType: LocationNodeTypes.FixedLocation,
        parentId: 'parent-1',
      }),
    });
  });
});
