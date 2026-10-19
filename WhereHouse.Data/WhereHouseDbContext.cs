using Microsoft.EntityFrameworkCore;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data;

public sealed class WhereHouseDbContext(DbContextOptions<WhereHouseDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<TodoItem> TodoItems => Set<TodoItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WhereHouseDbContext).Assembly);
    }
}
