using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace WhereHouse.API.IntegrationTests;

public class WhereHouseWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = "TestDb_" + Guid.NewGuid();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("UseInMemoryDatabase", "true");
        builder.UseSetting("InMemoryDatabaseName", _databaseName);
        builder.UseSetting(
            "Authentication:Jwt:Secret",
            "Test_Secret_Key_For_WhereHouse_Integration_Tests_12345!"
        );
        builder.UseSetting("Authentication:Jwt:Issuer", "WhereHouse");
        builder.UseSetting("Authentication:Jwt:Audience", "WhereHouse");
        builder.UseSetting("Authentication:Oidc:Enabled", "true");
        builder.UseSetting("Authentication:Oidc:ProviderName", "TestOIDC");
    }
}
