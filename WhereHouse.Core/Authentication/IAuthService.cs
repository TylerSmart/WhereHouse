namespace WhereHouse.Core.Authentication;

public interface IAuthService
{
    IReadOnlyList<AuthProviderDto> GetAuthProviders();

    Task<AuthResponse> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default
    );

    Task<AuthResponse?> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default
    );

    Task<CurrentUserDto?> GetCurrentUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<AuthResponse?> ExternalCallbackAsync(
        ExternalAuthRequest request,
        CancellationToken cancellationToken = default
    );

    Task<UserSummary> ProvisionOrGetExternalUserAsync(
        ExternalUserPrincipal principal,
        CancellationToken cancellationToken = default
    );
}
