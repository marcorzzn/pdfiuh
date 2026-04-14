import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../src/core/event-bus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should allow subscribing and publishing an event', () => {
    const callback = vi.fn();
    bus.subscribe('test-event', callback);

    bus.publish('test-event');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(undefined);
  });

  it('should publish events with data payload', () => {
    const callback = vi.fn();
    const payload = { key: 'value', id: 42 };

    bus.subscribe('data-event', callback);
    bus.publish('data-event', payload);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(payload);
  });

  it('should allow multiple subscribers for the same event', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    bus.subscribe('multi-event', callback1);
    bus.subscribe('multi-event', callback2);

    bus.publish('multi-event', 'hello');

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith('hello');
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith('hello');
  });

  it('should allow unsubscribing using the returned function', () => {
    const callback = vi.fn();
    const unsubscribe = bus.subscribe('unsub-event', callback);

    // Publish once to ensure it works
    bus.publish('unsub-event');
    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();

    // Publish again
    bus.publish('unsub-event');

    // Callback should not have been called a second time
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not throw when publishing to an event with no subscribers', () => {
    expect(() => {
      bus.publish('ghost-event');
    }).not.toThrow();
  });

  it('should only unsubscribe the specific callback', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsubscribe1 = bus.subscribe('shared-event', callback1);
    bus.subscribe('shared-event', callback2);

    unsubscribe1();

    bus.publish('shared-event');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});
