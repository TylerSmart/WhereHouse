import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  ImportResultDto,
  ImportRowActions,
  PortabilityEntityTypes,
  WhereHouseExportBundleDto,
} from '../../../core/models/intake-portability.models';
import { IntakePortabilityService } from '../../../core/services/intake-portability/intake-portability.service';
import { ImportExportDialogComponent } from './import-export-dialog.component';

describe('ImportExportDialogComponent', () => {
  let component: ImportExportDialogComponent;
  let fixture: ComponentFixture<ImportExportDialogComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  const mockIntakeService = {
    exportJsonBundle: vi.fn(),
    exportCsv: vi.fn(),
    importJsonBundle: vi.fn(),
    importCsv: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock createObjectURL, revokeObjectURL, and anchor click
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(vi.fn());

    await TestBed.configureTestingModule({
      imports: [ImportExportDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: IntakePortabilityService, useValue: mockIntakeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with CSV format and Items entity type', () => {
    expect(component).toBeTruthy();
    expect(component['importFormat']()).toBe('csv');
    expect(component['selectedEntityType']()).toBe(PortabilityEntityTypes.Items);
    expect(component['updateExisting']()).toBe(true);
  });

  it('should export JSON bundle and trigger download', () => {
    const bundle: WhereHouseExportBundleDto = {
      formatVersion: '1.0',
      exportedAt: '2026-10-18T00:00:00Z',
      categories: [],
      locations: [],
      items: [],
    };

    mockIntakeService.exportJsonBundle.mockReturnValue(of(bundle));

    component.onExportJson();

    expect(mockIntakeService.exportJsonBundle).toHaveBeenCalled();
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith('JSON backup exported successfully.', 'OK', {
      duration: 3000,
    });
  });

  it('should export CSV and trigger download', () => {
    mockIntakeService.exportCsv.mockReturnValue(of('ShortCode,Name\nITM-001,Test'));

    component.onExportCsv(PortabilityEntityTypes.Items);

    expect(mockIntakeService.exportCsv).toHaveBeenCalledWith(PortabilityEntityTypes.Items);
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith('Exported items CSV successfully.', 'OK', {
      duration: 3000,
    });
  });

  it('should auto-match CSV headers to target fields', () => {
    const csvContent = 'Name,ItemType,Brand,CurrentQuantity\nCordless Drill,0,DeWalt,1';

    const inputEvent = {
      target: { value: csvContent } as unknown as HTMLTextAreaElement,
    } as unknown as Event;

    component.onRawContentChange(inputEvent);

    expect(component['detectedHeaders']()).toEqual([
      'Name',
      'ItemType',
      'Brand',
      'CurrentQuantity',
    ]);
    expect(component['columnMapping']()['Name']).toBe('Name');
    expect(component['columnMapping']()['ItemType']).toBe('ItemType');
    expect(component['columnMapping']()['Brand']).toBe('Brand');
    expect(component['columnMapping']()['CurrentQuantity']).toBe('CurrentQuantity');
  });

  it('should execute dry-run import', () => {
    const csvContent = 'Name\nTest Drill';
    component['rawContent'].set(csvContent);

    const mockResult: ImportResultDto = {
      dryRun: true,
      totalRowsProcessed: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          entityType: 'Item',
          identifier: 'ITM-001',
          name: 'Test Drill',
          action: ImportRowActions.Create,
          message: 'Will create item.',
        },
      ],
    };

    mockIntakeService.importCsv.mockReturnValue(of(mockResult));

    component.onRunDryRun();

    expect(mockIntakeService.importCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        csvContent,
      }),
    );
    expect(component['previewResult']()).toEqual(mockResult);
    expect(component['canCommit']()).toBe(true);
  });

  it('should execute commit import when canCommit is true', () => {
    const csvContent = 'Name\nTest Drill';
    component['rawContent'].set(csvContent);

    const mockCommitResult: ImportResultDto = {
      dryRun: false,
      totalRowsProcessed: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      rows: [],
    };

    mockIntakeService.importCsv.mockReturnValue(of(mockCommitResult));

    component.onCommitImport();

    expect(mockIntakeService.importCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        csvContent,
      }),
    );
    expect(component['hasImported']()).toBe(true);
  });

  it('should close dialog and pass imported status', () => {
    component['hasImported'].set(true);
    component.onClose();

    expect(mockDialogRef.close).toHaveBeenCalledWith({ imported: true });
  });
});
