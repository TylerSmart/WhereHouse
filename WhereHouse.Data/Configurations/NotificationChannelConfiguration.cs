using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class NotificationChannelConfiguration : IEntityTypeConfiguration<NotificationChannel>
{
    public void Configure(EntityTypeBuilder<NotificationChannel> builder)
    {
        builder.ToTable("NotificationChannels");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).IsRequired().HasMaxLength(150);

        builder.Property(c => c.EndpointUrl).HasMaxLength(1000);

        builder.Property(c => c.AccessTokenOrKey).HasMaxLength(500);

        builder.Property(c => c.RecipientOrUserKey).HasMaxLength(320);

        builder.Property(c => c.SmtpHost).HasMaxLength(255);

        builder.Property(c => c.SmtpUsername).HasMaxLength(255);

        builder.Property(c => c.SmtpFromAddress).HasMaxLength(320);

        builder.Property(c => c.LastDeliveryStatus).HasMaxLength(500);

        builder.Property(c => c.CreatedBy).IsRequired().HasMaxLength(100);

        builder.Property(c => c.ModifiedBy).IsRequired().HasMaxLength(100);

        builder.HasIndex(c => c.OwnerId);
        builder.HasIndex(c => c.IsEnabled);
        builder.HasIndex(c => c.IsSharedHouseholdChannel);

        builder
            .HasOne(c => c.Owner)
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
