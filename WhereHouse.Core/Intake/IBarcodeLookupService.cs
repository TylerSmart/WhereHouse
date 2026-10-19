namespace WhereHouse.Core.Intake;

public interface IBarcodeLookupService
{
    Task<BarcodeProductLookupDto> LookupBarcodeAsync(
        Guid userId,
        string rawBarcode,
        CancellationToken cancellationToken = default
    );
}
