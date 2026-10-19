namespace WhereHouse.Core.Portability;

public interface IDataPortabilityService
{
    Task<WhereHouseExportBundleDto> ExportJsonBundleAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<string> ExportCsvAsync(
        Guid userId,
        PortabilityEntityType entityType,
        CancellationToken cancellationToken = default
    );

    Task<ImportResultDto> ImportJsonBundleAsync(
        Guid userId,
        JsonImportRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ImportResultDto> ImportCsvAsync(
        Guid userId,
        CsvImportRequest request,
        CancellationToken cancellationToken = default
    );
}
