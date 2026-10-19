using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace WhereHouse.API.IntegrationTests;

public class WhereHouseWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = "TestDb_" + Guid.NewGuid();
    private readonly string _storageRoot = Path.Combine(
        Path.GetTempPath(),
        "WhereHouse_IntegrationTests_" + Guid.NewGuid().ToString("N")
    );

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(_storageRoot);

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
        builder.UseSetting("FileStorage:RootPath", _storageRoot);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(_storageRoot))
        {
            try
            {
                Directory.Delete(_storageRoot, true);
            }
            catch
            {
                // Ignore cleanup errors in temporary test directories
            }
        }
    }
}
