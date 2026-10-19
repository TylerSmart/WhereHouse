import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  CreateLocationNodeRequest,
  LocationNodeDto,
  LocationTreeNodeDto,
  MoveLocationNodeRequest,
  UpdateLocationNodeRequest,
} from '../../models/location.models';

@Service()
export class LocationService {
  private readonly http = inject(HttpClient);

  getTree(): Observable<LocationTreeNodeDto[]> {
    return this.http.get<LocationTreeNodeDto[]>(apiUrl('/locations/tree'));
  }

  getLocations(params?: {
    parentId?: string | null;
    includeAllDepths?: boolean;
    search?: string;
  }): Observable<LocationNodeDto[]> {
    let httpParams = new HttpParams();

    if (params?.parentId !== undefined && params.parentId !== null) {
      httpParams = httpParams.set('parentId', params.parentId);
    }
    if (params?.includeAllDepths) {
      httpParams = httpParams.set('includeAllDepths', 'true');
    }
    if (params?.search && params.search.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http.get<LocationNodeDto[]>(apiUrl('/locations'), { params: httpParams });
  }

  getLocationById(id: string): Observable<LocationNodeDto> {
    return this.http.get<LocationNodeDto>(apiUrl(`/locations/${id}`));
  }

  createLocation(request: CreateLocationNodeRequest): Observable<LocationNodeDto> {
    return this.http.post<LocationNodeDto>(apiUrl('/locations'), request);
  }

  updateLocation(id: string, request: UpdateLocationNodeRequest): Observable<LocationNodeDto> {
    return this.http.put<LocationNodeDto>(apiUrl(`/locations/${id}`), request);
  }

  moveLocation(id: string, request: MoveLocationNodeRequest): Observable<LocationNodeDto> {
    return this.http.patch<LocationNodeDto>(apiUrl(`/locations/${id}/move`), request);
  }

  deleteLocation(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/locations/${id}`));
  }

  uploadCoverPhoto(id: string, file: File): Observable<LocationNodeDto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<LocationNodeDto>(apiUrl(`/locations/${id}/cover-photo`), formData);
  }

  deleteCoverPhoto(id: string): Observable<LocationNodeDto> {
    return this.http.delete<LocationNodeDto>(apiUrl(`/locations/${id}/cover-photo`));
  }

  getCoverPhotoUrl(id: string): string {
    return apiUrl(`/locations/${id}/cover-photo`);
  }
}
