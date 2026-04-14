import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Store, AppState } from '../src/state/store';

describe('Reactive Store', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Save original matchMedia
    if (typeof window !== 'undefined') {
      originalMatchMedia = window.matchMedia;
    }
  });

  afterEach(() => {
    // Restore original matchMedia
    if (typeof window !== 'undefined') {
      window.matchMedia = originalMatchMedia;
    }
    vi.restoreAllMocks();
  });

  function mockMatchMedia(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  describe('Theme Detection', () => {
    it('detects dark theme when system prefers dark', () => {
      mockMatchMedia(true);
      const store = new Store();
      expect(store.get('theme')).toBe('dark');
    });

    it('detects light theme when system prefers light', () => {
      mockMatchMedia(false);
      const store = new Store();
      expect(store.get('theme')).toBe('light');
    });

    it('defaults to dark theme when window is undefined', () => {
      // Simulate environment without window.matchMedia
      const tempWindow = globalThis.window;
      // @ts-ignore
      delete globalThis.window;

      const store = new Store();
      expect(store.get('theme')).toBe('dark');

      // Restore window
      globalThis.window = tempWindow;
    });

    it('defaults to dark theme when window.matchMedia is undefined', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined,
      });
      const store = new Store();
      expect(store.get('theme')).toBe('dark');
    });
  });

  describe('State Management', () => {
    let store: Store;

    beforeEach(() => {
      mockMatchMedia(true);
      store = new Store();
    });

    it('gets initial state values', () => {
      expect(store.get('currentPage')).toBe(1);
      expect(store.get('zoom')).toBe(1.0);
      expect(store.get('activeTool')).toBe('select');
    });

    it('getAll returns a copy of the state', () => {
      const state = store.getAll();
      expect(state.currentPage).toBe(1);

      // Mutating the returned object shouldn't mutate internal state directly (though it's a shallow copy)
      state.currentPage = 5;
      expect(store.get('currentPage')).toBe(1);
    });

    it('sets state values and updates state', () => {
      store.set('currentPage', 2);
      expect(store.get('currentPage')).toBe(2);

      store.set('activeTool', 'ink');
      expect(store.get('activeTool')).toBe('ink');
    });

    it('updates multiple keys via batch update', () => {
      store.update({
        currentPage: 3,
        zoom: 1.5,
      });

      expect(store.get('currentPage')).toBe(3);
      expect(store.get('zoom')).toBe(1.5);
    });
  });

  describe('Subscriptions', () => {
    let store: Store;

    beforeEach(() => {
      mockMatchMedia(true);
      store = new Store();
    });

    it('notifies specific key listeners when set is called', () => {
      const listener = vi.fn();
      store.subscribe('currentPage', listener);

      store.set('currentPage', 2);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(2, 'currentPage');
    });

    it('does not notify listeners if the value is unchanged', () => {
      const listener = vi.fn();
      store.subscribe('currentPage', listener);

      store.set('currentPage', 1); // 1 is the default value

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies specific key listeners when update is called', () => {
      const pageListener = vi.fn();
      const zoomListener = vi.fn();

      store.subscribe('currentPage', pageListener);
      store.subscribe('zoom', zoomListener);

      store.update({
        currentPage: 5,
        zoom: 2.0,
      });

      expect(pageListener).toHaveBeenCalledTimes(1);
      expect(pageListener).toHaveBeenCalledWith(5, 'currentPage');

      expect(zoomListener).toHaveBeenCalledTimes(1);
      expect(zoomListener).toHaveBeenCalledWith(2.0, 'zoom');
    });

    it('only notifies listeners for keys that actually changed during batch update', () => {
      const pageListener = vi.fn();
      const zoomListener = vi.fn();

      store.subscribe('currentPage', pageListener);
      store.subscribe('zoom', zoomListener);

      store.update({
        currentPage: 1, // Same as initial
        zoom: 2.0, // Changed
      });

      expect(pageListener).not.toHaveBeenCalled();
      expect(zoomListener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes specific key listeners correctly', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe('currentPage', listener);

      store.set('currentPage', 2);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.set('currentPage', 3);
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('handles multiple listeners for the same key', () => {
      const listener1 = vi.fn();
      const listenerFor2 = vi.fn();

      store.subscribe('currentPage', listener1);
      store.subscribe('currentPage', listenerFor2);

      store.set('currentPage', 2);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listenerFor2).toHaveBeenCalledTimes(1);
    });

    it('notifies global listeners on any state change via set', () => {
      const globalListener = vi.fn();
      store.subscribeAll(globalListener);

      store.set('currentPage', 2);

      expect(globalListener).toHaveBeenCalledTimes(1);
      const state = globalListener.mock.calls[0][0] as AppState;
      expect(state.currentPage).toBe(2);
    });

    it('notifies global listeners on state changes via update (once per changed key)', () => {
      const globalListener = vi.fn();
      store.subscribeAll(globalListener);

      store.update({
        currentPage: 3,
        zoom: 1.5,
      });

      // Called twice, once for each changed key
      expect(globalListener).toHaveBeenCalledTimes(2);

      const lastState = globalListener.mock.lastCall![0] as AppState;
      expect(lastState.currentPage).toBe(3);
      expect(lastState.zoom).toBe(1.5);
    });

    it('unsubscribes global listeners correctly', () => {
      const globalListener = vi.fn();
      const unsubscribe = store.subscribeAll(globalListener);

      store.set('currentPage', 2);
      expect(globalListener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.set('currentPage', 3);
      expect(globalListener).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Error Handling', () => {
    let store: Store;

    beforeEach(() => {
      mockMatchMedia(true);
      store = new Store();
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('catches and logs errors in specific key listeners, allowing execution to continue', () => {
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener crashed');
      });
      const goodListener = vi.fn();

      store.subscribe('currentPage', badListener);
      store.subscribe('currentPage', goodListener);

      store.set('currentPage', 2);

      expect(badListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '[Store] Listener error for "currentPage":',
        expect.any(Error)
      );
      expect(goodListener).toHaveBeenCalled(); // Execution continued
    });

    it('catches and logs errors in global listeners, allowing execution to continue', () => {
      const badGlobalListener = vi.fn().mockImplementation(() => {
        throw new Error('Global listener crashed');
      });
      const goodGlobalListener = vi.fn();

      store.subscribeAll(badGlobalListener);
      store.subscribeAll(goodGlobalListener);

      store.set('currentPage', 2);

      expect(badGlobalListener).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '[Store] Global listener error:',
        expect.any(Error)
      );
      expect(goodGlobalListener).toHaveBeenCalled(); // Execution continued
    });
  });
});
