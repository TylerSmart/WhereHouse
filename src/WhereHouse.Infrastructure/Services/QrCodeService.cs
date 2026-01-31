using QRCoder;
using System.Drawing;
using System.Drawing.Imaging;

namespace WhereHouse.Infrastructure.Services;

public interface IQrCodeService
{
    string GenerateUniqueCode();
    byte[] GenerateQrCodeImage(string code);
}

public class QrCodeService : IQrCodeService
{
    public string GenerateUniqueCode()
    {
        return Guid.NewGuid().ToString("N");
    }

    public byte[] GenerateQrCodeImage(string code)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(code, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrCodeData);
        return qrCode.GetGraphic(20);
    }
}
