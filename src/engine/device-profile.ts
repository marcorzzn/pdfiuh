/**
 * pdfiuh Device Profile Detection
 * Detects hardware capabilities to optimize rendering parameters.
 */

export interface DeviceProfile {
  tier: 'low' | 'mid' | 'high';
  maxPagePool: number;
  renderScale: number;
  thumbnails: boolean;
}

const PROFILES: Record<DeviceProfile['tier'], Omit<DeviceProfile, 'tier'>> = {
  low:  { maxPagePool: 3,  renderScale: 1.0, thumbnails: false },
  mid:  { maxPagePool: 7,  renderScale: 1.5, thumbnails: true },
  high: { maxPagePool: 15, renderScale: 2.0, thumbnails: true },
};

export function detectProfile(): DeviceProfile {
  const tier = detectTier();
  return { tier, ...PROFILES[tier] };
}

function detectTier(): DeviceProfile['tier'] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;

  const memory: number = nav.deviceMemory ?? 4;
  const cores: number = nav.hardwareConcurrency ?? 2;
  const connection: string = nav.connection?.effectiveType ?? '4g';

  // Low-end detection
  if (memory <= 1 || cores <= 2 || connection === '2g' || connection === 'slow-2g') {
    return 'low';
  }

  // High-end detection
  if (memory >= 8 && cores >= 8) {
    return 'high';
  }

  return 'mid';
}
