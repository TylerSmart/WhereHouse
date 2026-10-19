import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  BatchCheckoutRequest,
  BatchCheckoutResultDto,
  BatchReturnRequest,
  CheckoutItemRequest,
  CheckoutLoadoutRequest,
  CheckoutLogDto,
  CreateLoadoutRequest,
  LoadoutDto,
  PackBackLoadoutRequest,
  ReturnItemRequest,
  UpdateLoadoutRequest,
} from '../../models/checkout-loadout.models';
import { ItemDto } from '../../models/item.models';

@Service()
export class CheckoutLoadoutService {
  private readonly http = inject(HttpClient);

  readonly cartItems = signal<ItemDto[]>([]);

  addToCart(item: ItemDto): void {
    const current = this.cartItems();
    if (!current.some((i) => i.id === item.id)) {
      this.cartItems.set([...current, item]);
    }
  }

  removeFromCart(itemId: string): void {
    this.cartItems.set(this.cartItems().filter((i) => i.id !== itemId));
  }

  clearCart(): void {
    this.cartItems.set([]);
  }

  isInCart(itemId: string): boolean {
    return this.cartItems().some((i) => i.id === itemId);
  }

  // --- Checkouts API ---

  getActiveCheckouts(externalLoansOnly?: boolean, overdueOnly?: boolean): Observable<ItemDto[]> {
    let params = new HttpParams();
    if (externalLoansOnly !== undefined && externalLoansOnly !== null) {
      params = params.set('externalLoansOnly', externalLoansOnly.toString());
    }
    if (overdueOnly !== undefined && overdueOnly !== null) {
      params = params.set('overdueOnly', overdueOnly.toString());
    }

    return this.http.get<ItemDto[]>(apiUrl('/checkouts/active'), { params });
  }

  getItemCheckoutHistory(itemId: string): Observable<CheckoutLogDto[]> {
    return this.http.get<CheckoutLogDto[]>(apiUrl(`/checkouts/items/${itemId}/history`));
  }

  checkoutItem(itemId: string, request: CheckoutItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/checkouts/items/${itemId}/checkout`), request);
  }

  returnItem(itemId: string, request: ReturnItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(apiUrl(`/checkouts/items/${itemId}/return`), request);
  }

  batchCheckout(request: BatchCheckoutRequest): Observable<BatchCheckoutResultDto> {
    return this.http.post<BatchCheckoutResultDto>(apiUrl('/checkouts/batch-checkout'), request);
  }

  batchReturn(request: BatchReturnRequest): Observable<BatchCheckoutResultDto> {
    return this.http.post<BatchCheckoutResultDto>(apiUrl('/checkouts/batch-return'), request);
  }

  // --- Loadouts API ---

  getLoadouts(): Observable<LoadoutDto[]> {
    return this.http.get<LoadoutDto[]>(apiUrl('/loadouts'));
  }

  getLoadoutById(id: string): Observable<LoadoutDto> {
    return this.http.get<LoadoutDto>(apiUrl(`/loadouts/${id}`));
  }

  createLoadout(request: CreateLoadoutRequest): Observable<LoadoutDto> {
    return this.http.post<LoadoutDto>(apiUrl('/loadouts'), request);
  }

  updateLoadout(id: string, request: UpdateLoadoutRequest): Observable<LoadoutDto> {
    return this.http.put<LoadoutDto>(apiUrl(`/loadouts/${id}`), request);
  }

  deleteLoadout(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/loadouts/${id}`));
  }

  checkoutLoadout(id: string, request: CheckoutLoadoutRequest): Observable<LoadoutDto> {
    return this.http.post<LoadoutDto>(apiUrl(`/loadouts/${id}/checkout`), request);
  }

  packBackLoadout(id: string, request: PackBackLoadoutRequest): Observable<LoadoutDto> {
    return this.http.post<LoadoutDto>(apiUrl(`/loadouts/${id}/pack-back`), request);
  }
}
