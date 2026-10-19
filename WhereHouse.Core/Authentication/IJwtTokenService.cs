using System.Security.Claims;

namespace WhereHouse.Core.Authentication;

public interface IJwtTokenService
{
    string GenerateToken(UserSummary user);

    ClaimsPrincipal? ValidateToken(string token);
}
