using WhereHouse.Infrastructure.Data;
using WhereHouse.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace WhereHouse.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<WhereHouseDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                b => b.MigrationsAssembly(typeof(WhereHouseDbContext).Assembly.FullName)));

        services.AddScoped<IQrCodeService, QrCodeService>();
        services.AddScoped<IPasswordService, PasswordService>();

        return services;
    }
}
