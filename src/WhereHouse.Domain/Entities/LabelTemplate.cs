namespace WhereHouse.Domain.Entities;

public class LabelTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public double PageWidth { get; set; }
    public double PageHeight { get; set; }
    public int LabelsPerRow { get; set; }
    public int LabelsPerColumn { get; set; }
    public double LabelWidth { get; set; }
    public double LabelHeight { get; set; }
    public double HorizontalSpacing { get; set; }
    public double VerticalSpacing { get; set; }
    public double LeftMargin { get; set; }
    public double TopMargin { get; set; }
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
}
