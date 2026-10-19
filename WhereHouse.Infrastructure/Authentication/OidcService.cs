using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using WhereHouse.Core.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace WhereHouse.Infrastructure.Authentication;

public sealed class OidcService(
    IOptions<OidcOptions> options,
    HttpClient httpClient,
    ILogger<OidcService> logger
) : IOidcService
{
    private readonly OidcOptions _options = options.Value;
    private readonly JwtSecurityTokenHandler _tokenHandler = new();

    public OidcConfigurationDto GetConfiguration()
    {
        var authEndpoint = _options.AuthorizationEndpoint;
        if (
            string.IsNullOrWhiteSpace(authEndpoint)
            && !string.IsNullOrWhiteSpace(_options.Authority)
        )
        {
            authEndpoint = $"{_options.Authority.TrimEnd('/')}/authorize";
        }

        return new OidcConfigurationDto(
            Enabled: _options.Enabled,
            ProviderName: _options.ProviderName,
            Authority: _options.Authority,
            ClientId: _options.ClientId,
            Scope: _options.Scope,
            AuthorizationEndpoint: authEndpoint
        );
    }

    public async Task<ExternalUserPrincipal?> ValidateIdTokenAsync(
        string idToken,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(idToken) || !_options.Enabled)
        {
            return null;
        }

        try
        {
            if (_tokenHandler.CanReadToken(idToken))
            {
                var jwt = _tokenHandler.ReadJwtToken(idToken);

                var sub = jwt
                    .Claims.FirstOrDefault(c =>
                        c.Type == JwtRegisteredClaimNames.Sub || c.Type == ClaimTypes.NameIdentifier
                    )
                    ?.Value;
                var email = jwt
                    .Claims.FirstOrDefault(c =>
                        c.Type == JwtRegisteredClaimNames.Email || c.Type == ClaimTypes.Email
                    )
                    ?.Value;
                var name = jwt
                    .Claims.FirstOrDefault(c =>
                        c.Type == "name"
                        || c.Type == ClaimTypes.Name
                        || c.Type == "preferred_username"
                    )
                    ?.Value;

                if (!string.IsNullOrWhiteSpace(sub) && !string.IsNullOrWhiteSpace(email))
                {
                    return new ExternalUserPrincipal(sub, email, name, _options.ProviderName);
                }
            }

            // Fallback for OAuth2 access tokens (e.g. Google ya29... tokens) or when claims are fetched via UserInfo endpoint
            var userInfoEndpoint = _options.UserInfoEndpoint;
            if (
                string.IsNullOrWhiteSpace(userInfoEndpoint)
                && !string.IsNullOrWhiteSpace(_options.Authority)
            )
            {
                userInfoEndpoint = $"{_options.Authority.TrimEnd('/')}/userinfo";
            }

            if (!string.IsNullOrWhiteSpace(userInfoEndpoint))
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, userInfoEndpoint);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", idToken);

                var response = await httpClient.SendAsync(request, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var userInfo = await response.Content.ReadFromJsonAsync<JsonElement>(
                        cancellationToken: cancellationToken
                    );

                    var sub = userInfo.TryGetProperty("sub", out var subProp)
                        ? subProp.GetString()
                        : null;
                    var email = userInfo.TryGetProperty("email", out var emailProp)
                        ? emailProp.GetString()
                        : null;
                    var name = userInfo.TryGetProperty("name", out var nameProp)
                        ? nameProp.GetString()
                        : null;

                    if (!string.IsNullOrWhiteSpace(sub) && !string.IsNullOrWhiteSpace(email))
                    {
                        return new ExternalUserPrincipal(sub, email, name, _options.ProviderName);
                    }
                }
                else
                {
                    logger.LogWarning(
                        "OIDC UserInfo endpoint returned {StatusCode} when validating token.",
                        response.StatusCode
                    );
                }
            }

            logger.LogWarning(
                "Provided token could not be validated via JWT or UserInfo endpoint."
            );
            return null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to validate external ID or access token.");
            return null;
        }
    }

    public async Task<ExternalUserPrincipal?> ExchangeCodeAsync(
        string code,
        string redirectUri,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(code) || !_options.Enabled)
        {
            return null;
        }

        var tokenEndpoint = _options.TokenEndpoint;
        if (
            string.IsNullOrWhiteSpace(tokenEndpoint)
            && !string.IsNullOrWhiteSpace(_options.Authority)
        )
        {
            tokenEndpoint = $"{_options.Authority.TrimEnd('/')}/token";
        }

        if (string.IsNullOrWhiteSpace(tokenEndpoint))
        {
            logger.LogWarning("No token endpoint configured for OIDC code exchange.");
            return null;
        }

        try
        {
            var parameters = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["redirect_uri"] = redirectUri,
                ["client_id"] = _options.ClientId,
            };

            if (!string.IsNullOrWhiteSpace(_options.ClientSecret))
            {
                parameters["client_secret"] = _options.ClientSecret;
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
            {
                Content = new FormUrlEncodedContent(parameters),
            };

            var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "OIDC token exchange failed: {StatusCode} {Error}",
                    response.StatusCode,
                    error
                );
                return null;
            }

            var tokenResponse = await response.Content.ReadFromJsonAsync<JsonElement>(
                cancellationToken: cancellationToken
            );
            if (tokenResponse.TryGetProperty("id_token", out var idTokenProp))
            {
                var idToken = idTokenProp.GetString();
                if (!string.IsNullOrWhiteSpace(idToken))
                {
                    return await ValidateIdTokenAsync(idToken, cancellationToken);
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception during OIDC code exchange.");
            return null;
        }
    }
}
