using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Storage;
using WhereHouse.Infrastructure.Authentication;
using WhereHouse.Infrastructure.Storage;

namespace WhereHouse.Infrastructure;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        services.Configure<OidcOptions>(configuration.GetSection(OidcOptions.SectionName));
        services.AddHttpClient<IOidcService, OidcService>();

        services.Configure<FileStorageOptions>(
            configuration.GetSection(FileStorageOptions.SectionName)
        );
        services.AddSingleton<IFileStorageService, LocalDiskFileStorageService>();

        return services;
    }
}
