import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  LocationNodeDto,
  LocationNodeTypes,
  LocationTreeNodeDto,
} from '../../core/models/location.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockNodes: LocationNodeDto[] = [
    {
      id: 'loc-1',
      parentId: null,
      name: 'Garage',
      description: 'Main Garage',
      nodeType: LocationNodeTypes.FixedLocation,
      shortCode: 'LOC-001',
      icon: 'garage',
      containerStyle: null,
      primaryColor: null,
      accentColor: null,
      colorLabel: null,
      isPrivate: false,
      ownerId: 'u-1',
      fullPath: 'Garage',
      breadcrumbs: [
        {
          id: 'loc-1',
          name: 'Garage',
          shortCode: 'LOC-001',
          nodeType: LocationNodeTypes.FixedLocation,
        },
      ],
      childCount: 1,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
    {
      id: 'loc-2',
      parentId: 'loc-1',
      name: 'Winter Camping Bin',
      description: 'Yellow lid tote',
      nodeType: LocationNodeTypes.MovableContainer,
      shortCode: 'BIN-001',
      icon: 'inventory_2',
      containerStyle: '27-Gal Heavy Duty Tote',
      primaryColor: '#1f2937',
      accentColor: '#eab308',
      colorLabel: 'Black Base / Yellow Lid',
      isPrivate: false,
      ownerId: 'u-1',
      fullPath: 'Garage > Winter Camping Bin',
      breadcrumbs: [
        {
          id: 'loc-1',
          name: 'Garage',
          shortCode: 'LOC-001',
          nodeType: LocationNodeTypes.FixedLocation,
        },
        {
          id: 'loc-2',
          name: 'Winter Camping Bin',
          shortCode: 'BIN-001',
          nodeType: LocationNodeTypes.MovableContainer,
        },
      ],
      childCount: 0,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    },
  ];

  const mockTree: LocationTreeNodeDto[] = [
    {
      id: 'loc-1',
      parentId: null,
      name: 'Garage',
      nodeType: LocationNodeTypes.FixedLocation,
      shortCode: 'LOC-001',
      icon: 'garage',
      containerStyle: null,
      primaryColor: null,
      accentColor: null,
      colorLabel: null,
      isPrivate: false,
      ownerId: 'u-1',
      fullPath: 'Garage',
      children: [
        {
          id: 'loc-2',
          parentId: 'loc-1',
          name: 'Winter Camping Bin',
          nodeType: LocationNodeTypes.MovableContainer,
          shortCode: 'BIN-001',
          icon: 'inventory_2',
          containerStyle: '27-Gal Heavy Duty Tote',
          primaryColor: '#1f2937',
          accentColor: '#eab308',
          colorLabel: 'Black Base / Yellow Lid',
          isPrivate: false,
          ownerId: 'u-1',
          fullPath: 'Garage > Winter Camping Bin',
          children: [],
        },
      ],
    },
  ];

  let mockLocationService: {
    getTree: ReturnType<typeof vi.fn>;
    getLocations: ReturnType<typeof vi.fn>;
    createLocation: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
    moveLocation: ReturnType<typeof vi.fn>;
    deleteLocation: ReturnType<typeof vi.fn>;
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
    mockLocationService = {
      getTree: vi.fn().mockReturnValue(of(mockTree)),
      getLocations: vi.fn().mockReturnValue(of(mockNodes)),
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      moveLocation: vi.fn(),
      deleteLocation: vi.fn().mockReturnValue(of(undefined)),
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
        { provide: LocationService, useValue: mockLocationService },
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

  it('should create the component and load tree and locations', () => {
    expect(component).toBeTruthy();
    expect(mockLocationService.getTree).toHaveBeenCalled();
    expect(mockLocationService.getLocations).toHaveBeenCalled();
    expect(component['allNodes']().length).toBe(2);
    expect(component['treeNodes']().length).toBe(1);
  });

  it('should display root nodes when no parent is selected', () => {
    expect(component['selectedNodeId']()).toBeNull();
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Garage');
  });

  it('should filter nodes based on search query across all depths', () => {
    component['searchQuery'].set('Yellow Lid');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Winter Camping Bin');

    component['searchQuery'].set('nonexistent');
    expect(component['displayedNodes']().length).toBe(0);
  });

  it('should filter nodes by node type', () => {
    component['searchQuery'].set('a'); // Matches both Garage and Winter Camping Bin
    component.setFilterType('fixed');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Garage');

    component.setFilterType('container');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Winter Camping Bin');
  });

  it('should navigate hierarchy when a node is selected', () => {
    component.selectNode('loc-1');
    expect(component['selectedNodeId']()).toBe('loc-1');
    expect(component['selectedNode']()?.name).toBe('Garage');
    expect(component['displayedNodes']().length).toBe(1);
    expect(component['displayedNodes']()[0].name).toBe('Winter Camping Bin');
  });

  it('should delete location when confirmed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.deleteNode(mockNodes[0]);

    expect(mockLocationService.deleteLocation).toHaveBeenCalledWith('loc-1');
    expect(mockSnackBar.open).toHaveBeenCalled();
  });
});
