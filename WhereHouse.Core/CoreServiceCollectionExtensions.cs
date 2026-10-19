using Microsoft.Extensions.DependencyInjection;
using WhereHouse.Core.Authentication;

namespace WhereHouse.Core;

public static class CoreServiceCollectionExtensions
{
    public static IServiceCollection AddCoreServices(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        return services;
    }
}
