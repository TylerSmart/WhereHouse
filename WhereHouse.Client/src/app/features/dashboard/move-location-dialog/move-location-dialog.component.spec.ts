import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LocationNodeDto, LocationNodeTypes } from '../../../core/models/location.models';
import {
  MoveLocationDialogComponent,
  MoveLocationDialogData,
} from './move-location-dialog.component';

describe('MoveLocationDialogComponent', () => {
  let component: MoveLocationDialogComponent;
  let fixture: ComponentFixture<MoveLocationDialogComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockNode: LocationNodeDto = {
    id: 'node-1',
    parentId: null,
    name: 'Bin 1',
    description: null,
    nodeType: LocationNodeTypes.MovableContainer,
    shortCode: 'BIN-001',
    icon: 'inventory_2',
    containerStyle: null,
    primaryColor: null,
    accentColor: null,
    colorLabel: null,
    isPrivate: false,
    ownerId: 'u-1',
    fullPath: 'Bin 1',
    breadcrumbs: [],
    childCount: 0,
    createdAt: '',
    modifiedAt: '',
  };

  const mockData: MoveLocationDialogData = {
    node: mockNode,
    availableTargets: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoveLocationDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MoveLocationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and confirm new parent selection', () => {
    expect(component).toBeTruthy();
    component['selectedParentId'] = 'target-1';
    component.onConfirm();
    expect(mockDialogRef.close).toHaveBeenCalledWith({ newParentId: 'target-1' });
  });
});
