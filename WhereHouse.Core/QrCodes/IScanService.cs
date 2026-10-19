namespace WhereHouse.Core.QrCodes;

public interface IScanService
{
    Task<ScanResolutionDto> ResolveScanAsync(
        Guid userId,
        string rawCodeOrUrl,
        CancellationToken cancellationToken = default
    );

    Task<BulkScanAuditResponseDto> ExecuteBulkMoveAuditAsync(
        Guid userId,
        BulkScanAuditRequest request,
        CancellationToken cancellationToken = default
    );
}
