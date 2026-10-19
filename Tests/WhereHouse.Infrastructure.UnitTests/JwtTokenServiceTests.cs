using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;
using WhereHouse.Infrastructure.Authentication;

namespace WhereHouse.Infrastructure.UnitTests;

[TestClass]
public sealed class JwtTokenServiceTests
{
    private readonly JwtOptions _options = new()
    {
        Secret = "SuperSecretTestingKeyThatIsLongEnough1234567890!",
        Issuer = "WhereHouseTests",
        Audience = "WhereHouseTests",
        ExpirationMinutes = 60,
    };

    [TestMethod]
    public void GenerateToken_ProducesValidJwt()
    {
        var service = new JwtTokenService(Options.Create(_options));
        var user = new UserSummary(Guid.NewGuid(), "test@example.com", "testuser");

        var token = service.GenerateToken(user);

        Assert.IsFalse(string.IsNullOrWhiteSpace(token));

        var principal = service.ValidateToken(token);
        Assert.IsNotNull(principal);
        Assert.AreEqual(user.Id.ToString(), principal.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        Assert.AreEqual(user.Email, principal.FindFirst(ClaimTypes.Email)?.Value);
        Assert.AreEqual(user.Username, principal.FindFirst(ClaimTypes.Name)?.Value);
    }

    [TestMethod]
    public void ValidateToken_WithTamperedToken_ReturnsNull()
    {
        var service = new JwtTokenService(Options.Create(_options));
        var user = new UserSummary(Guid.NewGuid(), "test@example.com", "testuser");

        var token = service.GenerateToken(user);
        var tamperedToken = token + "xyz";

        var principal = service.ValidateToken(tamperedToken);
        Assert.IsNull(principal);
    }
}
