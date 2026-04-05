export interface DeviceProfile {
  tier: 'low' | 'mid' | 'high';
  maxPagePool: number;
  renderScale: number;
  enableWebGL: boolean;
  enableSearch: boolean;
  enableThumbs: boolean;
}

export async function detectProfile(): Promise<DeviceProfile> {
  const mem = navigator.deviceMemory ?? 2;
  const cores = navigator.hardwareConcurrency ?? 2;
  const isAtom = /atom|celeron|pentium/i.test(navigator.userAgent);
  const hasGL = !!document.createElement('canvas').getContext('webgl2');

  if (mem <= 2 || isAtom || cores <= 2) {
    return { tier: 'low', maxPagePool: 1, renderScale: 1.0,
              enableWebGL: false, enableSearch: false, enableThumbs: false };
  }
  if (mem <= 4 || cores <= 4) {
    return { tier: 'mid', maxPagePool: 3, renderScale: 1.5,
              enableWebGL: hasGL, enableSearch: true, enableThumbs: true };
  }
  return { tier: 'high', maxPagePool: 5, renderScale: 2.0,
            enableWebGL: hasGL, enableSearch: true, enableThumbs: true };
}

// NOTE: manual gc() does not exist in real browsers.
// Page pool eviction (bitmap.close(), page.cleanup()) is sufficient.
// V8 manages memory on its own.
