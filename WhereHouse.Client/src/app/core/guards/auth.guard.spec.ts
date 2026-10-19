import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { authGuard, guestGuard } from './auth.guard';

describe('AuthGuards', () => {
  let mockAuthService: { token: ReturnType<typeof vi.fn> };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };

  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    mockAuthService = {
      token: vi.fn(),
    };
    mockRouter = {
      createUrlTree: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  describe('authGuard', () => {
    it('should allow navigation when token exists', () => {
      mockAuthService.token.mockReturnValue('valid-token');

      const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));

      expect(result).toBe(true);
    });

    it('should redirect to login when token is absent', () => {
      mockAuthService.token.mockReturnValue(null);
      const fakeUrlTree = {} as UrlTree;
      mockRouter.createUrlTree.mockReturnValue(fakeUrlTree);

      const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));

      expect(result).toBe(fakeUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
        queryParams: { returnUrl: '/dashboard' },
      });
    });
  });

  describe('guestGuard', () => {
    it('should allow navigation when unauthenticated', () => {
      mockAuthService.token.mockReturnValue(null);

      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));

      expect(result).toBe(true);
    });

    it('should redirect to dashboard when authenticated', () => {
      mockAuthService.token.mockReturnValue('valid-token');
      const fakeUrlTree = {} as UrlTree;
      mockRouter.createUrlTree.mockReturnValue(fakeUrlTree);

      const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));

      expect(result).toBe(fakeUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
