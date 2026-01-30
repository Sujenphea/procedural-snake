export class Emitter<T = void> {
  private listeners = new Set<(data: T) => void>()
  private onceListeners = new Set<(data: T) => void>()

  add(callback: (data: T) => void): void {
    this.listeners.add(callback)
  }

  addOnce(callback: (data: T) => void): void {
    this.onceListeners.add(callback)
  }

  remove(callback: (data: T) => void): void {
    this.listeners.delete(callback)
    this.onceListeners.delete(callback)
  }

  dispatch(data: T): void {
    this.listeners.forEach((cb) => cb(data))
    this.onceListeners.forEach((cb) => cb(data))
    this.onceListeners.clear()
  }

  clear(): void {
    this.listeners.clear()
    this.onceListeners.clear()
  }
}
