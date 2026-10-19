import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  AdjustItemQuantityRequest,
  CreateItemRequest,
  ItemDto,
  ItemStatus,
  ItemType,
  UpdateItemRequest,
} from '../../models/item.models';

@Service()
export class ItemService {
  private readonly http = inject(HttpClient);

  getItems(params?: {
    locationId?: string | null;
    includeSubtreeLocations?: boolean;
    categoryId?: string | null;
    itemType?: ItemType | null;
    status?: ItemStatus | null;
    lowStockOnly?: boolean | null;
    search?: string | null;
  }): Observable<ItemDto[]> {
    let httpParams = new HttpParams();

    if (params?.locationId) {
      httpParams = httpParams.set('locationId', params.locationId);
    }
    if (params?.includeSubtreeLocations) {
      httpParams = httpParams.set('includeSubtreeLocations', 'true');
    }
    if (params?.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params?.itemType !== undefined && params.itemType !== null) {
      httpParams = httpParams.set('itemType', params.itemType.toString());
    }
    if (params?.status !== undefined && params.status !== null) {
      httpParams = httpParams.set('status', params.status.toString());
    }
    if (params?.lowStockOnly) {
      httpParams = httpParams.set('lowStockOnly', 'true');
    }
    if (params?.search && params.search.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http.get<ItemDto[]>(apiUrl('/items'), { params: httpParams });
  }

  getItemById(id: string): Observable<ItemDto> {
    return this.http.get<ItemDto>(apiUrl(`/items/${id}`));
  }

  createItem(request: CreateItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl('/items'), request);
  }

  updateItem(id: string, request: UpdateItemRequest): Observable<ItemDto> {
    return this.http.put<ItemDto>(apiUrl(`/items/${id}`), request);
  }

  adjustQuantity(id: string, request: AdjustItemQuantityRequest): Observable<ItemDto> {
    return this.http.patch<ItemDto>(apiUrl(`/items/${id}/quantity`), request);
  }

  duplicateItem(id: string): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/items/${id}/duplicate`), {});
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/items/${id}`));
  }
}
