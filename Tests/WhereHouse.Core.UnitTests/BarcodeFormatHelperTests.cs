using WhereHouse.Core.Intake;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class BarcodeFormatHelperTests
{
    [TestMethod]
    public void NormalizeBarcode_NumericWithDashesAndSpaces_StripsSeparators()
    {
        Assert.AreEqual("0885911362757", BarcodeFormatHelper.NormalizeBarcode("0-88591-136275-7"));
        Assert.AreEqual("045242507979", BarcodeFormatHelper.NormalizeBarcode("0 45242 50797 9"));
        Assert.AreEqual("041333415017", BarcodeFormatHelper.NormalizeBarcode("  041333415017  "));
    }

    [TestMethod]
    public void NormalizeBarcode_AlphanumericCode_PreservesAndUpperCases()
    {
        Assert.AreEqual("SN-ABC-12345", BarcodeFormatHelper.NormalizeBarcode("sn-abc-12345"));
        Assert.AreEqual("CUSTOM123", BarcodeFormatHelper.NormalizeBarcode("  custom123  "));
    }

    [TestMethod]
    public void NormalizeBarcode_NullOrEmpty_ThrowsArgumentException()
    {
        Assert.ThrowsExactly<ArgumentException>(() => BarcodeFormatHelper.NormalizeBarcode(null));
        Assert.ThrowsExactly<ArgumentException>(() => BarcodeFormatHelper.NormalizeBarcode("   "));
        Assert.ThrowsExactly<ArgumentException>(() =>
            BarcodeFormatHelper.NormalizeBarcode(string.Empty)
        );
    }

    [TestMethod]
    public void IsStandardRetailBarcode_GtinLengths_ReturnsTrue()
    {
        // EAN-8 (8 digits)
        Assert.IsTrue(BarcodeFormatHelper.IsStandardRetailBarcode("96385074"));
        // UPC-A (12 digits)
        Assert.IsTrue(BarcodeFormatHelper.IsStandardRetailBarcode("045242507979"));
        // EAN-13 (13 digits)
        Assert.IsTrue(BarcodeFormatHelper.IsStandardRetailBarcode("0885911362757"));
        // GTIN-14 (14 digits)
        Assert.IsTrue(BarcodeFormatHelper.IsStandardRetailBarcode("10045242507976"));
    }

    [TestMethod]
    public void IsStandardRetailBarcode_NonGtinOrTooShort_ReturnsFalse()
    {
        Assert.IsFalse(BarcodeFormatHelper.IsStandardRetailBarcode("12345"));
        Assert.IsFalse(BarcodeFormatHelper.IsStandardRetailBarcode("SN-ABC-12345"));
        Assert.IsFalse(BarcodeFormatHelper.IsStandardRetailBarcode(null));
        Assert.IsFalse(BarcodeFormatHelper.IsStandardRetailBarcode(""));
    }
}
