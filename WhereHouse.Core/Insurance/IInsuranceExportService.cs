namespace WhereHouse.Core.Insurance;

public interface IInsuranceExportService
{
    Task<InsuranceClaimPreviewDto> GetClaimPreviewAsync(
        Guid userId,
        InsuranceClaimFilterQuery query,
        CancellationToken cancellationToken = default
    );

    Task<InsuranceExportArchiveResult> GenerateClaimZipAsync(
        Guid userId,
        InsuranceClaimFilterQuery query,
        CancellationToken cancellationToken = default
    );
}
