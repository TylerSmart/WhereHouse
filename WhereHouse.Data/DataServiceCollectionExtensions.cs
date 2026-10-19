using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Intake;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Portability;
using WhereHouse.Core.QrCodes;
using WhereHouse.Core.Search;
using WhereHouse.Data.Auditing;
using WhereHouse.Data.Services;

namespace WhereHouse.Data;

public static class DataServiceCollectionExtensions
{
    public static IServiceCollection AddDataServices(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddScoped<AuditSaveChangesInterceptor>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ILocationService, LocationService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IItemService, ItemService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        services.AddScoped<ISearchService, SearchService>();
        services.AddScoped<IQrCodeService, QrCodeService>();
        services.AddScoped<IScanService, ScanService>();
        services.AddScoped<IBarcodeLookupService, BarcodeLookupService>();
        services.AddScoped<IRapidIntakeService, RapidIntakeService>();
        services.AddScoped<IDataPortabilityService, DataPortabilityService>();

        if (
            string.Equals(
                configuration["UseInMemoryDatabase"],
                "true",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            var inMemoryDbName = configuration["InMemoryDatabaseName"] ?? "WhereHouse_Testing";
            services.AddDbContext<WhereHouseDbContext>(
                (provider, options) =>
                {
                    options.UseInMemoryDatabase(inMemoryDbName);
                    options.AddInterceptors(
                        provider.GetRequiredService<AuditSaveChangesInterceptor>()
                    );
                }
            );

            return services;
        }

        var whereHouseConnectionString =
            configuration.GetConnectionString("WhereHouse")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? configuration["ConnectionString:WhereHouse"];

        if (
            string.IsNullOrWhiteSpace(whereHouseConnectionString)
            || string.Equals(
                whereHouseConnectionString,
                "REPLACE_ME",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            whereHouseConnectionString =
                "Server=localhost,14333;Database=WhereHouse;User Id=sa;Password=WhereHouse_Local_Dev_1;TrustServerCertificate=True;Encrypt=True;Application Name=WhereHouse;";
        }

        services.AddDbContext<WhereHouseDbContext>(
            (provider, options) =>
            {
                options.UseSqlServer(whereHouseConnectionString, sql => sql.EnableRetryOnFailure());
                options.AddInterceptors(provider.GetRequiredService<AuditSaveChangesInterceptor>());
            }
        );

        return services;
    }
}
