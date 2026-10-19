import { Service, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, of, tap } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  AuthProviderDto,
  AuthResponse,
  CurrentUserDto,
  ExternalAuthRequest,
  LoginRequest,
  RegisterRequest,
} from '../../models/auth.models';

const TOKEN_KEY = 'where-house-token';

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenState = signal<string | null>(this.readStoredToken());
  private readonly currentUserState = signal<CurrentUserDto | null>(null);
  private readonly isInitializedState = signal<boolean>(false);
  private readonly isLoadingState = signal<boolean>(false);

  readonly token = this.tokenState.asReadonly();
  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserState());
  readonly isInitialized = this.isInitializedState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();

  async initAuth(): Promise<void> {
    const savedToken = this.tokenState();
    if (!savedToken) {
      this.isInitializedState.set(true);
      return;
    }

    try {
      const user = await firstValueFrom(this.loadCurrentUser());
      if (user) {
        this.currentUserState.set(user);
      } else {
        this.clearSession();
      }
    } catch {
      this.clearSession();
    } finally {
      this.isInitializedState.set(true);
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.isLoadingState.set(true);
    return this.http.post<AuthResponse>(apiUrl('/auth/login'), credentials).pipe(
      tap((response) => {
        this.setSession(response);
        this.isLoadingState.set(false);
      }),
      catchError((error) => {
        this.isLoadingState.set(false);
        throw error;
      }),
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    this.isLoadingState.set(true);
    return this.http.post<AuthResponse>(apiUrl('/auth/register'), data).pipe(
      tap((response) => {
        this.setSession(response);
        this.isLoadingState.set(false);
      }),
      catchError((error) => {
        this.isLoadingState.set(false);
        throw error;
      }),
    );
  }

  externalCallback(request: ExternalAuthRequest): Observable<AuthResponse> {
    this.isLoadingState.set(true);
    return this.http.post<AuthResponse>(apiUrl('/auth/external-callback'), request).pipe(
      tap((response) => {
        this.setSession(response);
        this.isLoadingState.set(false);
      }),
      catchError((error) => {
        this.isLoadingState.set(false);
        throw error;
      }),
    );
  }

  loadCurrentUser(): Observable<CurrentUserDto | null> {
    return this.http.get<CurrentUserDto>(apiUrl('/auth/me')).pipe(
      tap((user) => {
        this.currentUserState.set(user);
      }),
      catchError(() => {
        return of(null);
      }),
    );
  }

  getProviders(): Observable<AuthProviderDto[]> {
    return this.http
      .get<AuthProviderDto[]>(apiUrl('/auth/providers'))
      .pipe(catchError(() => of([])));
  }

  logout(): void {
    const currentToken = this.tokenState();
    this.clearSession();

    if (currentToken) {
      this.http.post(apiUrl('/auth/logout'), {}).subscribe({
        error: () => undefined,
      });
    }

    this.router.navigate(['/login']);
  }

  setSession(auth: AuthResponse): void {
    this.tokenState.set(auth.token);
    this.currentUserState.set({
      id: auth.id,
      email: auth.email,
      username: auth.username,
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, auth.token);
    }
  }

  clearSession(): void {
    this.tokenState.set(null);
    this.currentUserState.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private readStoredToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  }
}
