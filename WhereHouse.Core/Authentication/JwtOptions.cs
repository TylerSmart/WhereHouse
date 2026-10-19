namespace WhereHouse.Core.Authentication;

public sealed class JwtOptions
{
    public const string SectionName = "Authentication:Jwt";

    public string Secret { get; set; } = string.Empty;

    public string Issuer { get; set; } = "WhereHouse";

    public string Audience { get; set; } = "WhereHouse";

    public int ExpirationMinutes { get; set; } = 1440;
}
