/**
 * pdfiuh EventBus
 * Sistema di comunicazione minimalista per evitare l'overhead dei framework di stato.
 */
type Callback = (data: any) => void;

export class EventBus {
  private subscribers: Map<string, Callback[]> = new Map();

  publish(event: string, data?: any) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  subscribe(event: string, callback: Callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(callback);

    // Ritorna una funzione di unsubscribe
    return () => {
      const callbacks = this.subscribers.get(event);
      if (callbacks) {
        this.subscribers.set(event, callbacks.filter(cb => cb !== callback));
      }
    };
  }
}

export const bus = new EventBus();
