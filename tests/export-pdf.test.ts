import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportPDF } from '../src/annotations/export';
import { storage } from '../src/annotations/storage';
import { PDFDocument } from 'pdf-lib';

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({}),
  },
}));

describe('exportPDF', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should export unmodified PDF when there are no annotations', async () => {
    // Mock storage to return no annotations
    vi.spyOn(storage, 'loadAnnotations').mockResolvedValue([]);

    // Mock DOM elements for downloadBlob
    const mockClick = vi.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

    // Mock URL methods
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    const buffer = new ArrayBuffer(8);
    const fileName = 'test.pdf';

    await exportPDF('doc1', buffer, fileName);

    expect(storage.loadAnnotations).toHaveBeenCalledWith('doc1');
    expect(PDFDocument.load).toHaveBeenCalledWith(buffer);

    // downloadBlob should have been called
    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blobArg = mockCreateObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockAnchor.download).toBe(fileName);
    expect(mockAnchor.href).toBe('blob:test-url');
    expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockClick).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
  });
});
