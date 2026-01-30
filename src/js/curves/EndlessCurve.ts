import { CubicBezierCurve3, CurvePath, Vector3 } from "three"

/* -------------------------------------------------------------------------- */
/*                                    types                                   */
/* -------------------------------------------------------------------------- */
export type CurveBasis = {
  position: Vector3
  normal: Vector3
  tangent: Vector3
}

/* -------------------------------------------------------------------------- */
/*                                    utils                                   */
/* -------------------------------------------------------------------------- */
/**
 * Get analytical tangent for cubic bezier curve.
 * Three.js uses numerical differentiation which introduces errors at boundaries.
 * For t=0 and t=1, use exact derivative formula instead.
 */
function getAnalyticalTangent(curve: CubicBezierCurve3, t: number): Vector3 {
  if (t === 0) {
    // derivative at t=0 is proportional to (CP1 - P0)
    return curve.v1.clone().sub(curve.v0).normalize()
  } else if (t === 1) {
    // derivative at t=1 is proportional to (P3 - CP2)
    return curve.v3.clone().sub(curve.v2).normalize()
  } else {
    // for interior points, Three.js numerical differentiation is fine
    return curve.getTangentAt(t).normalize()
  }
}

/* -------------------------------------------------------------------------- */
/*                                    main                                    */
/* -------------------------------------------------------------------------- */
/**
 * An endless curve that generates new segments on demand and removes old ones.
 * Uses parallel transport (rotation-minimizing frame) for smooth normal computation.
 */
export class EndlessCurve extends CurvePath<Vector3> {
  private distanceOffset = 0
  private uStart = 0
  private uLength = 1
  private nextCurveFn: (target?: Vector3) => CubicBezierCurve3
  private target?: Vector3

  // parallel transport frame cache
  private frameCache: { normals: Vector3[]; uValues: number[] } = { normals: [], uValues: [] }
  private samplesPerCurve = 10
  private lastNormal = new Vector3(0, 1, 0)

  /* -------------------------------- public api ------------------------------ */
  setTarget(target: Vector3): void {
    this.target = target
  }

  /* --------------------------------- helpers -------------------------------- */
  private localDistance(globalDistance: number): number {
    return globalDistance - this.distanceOffset
  }

  private getLengthSafe(): number {
    if (!this.curves.length) return 0
    return this.getLength()
  }

  /* ---------------------------- curve management ---------------------------- */
  /**
   * Add a curve and compute parallel transport frames for it.
   */
  addCurve(curve: CubicBezierCurve3): void {
    const curveIndex = this.curves.length
    this.curves.push(curve)

    // invalidate length cache
    ;(this as unknown as { cacheLengths: number[] | null }).cacheLengths = null

    // compute frames for new curve segment
    this.computeFramesForCurve(curveIndex)
  }

  /* ------------------------ frame computation (PTF) ------------------------- */
  // ptf = Parallel Transport Frame (rotation-minimizing)

  /**
   * Compute parallel transport frames for a curve segment.
   */
  private computeFramesForCurve(curveIndex: number): void {
    const curve = this.curves[curveIndex] as CubicBezierCurve3

    // get the previous normal and tangent
    let prevNormal = this.lastNormal.clone()
    let prevTangent: Vector3

    if (curveIndex > 0) {
      const prevCurve = this.curves[curveIndex - 1] as CubicBezierCurve3
      // use analytical tangent at boundary for exact match
      prevTangent = getAnalyticalTangent(prevCurve, 1)
    } else {
      // use analytical tangent at boundary for exact match
      prevTangent = getAnalyticalTangent(curve, 0)
      // ensure initial normal is perpendicular to initial tangent
      prevNormal = this.getArbitraryPerpendicular(prevTangent)
    }

    // sample frames along this curve
    for (let i = 0; i <= this.samplesPerCurve; i++) {
      const localU = i / this.samplesPerCurve
      // use analytical tangent at boundaries (0 and 1) for exact continuity
      const tangent = getAnalyticalTangent(curve, localU)

      // parallel transport: rotate previous normal to be perpendicular to new tangent
      const normal = this.parallelTransport(prevNormal, prevTangent, tangent)

      this.frameCache.normals.push(normal.clone())
      // u values will be recalculated when needed
      this.frameCache.uValues.push(0)

      prevNormal = normal
      prevTangent = tangent
    }

    // store last normal for next curve
    this.lastNormal = prevNormal.clone()

    // recalculate all u values
    this.recalculateUValues()
  }

  /**
   * Parallel transport algorithm: rotate the normal to stay perpendicular to the new tangent
   * while minimizing rotation.
   */
  private parallelTransport(prevNormal: Vector3, prevTangent: Vector3, newTangent: Vector3): Vector3 {
    const dot = prevTangent.dot(newTangent)

    // if tangents are nearly parallel, just project the normal
    if (dot > 0.9999) {
      return prevNormal.clone()
    }

    // compute rotation axis (perpendicular to both tangents)
    const axis = new Vector3().crossVectors(prevTangent, newTangent)

    if (axis.lengthSq() < 0.0001) {
      // tangents are anti-parallel (180 degree turn) - use any perpendicular axis
      axis.set(1, 0, 0)
      if (Math.abs(prevTangent.dot(axis)) > 0.9) {
        axis.set(0, 1, 0)
      }
      axis.crossVectors(axis, prevTangent).normalize()
    } else {
      axis.normalize()
    }

    // compute rotation angle
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))

    // rotate the normal
    const rotatedNormal = prevNormal.clone()
    rotatedNormal.applyAxisAngle(axis, angle)

    // ensure orthogonality (project onto plane perpendicular to new tangent)
    rotatedNormal.sub(newTangent.clone().multiplyScalar(rotatedNormal.dot(newTangent)))
    rotatedNormal.normalize()

    return rotatedNormal
  }

  /**
   * Get an arbitrary vector perpendicular to the given vector.
   */
  private getArbitraryPerpendicular(v: Vector3): Vector3 {
    const up = new Vector3(0, 1, 0)
    if (Math.abs(v.dot(up)) > 0.9) {
      up.set(1, 0, 0)
    }
    return new Vector3().crossVectors(v, up).normalize()
  }

  /**
   * Recalculate u values for all cached frames based on current curve lengths.
   */
  private recalculateUValues(): void {
    if (this.curves.length === 0) return

    const totalLength = this.getLength()
    const curveLengths = this.getCurveLengths()

    let frameIndex = 0
    for (let curveIndex = 0; curveIndex < this.curves.length; curveIndex++) {
      const startLength = curveIndex > 0 ? curveLengths[curveIndex - 1] : 0
      const endLength = curveLengths[curveIndex]
      const curveLength = endLength - startLength

      for (let i = 0; i <= this.samplesPerCurve; i++) {
        if (frameIndex >= this.frameCache.uValues.length) break
        const localU = i / this.samplesPerCurve
        this.frameCache.uValues[frameIndex] = (startLength + curveLength * localU) / totalLength
        frameIndex++
      }
    }
  }

  /* ------------------------- frame interpolation ---------------------------- */
  /**
   * Interpolate normal from the frame cache at parameter u.
   */
  private interpolateNormal(u: number): Vector3 {
    const cache = this.frameCache

    if (cache.normals.length === 0) {
      // fallback: compute arbitrary perpendicular
      const tangent = this.getTangentAt(u).normalize()
      return this.getArbitraryPerpendicular(tangent)
    }

    if (cache.normals.length === 1) {
      return cache.normals[0].clone()
    }

    // binary search for surrounding samples
    let low = 0
    let high = cache.uValues.length - 1

    // handle edge cases
    if (u <= cache.uValues[0]) {
      return cache.normals[0].clone()
    }
    if (u >= cache.uValues[high]) {
      return cache.normals[high].clone()
    }

    while (low < high - 1) {
      const mid = Math.floor((low + high) / 2)
      if (cache.uValues[mid] <= u) {
        low = mid
      } else {
        high = mid
      }
    }

    // linear interpolation factor
    const uLow = cache.uValues[low]
    const uHigh = cache.uValues[high]
    const t = uHigh > uLow ? (u - uLow) / (uHigh - uLow) : 0

    // lerp between normals and normalize
    const normal = cache.normals[low].clone().lerp(cache.normals[high], t).normalize()

    return normal
  }

  /* -------------------------- basis computation ----------------------------- */
  /**
   * Get the position, normal, and tangent at parameter u along the curve.
   */
  getBasisAt(u: number): CurveBasis {
    const position = this.getPointAt(u)
    const tangent = this.getTangentAt(u).normalize()
    const normal = this.interpolateNormal(u)

    return { position, normal, tangent }
  }

  /* ------------------------ curve stream management ------------------------- */
  // dynamic curve generation and removal

  fillLength(length: number): void {
    const localLen = this.localDistance(length)
    const currentLen = this.getLengthSafe()

    if (localLen < currentLen) return

    const newCurve = this.nextCurveFn(this.target)
    this.addCurve(newCurve)
    this.fillLength(length)
  }

  removeCurvesBefore(position: number): void {
    const p = this.localDistance(position)
    const lengths = this.getCurveLengths()

    let remove = 0
    let distanceOffset = 0

    for (let i = 0; i < lengths.length; i++) {
      if (p < lengths[i]) break
      distanceOffset = lengths[i]
      remove++
    }

    if (remove) {
      this.distanceOffset += distanceOffset
      this.curves = this.curves.slice(remove)

      // remove corresponding frames from cache
      const framesToRemove = remove * (this.samplesPerCurve + 1)
      this.frameCache.normals = this.frameCache.normals.slice(framesToRemove)
      this.frameCache.uValues = this.frameCache.uValues.slice(framesToRemove)

      // reset internal cache
      ;(this as unknown as { cacheLengths: number[] | null }).cacheLengths = null

      // recalculate u values for remaining frames
      this.recalculateUValues()
    }
  }

  configureStartEnd(position: number, length: number): void {
    this.fillLength(position + length)
    this.removeCurvesBefore(position)

    const localPos = this.localDistance(position)
    const totalLen = this.getLengthSafe()

    this.uStart = totalLen > 0 ? localPos / totalLen : 0
    this.uLength = totalLen > 0 ? length / totalLen : 1
  }

  /* ----------------------- local coordinate system -------------------------- */
  getPointAtLocal(u: number): Vector3 {
    const u2 = this.uStart + this.uLength * u
    return this.getPointAt(Math.min(u2, 1))
  }

  getBasisAtLocal(u: number): CurveBasis {
    const u2 = this.uStart + this.uLength * u
    return this.getBasisAt(Math.min(u2, 1))
  }

  /* ---------------------------------- main ---------------------------------- */
  constructor(nextCurveFn: (target?: Vector3) => CubicBezierCurve3) {
    super()
    this.nextCurveFn = nextCurveFn
  }
}
