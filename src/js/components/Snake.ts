import {
  BufferGeometry,
  Color,
  CubicBezierCurve3,
  DataTexture,
  DoubleSide,
  FloatType,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Line,
  LinearFilter,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector3,
} from "three"
import snakeFragHigh from "../../shaders/snake/snakeFrag.glsl?raw"
import snakeVertHigh from "../../shaders/snake/snakeVert.glsl?raw"
import ballFrag from "../../shaders/ball/ballFrag.glsl?raw"
import ballVert from "../../shaders/ball/ballVert.glsl?raw"
import { createCurveGenerator } from "../curves/CurveGenerator"
import { EndlessCurve } from "../curves/EndlessCurve"
import { Input } from "../utils/input"
import { Properties } from "../utils/properties"

/* -------------------------------------------------------------------------- */
/*                                    snake                                   */
/* -------------------------------------------------------------------------- */
export type SnakeOptions = {
  length?: number
  speed?: number
  spineSegments?: number
  radialSegments?: number
  texturePoints?: number
}

class SnakeObject extends Object3D {
  private curve?: EndlessCurve
  private mesh?: InstancedMesh
  private material?: ShaderMaterial

  private positionTex?: DataTexture
  private normalTex?: DataTexture

  private distance = 0
  private spineSegments?: number
  private radialSegments?: number
  private texturePoints?: number

  // Exposed for GUI
  config = {
    length: 10,
    speed: 16,
    spineSegments: 100,
    radialSegments: 8,
  }

  uniforms = {
    u_tPosition: { value: null as Texture | null },
    u_tNormal: { value: null as Texture | null },

    // Thickness profile
    u_tailRampEnd: { value: 0.74 },
    u_scaleMin: { value: 0.13 },
    u_scaleMax: { value: 0.65 },
    u_neckStart: { value: 0.74 },
    u_neckEnd: { value: 0.95 },
    u_neckDepth: { value: 0.3 },
    u_headStart: { value: 0.85 },
    u_headEnd: { value: 1.0 },
    u_headRadius: { value: 0.75 },
    u_headBulge: { value: 0.75 },

    // Cross-section radii (defines tube surface shape)
    u_radiusN: { value: 0.5 }, // normal direction (vertical)
    u_radiusB: { value: 0.8 }, // binormal direction (horizontal / flat)

    // Effects
    u_zOffset: { value: 0.2 },
    u_twistAmount: { value: 3.0 },

    // Instance geometry shaping
    u_instanceScaleX: { value: 0.5 }, // spine direction (along curve)
    u_instanceScaleY: { value: 0.43 }, // circumferential direction
    u_instanceScaleZ: { value: 0.1 }, // outward from surface

    // Spot coloring
    u_baseColor: { value: new Color(0x2a9d8f) }, // teal
    u_spotColor: { value: new Color(0xe76f51) }, // coral
    u_spotScale: { value: 5.0 },
    u_spotThreshold: { value: 0.6 },
    u_spotSmoothness: { value: 0.1 },
    u_spotIntensity: { value: 0.8 },
    u_spotOctaves: { value: 2 },
    u_spotPersistence: { value: 0.5 },
    u_spotLacunarity: { value: 2.0 },
    u_timeOffset: { value: 0.0 },
    u_animationSpeed: { value: 0.0 },

    // Lighting
    u_cameraPosition: { value: new Vector3() },
    u_lightDirection: { value: new Vector3(0.5, 1.0, 0.3).normalize() },
    u_specularPower: { value: 27.0 },
    u_specularIntensity: { value: 0.5 },
    u_fresnelPower: { value: 3.5 },
    u_fresnelIntensity: { value: 0.3 },

    // Normal Perturbation
    u_normalPerturbScale: { value: 20.0 },
    u_normalPerturbStrength: { value: 0.05 },
    u_normalPerturbOctaves: { value: 4 },

    // Anisotropic Highlights
    u_anisotropicStrength: { value: 0.35 },
    u_anisotropicRoughness: { value: 0.5 },

    // Color Variation
    u_bellyLightness: { value: 1 },
    u_bellyWidth: { value: 0.5 },
  }

  /* ---------------------------------- utils --------------------------------- */
  private createDataTexture(): DataTexture {
    const data = new Float32Array((this.texturePoints ?? 0) * 4)
    const texture = new DataTexture(data, this.texturePoints, 1, RGBAFormat, FloatType)
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.needsUpdate = true
    return texture
  }

  private createGeometry(): BufferGeometry {
    const spineSegments = this.spineSegments ?? 0
    const radialSegments = this.radialSegments ?? 0

    const instanceCount = spineSegments * radialSegments
    const geometry = new OctahedronGeometry(1, 1)

    // Per-instance attributes: spineU and theta (grid layout)
    const spineUs = new Float32Array(instanceCount)
    const thetas = new Float32Array(instanceCount)

    for (let row = 0; row < spineSegments; row++) {
      const u = spineSegments > 1 ? row / (spineSegments - 1) : 0
      for (let col = 0; col < radialSegments; col++) {
        const angle = (col / radialSegments) * Math.PI * 2
        const idx = row * radialSegments + col
        spineUs[idx] = u
        thetas[idx] = angle
      }
    }

    geometry.setAttribute("spineU", new InstancedBufferAttribute(spineUs, 1))
    geometry.setAttribute("theta", new InstancedBufferAttribute(thetas, 1))

    return geometry
  }

  private updateTextures(): void {
    if (!this.curve || !this.positionTex || !this.normalTex) return

    const posData = this.positionTex?.image.data as Float32Array
    const normData = this.normalTex?.image.data as Float32Array

    const texturePoints = this.texturePoints ?? 0
    for (let i = 0; i < texturePoints; i++) {
      const u = i / (texturePoints - 1)
      const basis = this.curve.getBasisAtLocal(u)

      const idx = i * 4
      posData[idx] = basis.position.x
      posData[idx + 1] = basis.position.y
      posData[idx + 2] = basis.position.z
      posData[idx + 3] = 1.0

      // Encode normals as 0-1 range
      normData[idx] = basis.normal.x * 0.5 + 0.5
      normData[idx + 1] = basis.normal.y * 0.5 + 0.5
      normData[idx + 2] = basis.normal.z * 0.5 + 0.5
      normData[idx + 3] = 1.0
    }

    this.positionTex.needsUpdate = true
    this.normalTex.needsUpdate = true
  }

  /* ------------------------------- constructor ------------------------------ */
  buildScene(curve: EndlessCurve, options: SnakeOptions = {}) {
    this.curve = curve
    this.config.length = options.length ?? 10
    this.config.speed = options.speed ?? 2
    this.config.spineSegments = options.spineSegments ?? 100
    this.config.radialSegments = options.radialSegments ?? 8
    this.spineSegments = this.config.spineSegments
    this.radialSegments = this.config.radialSegments
    this.texturePoints = options.texturePoints ?? 100

    // Create textures for curve data
    this.positionTex = this.createDataTexture()
    this.normalTex = this.createDataTexture()

    // Create instanced geometry
    const geometry = this.createGeometry()
    const instanceCount = this.spineSegments * this.radialSegments

    // Create material with quality-based shader selection
    const vertexShader = snakeVertHigh
    const fragmentShader = snakeFragHigh

    this.uniforms.u_tPosition.value = this.positionTex
    this.uniforms.u_tNormal.value = this.normalTex
    this.material = new ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: this.uniforms,
      side: DoubleSide,
    })

    // Create instanced mesh (frustumCulled=false because positions are computed in shader)
    this.mesh = new InstancedMesh(geometry, this.material, instanceCount)
    this.mesh.frustumCulled = false

    // Identity matrices — all positioning done in shader
    const matrix = new Matrix4()
    for (let i = 0; i < instanceCount; i++) {
      this.mesh.setMatrixAt(i, matrix)
    }

    this.add(this.mesh)
  }

  update(delta: number): void {
    this.distance += delta * this.config.speed
    this.curve?.configureStartEnd(this.distance, this.config.length)
    this.updateTextures()
    this.uniforms.u_timeOffset.value = this.distance * 0.1
  }

  dispose(): void {
    this.mesh?.geometry.dispose()
    this.material?.dispose()
    this.positionTex?.dispose()
    this.normalTex?.dispose()
  }

  /* --------------------------------- public --------------------------------- */
  getUniforms() {
    return this.uniforms
  }

  rebuildMesh(): void {
    this.spineSegments = this.config.spineSegments
    this.radialSegments = this.config.radialSegments
    const instanceCount = this.spineSegments * this.radialSegments

    // Dispose old mesh
    if (this.mesh) {
      this.remove(this.mesh)
      this.mesh.geometry.dispose()
    }

    // Create new geometry
    const geometry = this.createGeometry()

    // Create new instanced mesh
    this.mesh = new InstancedMesh(geometry, this.material, instanceCount)
    this.mesh.frustumCulled = false

    const matrix = new Matrix4()
    for (let i = 0; i < instanceCount; i++) {
      this.mesh.setMatrixAt(i, matrix)
    }

    this.add(this.mesh)
  }
}

/* -------------------------------------------------------------------------- */
/*                                    ball                                    */
/* -------------------------------------------------------------------------- */
class Ball {
  private config = {
    radius: 0.3,
    color: 0x44ddff,
    lerpFactor: 0.1,
  }

  // components
  sphere?: Mesh

  // uniforms
  uniforms = {
    u_color: { value: new Color(this.config.color) },
    u_lightDirection: { value: new Vector3(0.5, 1.0, 0.3).normalize() },
    u_cameraPosition: { value: new Vector3() },
    u_emissiveIntensity: { value: 0.6 },
    u_specularPower: { value: 32.0 },
    u_fresnelPower: { value: 2.5 },
  }

  /* ---------------------------------- main ---------------------------------- */
  buildScene() {
    const geometry = new SphereGeometry(this.config.radius, 32, 32)

    // Create shader material with lighting uniforms
    const material = new ShaderMaterial({
      vertexShader: ballVert,
      fragmentShader: ballFrag,
      uniforms: this.uniforms,
    })

    this.sphere = new Mesh(geometry, material)

    return this.sphere
  }
}

/* -------------------------------------------------------------------------- */
/*                                    main                                    */
/* -------------------------------------------------------------------------- */
export class Snake {
  // components
  snakeObject: SnakeObject
  endlessCurve?: EndlessCurve
  private curveOptions: import("../curves/CurveGenerator").CurveGeneratorOptions = {}
  private ball?: Ball

  // sphere
  private targetSpherePosition = new Vector3()

  // raycasting for mouse attraction
  private raycaster = new Raycaster()
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0)
  private mouseTarget = new Vector3()

  // debug
  debugLine?: Line
  debugTarget?: Mesh
  debugCP1?: Mesh
  debugCP2?: Mesh
  debugHandle1?: Line
  debugHandle2?: Line

  /* ---------------------------------- utils --------------------------------- */
  private setupDebug(group: Group): void {
    // Create debug curve line
    const lineGeometry = new BufferGeometry()
    const lineMaterial = new LineBasicMaterial({ color: 0x00ff00 })
    this.debugLine = new Line(lineGeometry, lineMaterial)
    group.add(this.debugLine)

    // Create debug target sphere (mouse position on ground)
    const targetGeom = new SphereGeometry(0.5, 16, 16)
    const targetMat = new MeshBasicMaterial({ color: 0xff0000 })
    this.debugTarget = new Mesh(targetGeom, targetMat)
    group.add(this.debugTarget)

    // Create control point debug spheres
    const cpGeom = new SphereGeometry(0.3, 8, 8)
    this.debugCP1 = new Mesh(cpGeom, new MeshBasicMaterial({ color: 0x0088ff })) // blue
    this.debugCP2 = new Mesh(cpGeom, new MeshBasicMaterial({ color: 0xffff00 })) // yellow
    group.add(this.debugCP1, this.debugCP2)

    // Create handle lines (start->cp1, cp2->end)
    const handleGeom1 = new BufferGeometry()
    const handleGeom2 = new BufferGeometry()
    this.debugHandle1 = new Line(handleGeom1, new LineBasicMaterial({ color: 0x0088ff })) // blue
    this.debugHandle2 = new Line(handleGeom2, new LineBasicMaterial({ color: 0xffff00 })) // yellow
    group.add(this.debugHandle1, this.debugHandle2)

    // GUI controls
    if (!Properties.gui || !this.snakeObject) return

    const uniforms = this.snakeObject.getUniforms()
    const config = this.snakeObject.config
    const folder = Properties.gui.addFolder("Snake Shape")

    // Movement
    folder.add(config, "length", 1, 30, 1).name("Length")
    folder.add(config, "speed", 0.5, 10, 0.5).name("Speed")

    // Grid resolution (rebuild mesh on change)
    folder
      .add(config, "spineSegments", 10, 300, 10)
      .name("Spine Segments")
      .onChange(() => this.snakeObject?.rebuildMesh())
    folder
      .add(config, "radialSegments", 3, 16, 1)
      .name("Radial Segments")
      .onChange(() => this.snakeObject?.rebuildMesh())

    // Thickness profile
    folder.add(uniforms.u_tailRampEnd, "value", 0.01, 1.0, 0.01).name("Tail Ramp End")
    folder.add(uniforms.u_headStart, "value", 0.5, 1.0, 0.01).name("Head Start")
    folder.add(uniforms.u_headEnd, "value", 0.5, 1.0, 0.01).name("Head End")
    folder.add(uniforms.u_headRadius, "value", 0.0, 2.0, 0.01).name("Head Radius")
    folder.add(uniforms.u_neckStart, "value", 0.5, 0.98, 0.01).name("Neck Start")
    folder.add(uniforms.u_neckEnd, "value", 0.5, 0.98, 0.01).name("Neck End")
    folder.add(uniforms.u_neckDepth, "value", 0, 0.5, 0.05).name("Neck Depth")
    folder.add(uniforms.u_headBulge, "value", 0, 1.0, 0.05).name("Head Bulge")

    // Scale
    folder.add(uniforms.u_scaleMin, "value", 0.0, 0.5, 0.01).name("Scale Min")
    folder.add(uniforms.u_scaleMax, "value", 0.1, 3.0, 0.01).name("Scale Max")

    // Cross-section radii (tube surface shape)
    folder.add(uniforms.u_radiusN, "value", 0.05, 3.0, 0.05).name("Radius N (vert)")
    folder.add(uniforms.u_radiusB, "value", 0.05, 3.0, 0.05).name("Radius B (horiz)")

    // Effects
    folder.add(uniforms.u_zOffset, "value", -1, 1, 0.05).name("Belly Offset")
    folder.add(uniforms.u_twistAmount, "value", 0, 20, 0.5).name("Twist Amount")

    // Instance shape
    folder.add(uniforms.u_instanceScaleX, "value", 0.01, 2.0, 0.01).name("Inst Scale X (spine)")
    folder.add(uniforms.u_instanceScaleY, "value", 0.01, 2.0, 0.01).name("Inst Scale Y (circ)")
    folder.add(uniforms.u_instanceScaleZ, "value", 0.01, 2.0, 0.01).name("Inst Scale Z (out)")

    folder.close()

    // Spot coloring controls
    const spotFolder = Properties.gui.addFolder("Spot Coloring")
    spotFolder.addColor(uniforms.u_baseColor, "value").name("Base Color")
    spotFolder.addColor(uniforms.u_spotColor, "value").name("Spot Color")
    spotFolder.add(uniforms.u_spotScale, "value", 1.0, 30.0, 0.5).name("Spot Scale")
    spotFolder.add(uniforms.u_spotThreshold, "value", 0.0, 1.0, 0.05).name("Threshold")
    spotFolder.add(uniforms.u_spotSmoothness, "value", 0.01, 0.5, 0.01).name("Smoothness")
    spotFolder.add(uniforms.u_spotIntensity, "value", 0.0, 1.0, 0.05).name("Intensity")
    spotFolder.add(uniforms.u_spotOctaves, "value", 1, 4, 1).name("Octaves")
    spotFolder.add(uniforms.u_spotPersistence, "value", 0.1, 1.0, 0.05).name("Persistence")
    spotFolder.add(uniforms.u_spotLacunarity, "value", 1.5, 4.0, 0.1).name("Lacunarity")
    spotFolder.add(uniforms.u_animationSpeed, "value", 0.0, 2.0, 0.1).name("Animation Speed")
    spotFolder.open()

    // Lighting controls
    const lightingFolder = Properties.gui.addFolder("Lighting")
    lightingFolder.add(uniforms.u_specularPower, "value", 4.0, 128.0, 1.0).name("Specular Power")
    lightingFolder.add(uniforms.u_specularIntensity, "value", 0.0, 2.0, 0.1).name("Specular Intensity")
    lightingFolder.add(uniforms.u_fresnelPower, "value", 1.0, 5.0, 0.1).name("Fresnel Power")
    lightingFolder.add(uniforms.u_fresnelIntensity, "value", 0.0, 1.0, 0.05).name("Fresnel Intensity")
    // Light direction controls
    lightingFolder
      .add(uniforms.u_lightDirection.value, "x", -1, 1, 0.1)
      .name("Light X")
      .onChange(() => {
        uniforms.u_lightDirection.value.normalize()
      })
    lightingFolder
      .add(uniforms.u_lightDirection.value, "y", -1, 1, 0.1)
      .name("Light Y")
      .onChange(() => {
        uniforms.u_lightDirection.value.normalize()
      })
    lightingFolder
      .add(uniforms.u_lightDirection.value, "z", -1, 1, 0.1)
      .name("Light Z")
      .onChange(() => {
        uniforms.u_lightDirection.value.normalize()
      })
    lightingFolder.open()

    // Normal Perturbation controls (bumpy scale texture)
    const normalFolder = Properties.gui.addFolder("Normal Perturbation")
    normalFolder.add(uniforms.u_normalPerturbScale, "value", 5.0, 50.0, 1.0).name("Bump Scale")
    normalFolder.add(uniforms.u_normalPerturbStrength, "value", 0.0, 1.0, 0.05).name("Bump Strength")
    normalFolder.add(uniforms.u_normalPerturbOctaves, "value", 1, 6, 1).name("Bump Octaves")
    normalFolder.open()

    // Anisotropic Highlight controls (elongated reflections)
    const anisotropicFolder = Properties.gui.addFolder("Anisotropic Highlights")
    anisotropicFolder.add(uniforms.u_anisotropicStrength, "value", 0.0, 1.0, 0.05).name("Anisotropic Strength")
    anisotropicFolder.add(uniforms.u_anisotropicRoughness, "value", 0.1, 1.0, 0.05).name("Anisotropic Roughness")
    anisotropicFolder.open()

    // Color Variation controls (belly lighter than back)
    const colorVarFolder = Properties.gui.addFolder("Color Variation")
    colorVarFolder.add(uniforms.u_bellyLightness, "value", 0.0, 2.0, 0.1).name("Belly Lightness")
    colorVarFolder.add(uniforms.u_bellyWidth, "value", 0.1, 1.0, 0.05).name("Belly Width")
    colorVarFolder.open()

    // Curve behavior controls (boids-style)
    const curveFolder = Properties.gui.addFolder("Curve Behavior")
    const opts = this.curveOptions as Required<typeof this.curveOptions>

    // Turn rate
    curveFolder.add(opts, "maxTurnRate", 0.1, Math.PI / 2, 0.05).name("Max Turn Rate")

    // Orbit
    curveFolder.add(opts, "orbitRadius", 0.5, 10, 0.1).name("Orbit Radius")

    // Force weights
    curveFolder.add(opts, "orbitWeight", 0, 2, 0.1).name("Orbit Weight")
    curveFolder.add(opts, "wanderWeight", 0, 1, 0.05).name("Wander Weight")

    // Wander
    curveFolder.add(opts, "wanderStrength", 0, Math.PI / 4, 0.05).name("Wander Strength")
    curveFolder.add(opts, "tiltStrength", 0, Math.PI / 8, 0.05).name("Tilt Strength")

    // Coil
    curveFolder.add(opts, "coilAmplitude", 0, 10, 0.5).name("Coil Amplitude")
    curveFolder.add(opts, "coilFrequency", 0.1, 2, 0.05).name("Coil Frequency")
    curveFolder.close()
  }

  /* ---------------------------------- main ---------------------------------- */
  constructor() {
    this.snakeObject = new SnakeObject()
  }

  buildScene() {
    const group = new Group()

    // Get quality-based configuration
    const config = Properties.getSnakeConfig()

    // Calculate orbit radius based on viewport width for responsive behavior
    // Small screens (mobile): 1.2, Large screens (desktop): 2.5
    const orbitRadius = Math.max(1.0, Math.min(2.5, Properties.viewportWidth / 800))

    // Create endless curve with boids-style steering
    this.curveOptions = {
      segmentLength: { min: 4, max: 8 },
      // Turn rate limit (only smoothing mechanism)
      maxTurnRate: 1.15, // 30° per segment

      // Orbit behavior (viewport-responsive)
      orbitRadius: orbitRadius,

      // Force weights
      orbitWeight: 1.0,
      wanderWeight: 0.2,

      // Wander
      wanderStrength: Math.PI / 12, // 15°
      tiltStrength: Math.PI / 24, // 7.5°

      // Coil
      coilAmplitude: 3.0,
      coilFrequency: 0.25,
    }
    const curveGenerator = createCurveGenerator(this.curveOptions)
    const endlessCurve = new EndlessCurve(curveGenerator)
    this.endlessCurve = endlessCurve

    // Apply quality-based scale values
    this.snakeObject.uniforms.u_scaleMin.value = config.scaleMin
    this.snakeObject.uniforms.u_scaleMax.value = config.scaleMax

    // Create snake with quality-appropriate settings
    this.snakeObject.buildScene(endlessCurve, {
      length: config.length,
      speed: 4,
      spineSegments: config.spineSegments,
      radialSegments: config.radialSegments,
      texturePoints: config.texturePoints,
    })
    group.add(this.snakeObject)

    // Create target sphere
    this.ball = new Ball()
    group.add(this.ball.buildScene())

    // Setup debug visuals and GUI only when enabled
    if (config.enableDebug) {
      this.setupDebug(group)
    }

    return group
  }

  resize() {}

  update(camera: PerspectiveCamera, delta: number): void {
    // raycast
    this.raycaster.setFromCamera(Input.mouseXY, camera)
    this.raycaster.ray.intersectPlane(this.groundPlane, this.mouseTarget)

    // lerp mouse
    this.targetSpherePosition.lerp(this.mouseTarget, 0.1)

    // Update target sphere visual position and shader uniforms
    if (this.ball) {
      this.ball.sphere?.position.copy(this.targetSpherePosition)
      this.ball.uniforms.u_cameraPosition.value.copy(camera.position)
    }

    // update curve
    this.endlessCurve?.setTarget(this.targetSpherePosition)

    // update snake
    this.snakeObject?.update(delta)
    this.snakeObject.uniforms.u_cameraPosition.value.copy(camera.position)

    // Update debug visualizations only in development
    if (import.meta.env.DEV) {
      // Update debug target position
      this.debugTarget?.position.copy(this.mouseTarget)

      // Update debug curve line
      if (this.debugLine && this.endlessCurve) {
        const points: Vector3[] = []
        for (let i = 0; i <= 50; i++) {
          const u = i / 50
          points.push(this.endlessCurve.getPointAtLocal(u))
        }
        this.debugLine.geometry.setFromPoints(points)

        // Update control point debug spheres (show last curve segment)
        if (this.debugCP1 && this.debugCP2) {
          const curves = this.endlessCurve.curves
          if (curves.length > 0) {
            const lastCurve = curves[curves.length - 1] as CubicBezierCurve3
            this.debugCP1.position.copy(lastCurve.v1) // cp1
            this.debugCP2.position.copy(lastCurve.v2) // cp2

            // Update handle lines
            if (this.debugHandle1 && this.debugHandle2) {
              this.debugHandle1.geometry.setFromPoints([lastCurve.v0, lastCurve.v1])
              this.debugHandle2.geometry.setFromPoints([lastCurve.v2, lastCurve.v3])
            }
          }
        }
      }
    }
  }
}
