import { describe, it, expect, vi } from 'vitest';
import { toXFDF, parseXFDF } from '../src/annotations/export';

describe('XFDF Export', () => {
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

  it('should handle malformed Ink data without crashing', () => {
    const xml = `<?xml version="1.0"?><xfdf><annots>
      <annotation id="1" page="1" subtype="Ink" created="100" modified="200">
        <!-- Ink data: { invalid json -->
      </annotation>
    </annots></xfdf>`;

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = parseXFDF(xml);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('ink');
    expect(result[0].data?.paths).toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Could not parse ink data from XFDF comment:',
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });
});
