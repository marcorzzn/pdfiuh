import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toXFDF, parseXFDF, importXFDF } from '../src/annotations/export';
import { storage } from '../src/annotations/storage';

vi.mock('../src/annotations/storage', () => ({
  storage: {
    saveAnnotation: vi.fn(),
  },
}));

describe('XFDF Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should serialize annotations to XFDF', () => {
    const annotations = [{
      id: 1,
      docId: 'test',
      pageNumber: 1,
      type: 'highlight' as const,
      data: { rect: { x: 10, y: 20, width: 100, height: 20 }, color: '#ff0000' },
      createdAt: 1234567890,
      updatedAt: 1234567890
    }];

    const xml = toXFDF(annotations, 'test');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('page="1"');
    expect(xml).toContain('subtype="Highlight"');
  });

  it('should parse XFDF back to annotations', () => {
    const xml = `<?xml version="1.0"?><xfdf><annots>
      <annotation id="1" page="1" type="note" created="100" modified="200">Hello world</annotation>
    </annots></xfdf>`;

    const result = parseXFDF(xml);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('note');
    expect(result[0].data?.text).toBe('Hello world');
  });
  describe('importXFDF', () => {
    let consoleWarnSpy: any;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should import and save a valid highlight annotation', async () => {
      const xml = `<?xml version="1.0"?><xfdf><annots>
        <annotation id="1" page="1" subtype="Highlight" color="#ff0000" created="100" modified="200">
          <rect x="10" y="20" width="100" height="30" />
        </annotation>
      </annots></xfdf>`;

      await importXFDF('doc123', xml);

      expect(storage.saveAnnotation).toHaveBeenCalledTimes(1);
      expect(storage.saveAnnotation).toHaveBeenCalledWith('doc123', {
        page: 1,
        type: 'highlight',
        color: '#ff0000',
        rect: { x: 10, y: 20, w: 100, h: 30 },
        text: undefined,
        points: undefined,
      });
    });

    it('should log a warning if docId in XFDF does not match, but still save', async () => {
      const xml = `<?xml version="1.0"?><xfdf><annots>
        <annotation id="1" page="1" subtype="Note" color="#00ff00" created="100" modified="200">Test note</annotation>
      </annots></xfdf>`;

      // The parser currently hardcodes docId to 'unknown'
      await importXFDF('doc123', xml);

      expect(consoleWarnSpy).toHaveBeenCalledWith('XFDF annot docId mismatch: unknown != doc123');
      expect(storage.saveAnnotation).toHaveBeenCalledTimes(1);
      expect(storage.saveAnnotation).toHaveBeenCalledWith('doc123', {
        page: 1,
        type: 'note',
        color: '#00ff00',
        rect: undefined,
        text: 'Test note',
        points: undefined,
      });
    });

    it('should map text subtype to note type', async () => {
      const xml = `<?xml version="1.0"?><xfdf><annots>
        <annotation id="1" page="2" subtype="Text" color="#0000ff" created="100" modified="200">Hello</annotation>
      </annots></xfdf>`;

      await importXFDF('doc123', xml);

      expect(storage.saveAnnotation).toHaveBeenCalledTimes(1);
      expect(storage.saveAnnotation).toHaveBeenCalledWith('doc123', {
        page: 2,
        type: 'note', // 'text' in XFDF maps to 'note' for storage
        color: '#0000ff',
        rect: undefined,
        text: 'Hello',
        points: undefined,
      });
    });

    it('should handle annotations without rects', async () => {
      const xml = `<?xml version="1.0"?><xfdf><annots>
        <annotation id="1" page="1" subtype="Ink" color="#000000" created="100" modified="200">
          <!-- Ink data: [1,2,3,4] -->
        </annotation>
      </annots></xfdf>`;

      await importXFDF('doc123', xml);

      expect(storage.saveAnnotation).toHaveBeenCalledTimes(1);
      expect(storage.saveAnnotation).toHaveBeenCalledWith('doc123', {
        page: 1,
        type: 'ink',
        color: '#000000',
        rect: undefined,
        text: undefined,
        points: [1, 2, 3, 4],
      });
    });
  });
});
