using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using WhereHouse.Core.Authentication;
using WhereHouse.Core.Interfaces;

namespace WhereHouse.API.Authentication;

public static class AuthenticationServiceCollectionExtensions
{
    public const string LocalJwtScheme = JwtBearerDefaults.AuthenticationScheme;

    public static IServiceCollection AddWhereHouseAuthentication(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddHttpContextAccessor();
        services.AddScoped<IUserContext, HttpContextUserContext>();
        services.AddMemoryCache();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        services
            .AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = LocalJwtScheme;
                options.DefaultChallengeScheme = LocalJwtScheme;
            })
            .AddScheme<AuthenticationSchemeOptions, DualBearerAuthenticationHandler>(
                LocalJwtScheme,
                _ => { }
            );

        services.AddAuthorization();

        return services;
    }
}
