import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../services/auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    token: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      token: vi.fn(),
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach Bearer token header when token is present', () => {
    mockAuthService.token.mockReturnValue('jwt-token-xyz');

    httpClient.get('/api/boards').subscribe();

    const req = httpMock.expectOne('/api/boards');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token-xyz');
    req.flush([]);
  });

  it('should not attach Authorization header when token is null', () => {
    mockAuthService.token.mockReturnValue(null);

    httpClient.get('/api/boards').subscribe();

    const req = httpMock.expectOne('/api/boards');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('should call logout on 401 response for non-auth endpoints', () => {
    mockAuthService.token.mockReturnValue('expired-token');

    httpClient.get('/api/boards').subscribe({
      error: (err) => {
        expect(err).toBeTruthy();
      },
    });

    const req = httpMock.expectOne('/api/boards');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
