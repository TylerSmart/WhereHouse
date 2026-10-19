using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class MaintenanceScheduleConfiguration : IEntityTypeConfiguration<MaintenanceSchedule>
{
    public void Configure(EntityTypeBuilder<MaintenanceSchedule> builder)
    {
        builder.ToTable("MaintenanceSchedules");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Title).IsRequired().HasMaxLength(200);

        builder.Property(s => s.Description).HasMaxLength(1000);

        builder.Property(s => s.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(s => s.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(s => s.ItemId);
        builder.HasIndex(s => s.NextDueAt);
        builder.HasIndex(s => s.IsActive);
        builder.HasIndex(s => s.CreatedByUserId);

        builder
            .HasOne(s => s.Item)
            .WithMany(i => i.MaintenanceSchedules)
            .HasForeignKey(s => s.ItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
