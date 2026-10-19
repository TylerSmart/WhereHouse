using WhereHouse.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace WhereHouse.Data.Configurations;

public sealed class TodoItemConfiguration : IEntityTypeConfiguration<TodoItem>
{
    public void Configure(EntityTypeBuilder<TodoItem> builder)
    {
        builder.ToTable("TodoItems");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Title).IsRequired().HasMaxLength(200);

        builder.Property(t => t.Description).HasMaxLength(1000);

        builder.Property(t => t.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(t => t.ModifiedBy).IsRequired().HasMaxLength(256);

        builder
            .HasOne(t => t.Owner)
            .WithMany(u => u.TodoItems)
            .HasForeignKey(t => t.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.OwnerId);
    }
}
