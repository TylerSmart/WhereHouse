using WhereHouse.Core.Intake;
using WhereHouse.Core.Items;
using WhereHouse.Core.QrCodes;

namespace WhereHouse.Data.Services;

public sealed class RapidIntakeService(IItemService itemService, IQrCodeService qrCodeService)
    : IRapidIntakeService
{
    public async Task<ItemDto> CreateRapidItemAsync(
        Guid userId,
        RapidIntakeItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var createReq = new CreateItemRequest(
            Name: request.Name,
            ItemType: request.ItemType,
            HomeLocationId: request.HomeLocationId,
            CategoryId: request.CategoryId,
            ParentItemId: null,
            ShortCode: null,
            Description: request.Description,
            Aliases: null,
            Tags: request.Tags,
            Condition: request.Condition,
            Brand: request.Brand,
            ModelNumber: request.ModelNumber,
            SerialNumber: request.SerialNumber,
            CurrentQuantity: request.CurrentQuantity,
            Unit: request.Unit,
            MinQuantity: request.MinQuantity,
            PurchaseDate: null,
            Retailer: null,
            PurchasePrice: request.PurchasePrice,
            EstimatedReplacementValue: null,
            ReturnWindowEndDate: null,
            WarrantyExpirationDate: null,
            WarrantyNotes: null,
            IsPrivate: request.IsPrivate,
            AttributeValues: null,
            BarcodeNumber: request.BarcodeNumber
        );

        var createdItem = await itemService.CreateItemAsync(userId, createReq, cancellationToken);

        if (!string.IsNullOrWhiteSpace(request.BindQrToken))
        {
            await qrCodeService.BindQrCodeAsync(
                userId,
                request.BindQrToken.Trim(),
                new BindQrCodeRequest(QrTargetType.Item, createdItem.Id),
                cancellationToken
            );
        }

        return createdItem;
    }

    public async Task<RapidBatchIntakeResponseDto> CreateRapidBatchAsync(
        Guid userId,
        RapidBatchIntakeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var createdItems = new List<ItemDto>();

        foreach (var itemReq in request.Items)
        {
            var resolvedLocationId = itemReq.HomeLocationId ?? request.DefaultHomeLocationId;
            var resolvedCategoryId = itemReq.CategoryId ?? request.DefaultCategoryId;
            var resolvedIsPrivate = itemReq.IsPrivate || request.DefaultIsPrivate;

            var effectiveReq = itemReq with
            {
                HomeLocationId = resolvedLocationId,
                CategoryId = resolvedCategoryId,
                IsPrivate = resolvedIsPrivate,
            };

            var created = await CreateRapidItemAsync(userId, effectiveReq, cancellationToken);
            createdItems.Add(created);
        }

        return new RapidBatchIntakeResponseDto(createdItems.Count, createdItems);
    }
}
