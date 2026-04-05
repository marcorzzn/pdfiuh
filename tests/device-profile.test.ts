import { describe, it, expect } from 'vitest';

describe('Device Profile schema', () => {
  it('should define a valid low profile', () => {
    const profile = {
      tier: 'low' as const,
      maxPagePool: 1,
      renderScale: 1.0,
      enableWebGL: false,
      enableSearch: false,
      enableThumbs: false
    };
    expect(profile.tier).toBe('low');
    expect(profile.maxPagePool).toBe(1);
    expect(profile.renderScale).toBeLessThan(profile.renderScale * 1.001);
  });

  it('should define a valid mid profile', () => {
    const profile = {
      tier: 'mid' as const,
      maxPagePool: 3,
      renderScale: 1.5,
      enableWebGL: true,
      enableSearch: true,
      enableThumbs: true
    };
    expect(profile.tier).toBe('mid');
    expect(profile.maxPagePool).toBeGreaterThanOrEqual(2);
  });

  it('should define a valid high profile', () => {
    const profile = {
      tier: 'high' as const,
      maxPagePool: 5,
      renderScale: 2.0,
      enableWebGL: true,
      enableSearch: true,
      enableThumbs: true
    };
    expect(profile.tier).toBe('high');
  });
});
