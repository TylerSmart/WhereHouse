namespace WhereHouse.Core.Authentication;

public sealed class OidcOptions
{
    public const string SectionName = "Authentication:Oidc";

    public bool Enabled { get; set; } = false;

    public string ProviderName { get; set; } = "OIDC";

    public string Authority { get; set; } = string.Empty;

    public string ClientId { get; set; } = string.Empty;

    public string? ClientSecret { get; set; }

    public string Scope { get; set; } = "openid profile email";

    public string? AuthorizationEndpoint { get; set; }

    public string? TokenEndpoint { get; set; }

    public string? UserInfoEndpoint { get; set; }
}
