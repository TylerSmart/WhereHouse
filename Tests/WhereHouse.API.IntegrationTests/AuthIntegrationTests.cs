using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WhereHouse.API.Dtos;
using WhereHouse.Core.Authentication;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class AuthIntegrationTests
{
    private WhereHouseWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [TestInitialize]
    public void Setup()
    {
        _factory = new WhereHouseWebApplicationFactory();
        _client = _factory.CreateClient();
    }

    [TestCleanup]
    public void Cleanup()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [TestMethod]
    public async Task Register_WithValidData_ReturnsOkAndToken()
    {
        var request = new RegisterRequest("alice@example.com", "alice", "Password123!");

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(authResponse);
        Assert.IsFalse(string.IsNullOrWhiteSpace(authResponse.Token));
        Assert.AreEqual(request.Email, authResponse.Email);
        Assert.AreEqual(request.Username, authResponse.Username);
    }

    [TestMethod]
    public async Task Register_WithDuplicateEmail_ReturnsConflict()
    {
        var request1 = new RegisterRequest("dup@example.com", "user1", "Password123!");
        var request2 = new RegisterRequest("dup@example.com", "user2", "Password123!");

        var first = await _client.PostAsJsonAsync("/api/auth/register", request1);
        Assert.AreEqual(HttpStatusCode.OK, first.StatusCode);

        var second = await _client.PostAsJsonAsync("/api/auth/register", request2);
        Assert.AreEqual(HttpStatusCode.Conflict, second.StatusCode);
    }

    [TestMethod]
    public async Task Login_WithValidCredentials_ReturnsOkAndToken()
    {
        var register = new RegisterRequest("login@example.com", "loginuser", "Password123!");
        await _client.PostAsJsonAsync("/api/auth/register", register);

        var login = new LoginRequest("login@example.com", "Password123!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", login);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(authResponse);
        Assert.IsFalse(string.IsNullOrWhiteSpace(authResponse.Token));
    }

    [TestMethod]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        var register = new RegisterRequest("badpass@example.com", "badpassuser", "Password123!");
        await _client.PostAsJsonAsync("/api/auth/register", register);

        var login = new LoginRequest("badpass@example.com", "WrongPassword!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", login);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task GetCurrentUser_WhenAuthenticated_ReturnsUserInfo()
    {
        var register = new RegisterRequest("me@example.com", "meuser", "Password123!");
        var regResponse = await _client.PostAsJsonAsync("/api/auth/register", register);
        var auth = await regResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth.Token
        );

        var meResponse = await _client.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.OK, meResponse.StatusCode);

        var user = await meResponse.Content.ReadFromJsonAsync<CurrentUserDto>();
        Assert.IsNotNull(user);
        Assert.AreEqual("me@example.com", user.Email);
        Assert.AreEqual("meuser", user.Username);
    }

    [TestMethod]
    public async Task GetCurrentUser_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task GetAuthProviders_ReturnsConfiguredProviders()
    {
        var response = await _client.GetAsync("/api/auth/providers");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var providers = await response.Content.ReadFromJsonAsync<
            List<WhereHouse.Core.Authentication.AuthProviderDto>
        >();
        Assert.IsNotNull(providers);
        Assert.IsTrue(providers.Any(p => p.Id == "local"));
        Assert.IsTrue(providers.Any(p => p.Id == "oidc"));
    }

    [TestMethod]
    public async Task ExternalCallback_WithValidIdToken_ProvisionsNewUser()
    {
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var idToken = tokenHandler.WriteToken(
            new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                claims:
                [
                    new System.Security.Claims.Claim("sub", "oidc-sub-999"),
                    new System.Security.Claims.Claim("email", "oidcuser@example.com"),
                    new System.Security.Claims.Claim("name", "OidcUser"),
                ]
            )
        );

        var request = new ExternalAuthRequest(Code: null, IdToken: idToken, RedirectUri: null);
        var response = await _client.PostAsJsonAsync("/api/auth/external-callback", request);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);
        Assert.IsFalse(string.IsNullOrWhiteSpace(auth.Token));
        Assert.AreEqual("oidcuser@example.com", auth.Email);

        // Verify that the user can query /api/auth/me using the returned token
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth.Token
        );
        var meResponse = await _client.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.OK, meResponse.StatusCode);
    }

    [TestMethod]
    public async Task ExternalCallback_WithExistingLocalEmail_LinksAccount()
    {
        // First, register a local user
        var localReg = new RegisterRequest("linkme@example.com", "localuser", "Password123!");
        var localRegResponse = await _client.PostAsJsonAsync("/api/auth/register", localReg);
        Assert.AreEqual(HttpStatusCode.OK, localRegResponse.StatusCode);

        // Now perform external callback with same email
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var idToken = tokenHandler.WriteToken(
            new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                claims:
                [
                    new System.Security.Claims.Claim("sub", "ext-linked-sub"),
                    new System.Security.Claims.Claim("email", "linkme@example.com"),
                    new System.Security.Claims.Claim("name", "DifferentName"),
                ]
            )
        );

        var request = new ExternalAuthRequest(Code: null, IdToken: idToken, RedirectUri: null);
        var response = await _client.PostAsJsonAsync("/api/auth/external-callback", request);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);
        Assert.AreEqual("linkme@example.com", auth.Email);
        Assert.AreEqual("localuser", auth.Username);
    }

    [TestMethod]
    public async Task Register_WithDuplicateUsername_ReturnsConflict()
    {
        var request1 = new RegisterRequest("userA@example.com", "samename", "Password123!");
        var request2 = new RegisterRequest("userB@example.com", "samename", "Password123!");

        var first = await _client.PostAsJsonAsync("/api/auth/register", request1);
        Assert.AreEqual(HttpStatusCode.OK, first.StatusCode);

        var second = await _client.PostAsJsonAsync("/api/auth/register", request2);
        Assert.AreEqual(HttpStatusCode.Conflict, second.StatusCode);
    }

    [TestMethod]
    public async Task Register_WithInvalidEmail_ReturnsBadRequest()
    {
        var request = new RegisterRequest("not-an-email", "validuser", "Password123!");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [TestMethod]
    public async Task Login_WithNonExistentEmail_ReturnsUnauthorized()
    {
        var login = new LoginRequest("nosuchuser@example.com", "Password123!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", login);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task ExternalCallback_WithInvalidToken_ReturnsUnauthorized()
    {
        var request = new ExternalAuthRequest(
            Code: null,
            IdToken: "invalid-token",
            RedirectUri: null
        );
        var response = await _client.PostAsJsonAsync("/api/auth/external-callback", request);

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [TestMethod]
    public async Task ExternalCallback_WithUsernameCollision_AssignsUniqueUsername()
    {
        // First user
        var localReg = new RegisterRequest("user1@example.com", "clashname", "Password123!");
        await _client.PostAsJsonAsync("/api/auth/register", localReg);

        // External user with same base name
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var idToken = tokenHandler.WriteToken(
            new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                claims:
                [
                    new System.Security.Claims.Claim("sub", "ext-clash-1"),
                    new System.Security.Claims.Claim("email", "ext1@example.com"),
                    new System.Security.Claims.Claim("name", "clashname"),
                ]
            )
        );

        var request = new ExternalAuthRequest(Code: null, IdToken: idToken, RedirectUri: null);
        var response = await _client.PostAsJsonAsync("/api/auth/external-callback", request);

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);
        Assert.AreNotEqual("clashname", auth.Username);
        StringAssert.StartsWith(auth.Username, "clashname");
    }

    [TestMethod]
    public async Task Login_ReturnsValidToken_AndCanAuthenticateWithBearerHeader()
    {
        var registerRequest = new RegisterRequest(
            "beareruser@example.com",
            "beareruser",
            "Password123!"
        );
        var regResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest);
        Assert.AreEqual(HttpStatusCode.OK, regResponse.StatusCode);

        var auth = await regResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.IsNotNull(auth);
        Assert.IsFalse(string.IsNullOrWhiteSpace(auth.Token));

        // Create a new client with NO Authorization header -> 401 Unauthorized
        using var unauthClient = _factory.CreateClient();
        var unauthResponse = await unauthClient.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.Unauthorized, unauthResponse.StatusCode);

        // Client with standard Bearer header -> 200 OK
        using var bearerClient = _factory.CreateClient();
        bearerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth.Token
        );
        var meResponse = await bearerClient.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.OK, meResponse.StatusCode);

        var user = await meResponse.Content.ReadFromJsonAsync<CurrentUserDto>();
        Assert.IsNotNull(user);
        Assert.AreEqual("beareruser@example.com", user.Email);
    }

    [TestMethod]
    public async Task Logout_ReturnsOk()
    {
        var response = await _client.PostAsync("/api/auth/logout", null);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [TestMethod]
    public async Task ExternalToken_DirectlyInBearerHeader_AuthenticatesSuccessfully()
    {
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var externalIdToken = tokenHandler.WriteToken(
            new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                claims:
                [
                    new System.Security.Claims.Claim("sub", "ext-direct-bearer-user"),
                    new System.Security.Claims.Claim("email", "directbearer@example.com"),
                    new System.Security.Claims.Claim("name", "Direct Bearer User"),
                ]
            )
        );

        using var bearerClient = _factory.CreateClient();
        bearerClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            externalIdToken
        );

        var meResponse = await bearerClient.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.OK, meResponse.StatusCode);

        var user = await meResponse.Content.ReadFromJsonAsync<CurrentUserDto>();
        Assert.IsNotNull(user);
        Assert.AreEqual("directbearer@example.com", user.Email);
        Assert.AreEqual("Direct Bearer User", user.Username);

        // Second call hits cache
        var cachedResponse = await bearerClient.GetAsync("/api/auth/me");
        Assert.AreEqual(HttpStatusCode.OK, cachedResponse.StatusCode);
    }
}
