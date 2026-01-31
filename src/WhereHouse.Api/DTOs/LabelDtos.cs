namespace WhereHouse.Api.DTOs;

public record LabelTemplateDto(
    int Id,
    string Name,
    string TemplateName,
    double PageWidth,
    double PageHeight,
    int LabelsPerRow,
    int LabelsPerColumn,
    double LabelWidth,
    double LabelHeight,
    double HorizontalSpacing,
    double VerticalSpacing,
    double LeftMargin,
    double TopMargin,
    bool IsDefault);

public record PrintLabelRequest(
    int TemplateId,
    List<LabelData> Labels);

public record LabelData(
    string QrCode,
    string Name,
    string? Description);
