using Microsoft.EntityFrameworkCore;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data;

public sealed class WhereHouseDbContext(DbContextOptions<WhereHouseDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<LocationNode> LocationNodes => Set<LocationNode>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<CategoryAttributeTemplate> CategoryAttributeTemplates =>
        Set<CategoryAttributeTemplate>();

    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();

    public DbSet<ItemAttributeValue> ItemAttributeValues => Set<ItemAttributeValue>();

    public DbSet<ItemAttachment> ItemAttachments => Set<ItemAttachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WhereHouseDbContext).Assembly);
    }
}
