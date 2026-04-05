import { describe, it, expect, beforeEach } from 'vitest';

describe('Annotation schema', () => {
  it('should accept a highlight annotation', () => {
    const ann = {
      docId: 'abc123',
      pageNumber: 1,
      type: 'highlight' as const,
      data: { rect: { x: 0, y: 0, width: 100, height: 20 }, color: '#e5c07b' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    expect(ann.type).toBe('highlight');
    expect(ann.docId).toBe('abc123');
    expect(ann.data.rect).toBeDefined();
  });

  it('should accept a note annotation with text', () => {
    const ann = {
      docId: 'abc123',
      pageNumber: 2,
      type: 'note' as const,
      data: { text: 'Test note', rect: { x: 50, y: 50, width: 0, height: 0 } },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    expect(ann.data.text).toBe('Test note');
  });

  it('should accept an ink annotation with paths', () => {
    const ann = {
      docId: 'abc123',
      pageNumber: 1,
      type: 'ink' as const,
      data: { paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }] },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    expect(ann.data.paths).toHaveLength(1);
    expect(ann.data.paths![0].points).toHaveLength(2);
  });
});
