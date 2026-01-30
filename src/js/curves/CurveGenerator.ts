import { createNoise2D } from "simplex-noise"
import { CubicBezierCurve3, Vector3 } from "three"

/* -------------------------------------------------------------------------- */
/*                              Steering Forces                               */
/* -------------------------------------------------------------------------- */
/**
 * Wander force: returns noise-based direction for organic movement
 */
function wanderForce(
  currentDir: Vector3,
  noise2D: (x: number, y: number) => number,
  noiseTime: number,
  wanderStrength: number,
  tiltStrength: number
): Vector3 {
  const result = currentDir.clone()

  // Horizontal wander
  const wanderNoise = noise2D(noiseTime, 0)
  const wanderAngle = wanderNoise * wanderStrength
  const up = new Vector3(0, 1, 0)
  result.applyAxisAngle(up, wanderAngle)

  // Vertical tilt
  const tiltNoise = noise2D(noiseTime, 100)
  const tiltAngle = tiltNoise * tiltStrength
  const side = new Vector3().crossVectors(up, result)
  if (side.lengthSq() > 0.01) {
    side.normalize()
    result.applyAxisAngle(side, tiltAngle)
  }

  return result.normalize()
}

/**
 * Limit turn rate: rotate toward desired direction, capped at maxRate
 * Uses axis-angle rotation instead of lerp (lerp fails for large angles)
 */
function limitTurnRate(current: Vector3, desired: Vector3, maxRate: number): Vector3 {
  const angle = current.angleTo(desired)
  if (angle <= maxRate) return desired.clone()
  if (angle < 0.001) return current.clone()

  // Calculate rotation axis (perpendicular to both vectors)
  const axis = new Vector3().crossVectors(current, desired)

  // Handle parallel/anti-parallel case
  if (axis.lengthSq() < 0.0001) {
    // Find any perpendicular axis
    axis.set(0, 1, 0)
    if (Math.abs(current.y) > 0.9) axis.set(1, 0, 0)
    axis.crossVectors(current, axis).normalize()
  } else {
    axis.normalize()
  }

  // Rotate current toward desired by exactly maxRate
  return current.clone().applyAxisAngle(axis, maxRate)
}

/* -------------------------------------------------------------------------- */
/*                              Options & Export                              */
/* -------------------------------------------------------------------------- */

export type CurveGeneratorOptions = {
  segmentLength?: { min: number; max: number }

  // Turn rate limit (radians per segment)
  maxTurnRate?: number

  // Orbit behavior
  orbitRadius?: number

  // Force weights
  orbitWeight?: number
  wanderWeight?: number

  // Wander parameters
  wanderStrength?: number
  tiltStrength?: number

  // Coil parameters
  coilAmplitude?: number // vertical extent of coil
  coilFrequency?: number // oscillations per orbit revolution
}

/**
 * Creates a boids-style curve generator with clean force-based steering.
 * No momentum accumulation - just forces + turn rate limiting.
 */
export function createCurveGenerator(options: CurveGeneratorOptions = {}): (target?: Vector3) => CubicBezierCurve3 {
  // Set defaults
  options.segmentLength ??= { min: 4, max: 8 }
  options.maxTurnRate ??= Math.PI / 6 // 30° per segment
  options.orbitRadius ??= 8
  options.orbitWeight ??= 1.0
  options.wanderWeight ??= 0.15 // gentler blend
  options.wanderStrength ??= Math.PI / 24 // 7.5° - much gentler
  options.tiltStrength ??= Math.PI / 48 // 3.75° - subtle vertical movement
  options.coilAmplitude ??= 3.0
  options.coilFrequency ??= 0.25 // 4 orbit revolutions per full up-down cycle

  // noise for wander
  const noise2D = createNoise2D()

  // state
  let lastPoint = new Vector3(0, 0, 0)
  let lastDir = new Vector3(1, 0, 0)

  let noiseTime = 0
  let orbitAngle = 0 // accumulated orbit phase (radians)
  let coilActivation = 0 // 0..1 smooth ramp

  /* ---------------------------------- main ---------------------------------- */
  return function nextCurve(target?: Vector3): CubicBezierCurve3 {
    // read options (allows GUI updates)
    const segmentLength = options.segmentLength!
    const maxTurnRate = options.maxTurnRate!
    const orbitRadius = options.orbitRadius!
    const orbitWeight = options.orbitWeight!
    const wanderWeight = options.wanderWeight!
    const wanderStrength = options.wanderStrength!
    const tiltStrength = options.tiltStrength!
    const coilAmplitude = options.coilAmplitude!
    const coilFrequency = options.coilFrequency!

    // segment length
    const length = segmentLength.min + Math.random() * (segmentLength.max - segmentLength.min)

    // update time
    noiseTime += 0.01

    /* ----------------------------- steering force ----------------------------- */
    let desiredDir = new Vector3()

    // seek force
    if (target) {
      // get target
      const toTarget = target.clone().sub(lastPoint)
      const dist = toTarget.length()
      const targetDir = toTarget.normalize()
      const tangent = new Vector3(-targetDir.z, 0, targetDir.x)

      // update coil
      const isOrbiting = dist < orbitRadius * 1.5
      if (isOrbiting) {
        const circumference = 2 * Math.PI * orbitRadius
        const arcFraction = length / circumference
        orbitAngle += arcFraction * 2 * Math.PI
        coilActivation = Math.min(1, coilActivation + 0.15)
      } else {
        coilActivation = Math.max(0, coilActivation - 0.15)
      }

      // update direction
      if (dist > orbitRadius * 1.5) {
        // seek directly toward target
        desiredDir = targetDir
      } else {
        // orbit with radius correction
        const radiusError = dist - orbitRadius
        const radialStrength = radiusError * 0.1

        // coil - vertical oscillation (derivative of sin = cos)
        const coilY = coilAmplitude * coilFrequency * Math.cos(coilFrequency * orbitAngle) * coilActivation
        const coilTangent = new Vector3(tangent.x, coilY, tangent.z)

        desiredDir = coilTangent.clone().addScaledVector(targetDir, radialStrength).normalize()
      }
    } else {
      // update direction
      desiredDir.add(lastDir.clone().multiplyScalar(orbitWeight))
    }

    // wander force (additive blend for organic movement)
    const wander = wanderForce(lastDir, noise2D, noiseTime, wanderStrength, tiltStrength)
    const wanderDelta = wander.clone().sub(lastDir)
    desiredDir.add(wanderDelta.multiplyScalar(wanderWeight))

    // normalise
    if (desiredDir.lengthSq() > 0.001) {
      desiredDir.normalize()
    } else {
      desiredDir = lastDir.clone()
    }

    /* --------------------------------- bounds --------------------------------- */
    // update angle limit
    const newDir = limitTurnRate(lastDir, desiredDir, maxTurnRate)

    /* -------------------------------- generate -------------------------------- */
    // calculate endpoint
    const endPoint = lastPoint.clone().add(newDir.clone().multiplyScalar(length))

    // control distance - longer handles for sharper turns = smoother curves
    const turnAngle = lastDir.angleTo(newDir)
    const turnFactor = Math.min(1, turnAngle / (Math.PI / 2)) // 0 for straight, 1 for 90°
    const controlDist = length * (0.33 + 0.34 * turnFactor) // 0.33-0.67 of length

    const cp1 = lastPoint.clone().add(lastDir.clone().multiplyScalar(controlDist))
    const cp2 = endPoint.clone().sub(newDir.clone().multiplyScalar(controlDist))

    // create curve
    const curve = new CubicBezierCurve3(lastPoint.clone(), cp1, cp2, endPoint.clone())

    /* ------------------------------- post update ------------------------------ */
    // update state
    lastPoint = endPoint.clone()
    lastDir = newDir.clone()

    return curve
  }
}
