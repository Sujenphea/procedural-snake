import { Vector2 } from "three"
import { Properties } from "./properties"

export class Input {
  static mouseXY = new Vector2()
  static mousePixelXY = new Vector2()
  static mouseScreenXY = new Vector2()

  static deltaXY = new Vector2()
  static deltaScreenXY = new Vector2()
  static deltaPixelXY = new Vector2()

  static _prevMouseXY = new Vector2()
  static prevMouseXY = new Vector2()
  static _prevMouseScreenXY = new Vector2()
  static prevMouseScreenXY = new Vector2()
  static _prevMousePixelXY = new Vector2()
  static prevMousePixelXY = new Vector2()

  // cache viewport dimensions for input calculations
  private static cachedViewportWidth = 0
  private static cachedViewportHeight = 0
  private static invViewportWidth = 0
  private static invViewportHeight = 0

  // store bound functions to fix memory leak
  private static boundOnMove: (e: MouseEvent) => void
  private static boundTouchMove: (e: TouchEvent) => void

  /* --------------------------------- public --------------------------------- */
  static updateViewportCache() {
    if (
      this.cachedViewportWidth !== Properties.viewportWidth ||
      this.cachedViewportHeight !== Properties.viewportHeight
    ) {
      this.cachedViewportWidth = Properties.viewportWidth
      this.cachedViewportHeight = Properties.viewportHeight
      this.invViewportWidth = 1 / Properties.viewportWidth
      this.invViewportHeight = 1 / Properties.viewportHeight
    }
  }

  static preInit() {
    this.updateViewportCache()

    this.boundOnMove = this._onMove.bind(this) as (e: MouseEvent) => void
    this.boundTouchMove = this._getTouch(this, this._onMove)

    document.addEventListener("mousemove", this.boundOnMove, { passive: true })
    document.addEventListener("touchmove", this.boundTouchMove, { passive: true })
  }

  static update() {}

  static postUpdate() {
    this.deltaXY.set(0, 0)
    this.deltaScreenXY.set(0, 0)
    this.deltaPixelXY.set(0, 0)
    this.prevMouseXY.copy(this.mouseXY)
    this.prevMouseScreenXY.copy(this.mouseScreenXY)
    this.prevMousePixelXY.copy(this.mousePixelXY)
  }

  static destroy() {
    document.removeEventListener("mousemove", this.boundOnMove)
    document.removeEventListener("touchmove", this.boundTouchMove)
  }

  /* ---------------------------------- utils --------------------------------- */
  static _getInputXY(ev: MouseEvent | Touch, outputVector: Vector2) {
    outputVector.set(ev.clientX * this.invViewportWidth * 2 - 1, 1 - ev.clientY * this.invViewportHeight * 2)

    return outputVector
  }

  static _getInputPixelXY(ev: MouseEvent | Touch, outputVector: Vector2) {
    outputVector.set(ev.clientX, ev.clientY)
  }

  static _getInputScreenXY(ev: MouseEvent | Touch, outputVector: Vector2) {
    outputVector.set(ev.clientX * this.invViewportWidth, 1 - ev.clientY * this.invViewportHeight)
  }

  /* -------------------------------- listeners ------------------------------- */
  static _onMove(e: MouseEvent | Touch) {
    // update input coordinates
    this._getInputXY(e, this.mouseXY)
    this._getInputScreenXY(e, this.mouseScreenXY)
    this._getInputPixelXY(e, this.mousePixelXY)

    // calculate deltas
    this.deltaXY.copy(this.mouseXY).sub(this._prevMouseXY)
    this.deltaScreenXY.copy(this.mouseScreenXY).sub(this._prevMouseScreenXY)
    this.deltaPixelXY.copy(this.mousePixelXY).sub(this._prevMousePixelXY)

    // store previous positions
    this._prevMouseXY.copy(this.mouseXY)
    this._prevMouseScreenXY.copy(this.mouseScreenXY)
    this._prevMousePixelXY.copy(this.mousePixelXY)
  }

  static _getTouch(context: Input, handler: (e: MouseEvent | Touch) => void, preventDefault?: boolean) {
    return (touchEvent: TouchEvent) => {
      if (preventDefault && touchEvent.preventDefault) {
        touchEvent.preventDefault()
      }

      // Safely get touch point with null checking
      const touch = touchEvent.changedTouches?.[0] || touchEvent.touches?.[0]
      if (touch) {
        handler.call(context, touch)
      }
    }
  }
}
