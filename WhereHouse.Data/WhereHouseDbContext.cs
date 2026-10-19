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

    public DbSet<QrCode> QrCodes => Set<QrCode>();

    public DbSet<CheckoutLog> CheckoutLogs => Set<CheckoutLog>();

    public DbSet<Loadout> Loadouts => Set<Loadout>();

    public DbSet<LoadoutItem> LoadoutItems => Set<LoadoutItem>();

    public DbSet<MaintenanceSchedule> MaintenanceSchedules => Set<MaintenanceSchedule>();

    public DbSet<MaintenanceLog> MaintenanceLogs => Set<MaintenanceLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WhereHouseDbContext).Assembly);
    }
}
