using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhereHouse.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddItemBarcodeNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BarcodeNumber",
                table: "InventoryItems",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_BarcodeNumber",
                table: "InventoryItems",
                column: "BarcodeNumber"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_BarcodeNumber",
                table: "InventoryItems"
            );

            migrationBuilder.DropColumn(name: "BarcodeNumber", table: "InventoryItems");
        }
    }
}
