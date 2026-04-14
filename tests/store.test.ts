import { describe, it, expect, vi, beforeEach } from 'vitest';
import { store } from '../src/state/store';

describe('Store Error Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error - calling internal method for testing
    store._clearListeners();
  });

  it('should catch and log error when a key listener throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test listener error');

    store.subscribe('zoom', () => {
      throw error;
    });

    store.set('zoom', 2.0);

    expect(consoleSpy).toHaveBeenCalledWith(
      `[Store] Listener error for "zoom":`,
      error
    );
  });

  it('should catch and log error when a global listener throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test global listener error');

    store.subscribeAll(() => {
      throw error;
    });

    store.set('currentPage', 2);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Store] Global listener error:',
      error
    );
  });

  it('should continue notifying other listeners if one throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const listener1 = vi.fn(() => { throw new Error('Fail'); });
    const listener2 = vi.fn();

    store.subscribe('theme', listener1);
    store.subscribe('theme', listener2);

    // Ensure we are setting a different value to trigger notification
    const currentTheme = store.get('theme');
    store.set('theme', currentTheme === 'light' ? 'dark' : 'light');

    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
