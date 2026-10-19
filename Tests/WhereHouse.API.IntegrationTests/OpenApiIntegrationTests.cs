using System.Net;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WhereHouse.API.IntegrationTests;

[TestClass]
public sealed class OpenApiIntegrationTests
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
    public async Task GetOpenApiDocument_ReturnsValidJson()
    {
        var response = await _client.GetAsync("/api/openapi/v1.json");

        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.IsFalse(string.IsNullOrWhiteSpace(content));
        StringAssert.Contains(content, "WhereHouse");
        StringAssert.Contains(content, "/locations");
        StringAssert.Contains(content, "/categories");
        StringAssert.Contains(content, "/items");
        StringAssert.Contains(content, "/attachments");
        StringAssert.Contains(content, "/search");
        StringAssert.Contains(content, "/qrcodes");
        StringAssert.Contains(content, "/scan");
        StringAssert.Contains(content, "/intake");
        StringAssert.Contains(content, "/portability");
        StringAssert.Contains(content, "/auth");
        StringAssert.Contains(content, "securitySchemes");
        StringAssert.Contains(content, "Bearer");
    }
}
