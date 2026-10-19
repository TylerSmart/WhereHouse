using System.Security.Claims;
using WhereHouse.Core.Interfaces;

namespace WhereHouse.API.Authentication;

public sealed class HttpContextUserContext(IHttpContextAccessor httpContextAccessor) : IUserContext
{
    public string UserId
    {
        get
        {
            var user = httpContextAccessor.HttpContext?.User;
            var userId =
                user?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user?.FindFirst("sub")?.Value;

            return userId ?? throw new InvalidOperationException("User is not authenticated.");
        }
    }
}
