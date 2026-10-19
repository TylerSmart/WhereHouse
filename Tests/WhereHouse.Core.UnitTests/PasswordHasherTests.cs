using Microsoft.VisualStudio.TestTools.UnitTesting;
using WhereHouse.Core.Authentication;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [TestMethod]
    public void HashPassword_ProducesNonEmptyHash()
    {
        var password = "SecurePassword123!";
        var hash = _hasher.HashPassword(password);

        Assert.IsFalse(string.IsNullOrWhiteSpace(hash));
        StringAssert.Contains(hash, ".");
    }

    [TestMethod]
    public void VerifyPassword_WithCorrectPassword_ReturnsTrue()
    {
        var password = "MySecretPassword_456";
        var hash = _hasher.HashPassword(password);

        var result = _hasher.VerifyPassword(password, hash);

        Assert.IsTrue(result);
    }

    [TestMethod]
    public void VerifyPassword_WithWrongPassword_ReturnsFalse()
    {
        var hash = _hasher.HashPassword("CorrectPassword");

        var result = _hasher.VerifyPassword("WrongPassword", hash);

        Assert.IsFalse(result);
    }

    [TestMethod]
    public void VerifyPassword_WithInvalidHash_ReturnsFalse()
    {
        var result = _hasher.VerifyPassword("password", "invalid.hash");

        Assert.IsFalse(result);
    }
}
