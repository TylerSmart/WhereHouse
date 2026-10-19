using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace WhereHouse.Data;

public sealed class WhereHouseDbContextFactory : IDesignTimeDbContextFactory<WhereHouseDbContext>
{
    public WhereHouseDbContext CreateDbContext(string[] args)
    {
        var startupPath = ResolveStartupPath();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(startupPath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddJsonFile("appsettings.Local.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString =
            configuration.GetConnectionString("WhereHouse")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? configuration["ConnectionString:WhereHouse"];

        if (
            string.IsNullOrWhiteSpace(connectionString)
            || string.Equals(connectionString, "REPLACE_ME", StringComparison.OrdinalIgnoreCase)
        )
        {
            connectionString =
                "Server=localhost,14333;Database=WhereHouse;User Id=sa;Password=WhereHouse_Local_Dev_1;TrustServerCertificate=True;Encrypt=True;Application Name=WhereHouse;";
        }

        var options = new DbContextOptionsBuilder<WhereHouseDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new WhereHouseDbContext(options);
    }

    private static string ResolveStartupPath()
    {
        var current = Directory.GetCurrentDirectory();
        if (File.Exists(Path.Combine(current, "appsettings.json")))
            return current;

        var apiPath = Path.GetFullPath(Path.Combine(current, "..", "WhereHouse.API"));
        if (File.Exists(Path.Combine(apiPath, "appsettings.json")))
            return apiPath;

        throw new InvalidOperationException(
            "Could not find WhereHouse.API appsettings.json. Run EF Core commands with --startup-project WhereHouse.API."
        );
    }
}
