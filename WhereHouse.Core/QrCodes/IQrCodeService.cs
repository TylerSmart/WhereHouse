namespace WhereHouse.Core.QrCodes;

public interface IQrCodeService
{
    Task<IReadOnlyList<QrCodeDto>> GetQrCodesAsync(
        Guid userId,
        QrTargetType? targetType = null,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<QrCodeDto>> GenerateBatchAsync(
        Guid userId,
        GenerateQrCodeBatchRequest request,
        CancellationToken cancellationToken = default
    );

    Task<QrCodeDto> BindQrCodeAsync(
        Guid userId,
        string tokenOrInput,
        BindQrCodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<QrCodeDto> UnbindQrCodeAsync(
        Guid userId,
        string tokenOrInput,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteQrCodeAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
