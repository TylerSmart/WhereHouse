using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhereHouse.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddItemSharedWithUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SharedWithUserIdsJson",
                table: "InventoryItems",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "SharedWithUserIdsJson", table: "InventoryItems");
        }
    }
}
