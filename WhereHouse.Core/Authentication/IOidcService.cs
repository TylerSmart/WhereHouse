namespace WhereHouse.Core.Authentication;

public sealed record ExternalUserPrincipal(
    string SubjectId,
    string Email,
    string? Name,
    string Provider
);

public sealed record OidcConfigurationDto(
    bool Enabled,
    string ProviderName,
    string? Authority,
    string? ClientId,
    string? Scope,
    string? AuthorizationEndpoint
);

public sealed record AuthProviderDto(
    string Id,
    string Name,
    bool IsExternal,
    OidcConfigurationDto? OidcConfig = null
);

public interface IOidcService
{
    OidcConfigurationDto GetConfiguration();

    Task<ExternalUserPrincipal?> ValidateIdTokenAsync(
        string idToken,
        CancellationToken cancellationToken = default
    );

    Task<ExternalUserPrincipal?> ExchangeCodeAsync(
        string code,
        string redirectUri,
        CancellationToken cancellationToken = default
    );
}
