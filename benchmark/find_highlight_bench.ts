import { JSDOM } from 'jsdom';
import { performance } from 'perf_hooks';

const dom = new JSDOM(`<!DOCTYPE html><div></div>`);
const document = dom.window.document;

class MockViewer {
  pages = new Map();
  highlightedSpans = new Set<HTMLSpanElement>();

  constructor(numPages = 10, spansPerPage = 1000) {
    for (let i = 1; i <= numPages; i++) {
      const textLayer = document.createElement('div');

      const charMap = [];
      let offset = 0;

      for (let j = 0; j < spansPerPage; j++) {
        const span = document.createElement('span');
        span.textContent = 'test ';
        textLayer.appendChild(span);

        charMap.push({ offset, length: 5, span });
        offset += 5;
      }

      this.pages.set(i, {
        textLayer,
        textLayerCharMap: charMap
      });
    }
  }

  // Current method
  clearFindHighlightsCurrent(): void {
    this.pages.forEach(state => {
      state.textLayer.querySelectorAll('.find-match, .find-match-current').forEach((el: HTMLElement) => {
        el.classList.remove('find-match', 'find-match-current');
      });
    });
  }

  // Proposed optimized method
  clearFindHighlightsOptimized(): void {
    this.highlightedSpans.forEach(span => {
      span.classList.remove('find-match', 'find-match-current');
    });
    this.highlightedSpans.clear();
  }

  highlightTextMatch(pageNum: number, numHighlights: number): void {
    const state = this.pages.get(pageNum);
    if (!state) return;

    // reset
    this.highlightedSpans.clear();

    for (let i = 0; i < numHighlights; i++) {
      const span = state.textLayerCharMap[i].span;
      span.classList.add('find-match');
      this.highlightedSpans.add(span);
    }
  }

  highlightTextMatchCurrent(pageNum: number, numHighlights: number): void {
    const state = this.pages.get(pageNum);
    if (!state) return;

    for (let i = 0; i < numHighlights; i++) {
      const span = state.textLayerCharMap[i].span;
      span.classList.add('find-match');
    }
  }
}

function runBenchmark() {
  const viewer = new MockViewer(50, 2000); // 50 pages, 2000 spans per page = 100k spans total

  // Highlight 10 spans on page 1

  // Measure current
  let totalCurrent = 0;
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    viewer.highlightTextMatchCurrent(1, 10);
    const start = performance.now();
    viewer.clearFindHighlightsCurrent();
    const end = performance.now();
    totalCurrent += (end - start);
  }

  // Measure optimized
  let totalOptimized = 0;

  for (let i = 0; i < iterations; i++) {
    viewer.highlightTextMatch(1, 10);
    const start = performance.now();
    viewer.clearFindHighlightsOptimized();
    const end = performance.now();
    totalOptimized += (end - start);
  }

  console.log(`Current approach average time: ${(totalCurrent / iterations).toFixed(4)} ms`);
  console.log(`Optimized approach average time: ${(totalOptimized / iterations).toFixed(4)} ms`);
  console.log(`Speedup: ${(totalCurrent / totalOptimized).toFixed(2)}x`);
}

runBenchmark();
