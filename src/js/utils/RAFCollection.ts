type RAFCallback = (delta: number) => void

export class RAFCollection {
  // Use Set for O(1) add/remove operations instead of array
  private static callbacks = new Set<RAFCallback>()

  /**
   * Add a callback to the RAF loop.
   * Prevents duplicate registration of the same callback.
   * @param callback - Function to call each frame with delta time
   * @returns true if callback was added, false if already registered
   */
  static add(callback: RAFCallback): boolean {
    if (this.callbacks.has(callback)) {
      return false
    }
    this.callbacks.add(callback)
    return true
  }

  /**
   * Remove a callback from the RAF loop.
   * @param callback - Function to remove
   * @returns true if callback was removed, false if not found
   */
  static remove(callback: RAFCallback): boolean {
    return this.callbacks.delete(callback)
  }

  /**
   * Check if a callback is already registered.
   * @param callback - Function to check
   */
  static has(callback: RAFCallback): boolean {
    return this.callbacks.has(callback)
  }

  /**
   * Remove all callbacks from the RAF loop.
   */
  static clear(): void {
    this.callbacks.clear()
  }

  /**
   * Get the number of registered callbacks.
   */
  static get length(): number {
    return this.callbacks.size
  }

  /**
   * Iterate over all callbacks with delta time.
   * @param fn - Function to call for each callback
   */
  static forEach(fn: (callback: RAFCallback) => void): void {
    this.callbacks.forEach(fn)
  }

  // Legacy support: keep rafArray for backwards compatibility
  static get rafArray() {
    return Array.from(this.callbacks).map((callback) => ({ callback }))
  }
}
