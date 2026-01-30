const PIXEL_STEP = 10
const LINE_HEIGHT = 40
const PAGE_HEIGHT = 800

export const normalizeWheel = (event: WheelEvent | Event) => {
  let sX = 0
  let sY = 0
  let pX = 0
  let pY = 0

  if ("detail" in event) {
    sY = event.detail
  }

  // if ("wheelDelta" in a) {
  //   t = -a.wheelDelta / 120
  // }

  if ("deltaY" in event) {
    sY = -event.deltaY / 120
  }

  if ("deltaX" in event) {
    sX = -event.deltaX / 120
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ("axis" in event && event.axis === (event as any).HORIZONTAL_AXIS) {
    sX = sY
    sY = 0
  }

  pX = sX * PIXEL_STEP
  pY = sY * PIXEL_STEP

  if ("deltaY" in event) {
    pY = event.deltaY
  }

  if ("deltaX" in event) {
    pX = event.deltaX
  }

  if ((pX || pY) && event instanceof WheelEvent && event.deltaMode) {
    if (event.deltaMode === 1) {
      pX *= LINE_HEIGHT
      pY *= LINE_HEIGHT
    } else {
      pX *= PAGE_HEIGHT
      pY *= PAGE_HEIGHT
    }
  }

  if (pX && !sX) {
    sX = pX < 1 ? -1 : 1
  }

  if (pY && !sY) {
    sY = pY < 1 ? -1 : 1
  }

  return { spinX: sX, spinY: sY, pixelX: pX, pixelY: pY }
}
