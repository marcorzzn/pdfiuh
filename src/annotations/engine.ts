/**
 * pdfiuh Annotation Engine
 * Gestisce la conversione tra coordinate pixel e coordinate normalizzate.
 */

export interface NormalizedCoord {
  x: number;
  y: number;
}

export class AnnotationEngine {
  /**
   * Converte coordinate pixel in coordinate normalizzate (0.0 - 1.0)
   */
  static pixelToNormalized(x: number, y: number, pageWidth: number, pageHeight: number): NormalizedCoord {
    return {
      x: x / pageWidth,
      y: y / pageHeight
    };
  }

  /**
   * Converte coordinate normalizzate in coordinate pixel per il rendering
   */
  static normalizedToPixel(nx: number, ny: number, pageWidth: number, pageHeight: number): NormalizedCoord {
    return {
      x: nx * pageWidth,
      y: ny * pageHeight
    };
  }

  /**
   * Genera una stringa di percorso SVG per un tratto di inchiostro
   * I punti sono forniti come array [nx1, ny1, nx2, ny2, ...]
   */
  static generateSvgPath(points: number[], pageWidth: number, pageHeight: number): string {
    if (points.length < 4) return '';

    const start = this.normalizedToPixel(points[0], points[1], pageWidth, pageHeight);
    let d = `M ${start.x},${start.y}`;

    for (let i = 2; i < points.length; i += 2) {
      const p = this.normalizedToPixel(points[i], points[i + 1], pageWidth, pageHeight);
      d += ` L ${p.x},${p.y}`;
    }

    return d;
  }
}
