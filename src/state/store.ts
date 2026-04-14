/**
 * pdfiuh Reactive Store
 * Minimal pub/sub state management — zero framework overhead.
 */

export interface AppState {
  docId: string;
  totalPages: number;
  currentPage: number;
  zoom: number;
  rotation: number;
  activeTool: 'select' | 'highlight' | 'ink' | 'note' | 'eraser';
  activeColor: string;
  sidebarOpen: boolean;
  sidebarTab: 'toc' | 'thumbnails' | 'annotations';
  findBarOpen: boolean;
  theme: 'light' | 'dark';
  deviceProfile: 'low' | 'mid' | 'high';
  fileName: string;
}

type Listener<K extends keyof AppState> = (value: AppState[K], key: K) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = Listener<any>;

class Store {
  private state: AppState = {
    docId: '',
    totalPages: 0,
    currentPage: 1,
    zoom: 1.0,
    rotation: 0,
    activeTool: 'select',
    activeColor: '#FFEB3B',
    sidebarOpen: false,
    sidebarTab: 'toc',
    findBarOpen: false,
    theme: this.detectSystemTheme(),
    deviceProfile: 'mid',
    fileName: '',
  };

  private listeners = new Map<keyof AppState, Set<AnyListener>>();
  private globalListeners = new Set<(state: AppState) => void>();

  private detectSystemTheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }

  get<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  getAll(): Readonly<AppState> {
    return { ...this.state };
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    if (this.state[key] === value) return;
    this.state[key] = value;
    this.notify(key);
  }

  /** Batch update multiple keys — fires notifications once per key */
  update(partial: Partial<AppState>): void {
    const changedKeys: (keyof AppState)[] = [];
    for (const key of Object.keys(partial) as (keyof AppState)[]) {
      if (this.state[key] !== partial[key]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.state as any)[key] = partial[key];
        changedKeys.push(key);
      }
    }
    for (const key of changedKeys) {
      this.notify(key);
    }
  }

  subscribe<K extends keyof AppState>(key: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as AnyListener);
    return () => {
      this.listeners.get(key)?.delete(listener as AnyListener);
    };
  }

  /** Listen to ALL state changes */
  subscribeAll(listener: (state: AppState) => void): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /** INTERNAL USE ONLY — Clears all listeners for testing purposes */
  _clearListeners(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }

  private notify<K extends keyof AppState>(key: K): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      for (const cb of keyListeners) {
        try {
          cb(this.state[key], key);
        } catch (err) {
          console.error(`[Store] Listener error for "${String(key)}":`, err);
        }
      }
    }
    for (const cb of this.globalListeners) {
      try {
        cb(this.state);
      } catch (err) {
        console.error('[Store] Global listener error:', err);
      }
    }
  }
}

export const store = new Store();
