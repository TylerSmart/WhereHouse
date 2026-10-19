import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../api/api-url';
import {
  CreateLocationNodeRequest,
  LocationNodeDto,
  LocationNodeTypes,
  LocationTreeNodeDto,
  MoveLocationNodeRequest,
  UpdateLocationNodeRequest,
} from '../../models/location.models';
import { LocationService } from './location.service';

describe('LocationService', () => {
  let service: LocationService;
  let httpTesting: HttpTestingController;

  const mockNode: LocationNodeDto = {
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
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LocationService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LocationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch location tree', () => {
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
        children: [],
      },
    ];

    service.getTree().subscribe((tree) => {
      expect(tree).toEqual(mockTree);
    });

    const req = httpTesting.expectOne(apiUrl('/locations/tree'));
    expect(req.request.method).toBe('GET');
    req.flush(mockTree);
  });

  it('should fetch location nodes with query params', () => {
    service
      .getLocations({ parentId: 'loc-1', includeAllDepths: true, search: 'Tote' })
      .subscribe((nodes) => {
        expect(nodes).toEqual([mockNode]);
      });

    const req = httpTesting.expectOne(
      (r) =>
        r.url === apiUrl('/locations') &&
        r.params.get('parentId') === 'loc-1' &&
        r.params.get('includeAllDepths') === 'true' &&
        r.params.get('search') === 'Tote',
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockNode]);
  });

  it('should create location node', () => {
    const createReq: CreateLocationNodeRequest = {
      name: 'Garage',
      nodeType: LocationNodeTypes.FixedLocation,
    };

    service.createLocation(createReq).subscribe((created) => {
      expect(created).toEqual(mockNode);
    });

    const req = httpTesting.expectOne(apiUrl('/locations'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createReq);
    req.flush(mockNode);
  });

  it('should update location node', () => {
    const updateReq: UpdateLocationNodeRequest = {
      name: 'Garage Renamed',
      nodeType: LocationNodeTypes.FixedLocation,
    };

    service.updateLocation('loc-1', updateReq).subscribe((updated) => {
      expect(updated.name).toBe('Garage Renamed');
    });

    const req = httpTesting.expectOne(apiUrl('/locations/loc-1'));
    expect(req.request.method).toBe('PUT');
    req.flush({ ...mockNode, name: 'Garage Renamed' });
  });

  it('should move location node', () => {
    const moveReq: MoveLocationNodeRequest = {
      newParentId: 'loc-target',
    };

    service.moveLocation('loc-1', moveReq).subscribe((moved) => {
      expect(moved.parentId).toBe('loc-target');
    });

    const req = httpTesting.expectOne(apiUrl('/locations/loc-1/move'));
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...mockNode, parentId: 'loc-target' });
  });

  it('should delete location node', () => {
    service.deleteLocation('loc-1').subscribe();

    const req = httpTesting.expectOne(apiUrl('/locations/loc-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
