using WhereHouse.Domain.Entities;
using WhereHouse.Infrastructure.Data;
using WhereHouse.Infrastructure.Services;

public static class WhereHouseDbInitializer
{
    public static void Initialize(WhereHouseDbContext context)
    {
        // Ensure the database is created
        context.Database.EnsureCreated();

        // Check if the admin already exists
        if (!context.Users.Any(u => u.Username == "admin"))
        {
            var passwordService = new PasswordService();
            var admin = new User
            {
                Username = "admin",
                IsAdmin = true,
                CreatedAt = DateTime.UtcNow,
                PasswordHash = passwordService.HashPassword("password")
            };

            context.Users.Add(admin);
            context.SaveChanges();
        }
    }
}