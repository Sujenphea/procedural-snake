import { NoToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from "three"
import "../css/style.css"
import { Snake } from "./components/Snake"
import { RAFCollection } from "./utils/RAFCollection"
import { Input } from "./utils/input"
import { Properties } from "./utils/properties"

class App {
  gl: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera

  // components
  snake: Snake

  // variables
  dateTime = performance.now()
  size = { width: 0, height: 0 }
  isContextLost = false

  // Pre-bound methods to avoid creating new functions
  private boundUpdate = this.update.bind(this)
  private boundResize = this.resize.bind(this)

  /* ---------------------------------- main ---------------------------------- */
  constructor() {
    // init viewport
    Properties.viewportWidth = window.innerWidth
    Properties.viewportHeight = window.innerHeight

    // get config
    const config = Properties.getSnakeConfig()

    // setup gl
    this.gl = new WebGLRenderer({
      alpha: false,
      antialias: config.shaderQuality === "high",
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    })
    this.gl.outputColorSpace = SRGBColorSpace
    this.gl.toneMapping = NoToneMapping
    this.gl.setSize(window.innerWidth, window.innerHeight)

    this.gl.domElement.id = "canvas"
    this.gl.domElement.setAttribute("aria-hidden", "true")
    this.gl.domElement.style.position = "fixed"
    this.gl.domElement.style.left = "0px"
    this.gl.domElement.style.top = "0px"
    this.gl.domElement.style.pointerEvents = "none"
    this.gl.setPixelRatio(config.dpr)
    document.body.prepend(this.gl.domElement)

    // Handle WebGL context loss (common on mobile when backgrounding app)
    this.gl.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault()
      console.warn("WebGL context lost")
      this.isContextLost = true
    })

    this.gl.domElement.addEventListener("webglcontextrestored", () => {
      console.log("WebGL context restored")
      this.isContextLost = false
      // Rebuild scene after context restoration
      this.buildScene()
    })

    // setup scene
    this.scene = new Scene()
    this.camera = new PerspectiveCamera(45, Properties.viewportWidth / Properties.viewportHeight, 0.1, 200)
    this.camera.position.set(0, 15, 20)
    this.camera.lookAt(0, 0, 0)

    // pre init
    Input.preInit()

    // init components
    this.snake = new Snake()
    this.buildScene()

    // Add resize listener
    this.resize()
    window.addEventListener("resize", this.boundResize)
    this.update()
  }

  load() {}

  resize() {
    const sizerEl = document.getElementById("sizer")

    // fallback to window dimensions
    const newWidth = sizerEl ? sizerEl.getBoundingClientRect().width : window.innerWidth
    const newHeight = sizerEl ? sizerEl.getBoundingClientRect().height : window.innerHeight

    // update
    if (this.size.width !== newWidth || this.size.height !== newHeight) {
      Properties.viewportWidth = newWidth
      Properties.viewportHeight = newHeight

      Input.updateViewportCache()

      this.size.width = newWidth
      this.size.height = newHeight

      this.gl.setSize(newWidth, newHeight)

      this.camera.aspect = newWidth / newHeight
      this.camera.updateProjectionMatrix()
    }
  }

  buildScene() {
    this.scene.add(this.snake.buildScene())
  }

  update() {
    window.requestAnimationFrame(this.boundUpdate)

    // Skip rendering if WebGL context is lost
    if (this.isContextLost) {
      return
    }

    // get time
    const currDateTime = performance.now()
    let delta = (currDateTime - this.dateTime) / 1e3
    this.dateTime = currDateTime
    delta = Math.min(delta, 1 / 20)

    // update
    RAFCollection.forEach((callback) => callback(delta))

    // update components
    this.snake.update(this.camera, delta)

    // render
    this.gl.render(this.scene, this.camera)

    // post update
    Input.postUpdate()
  }

  // Clean up resources on page unload
  destroy() {
    // Remove resize listener
    window.removeEventListener("resize", this.boundResize)

    // Cleanup input event listeners
    Input.destroy()

    // Dispose Three.js resources
    this.gl.dispose()
  }
}

// Store app instance for cleanup
let app: App | null = null

window.addEventListener("load", () => {
    app = new App()
})

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (app) {
    app.destroy()
  }
})
