import GUI from "three/examples/jsm/libs/lil-gui.module.min.js"

export type QualityLevel = "low" | "medium" | "high"

export interface SnakeConfig {
  length: number
  spineSegments: number
  radialSegments: number
  texturePoints: number
  dpr: number
  enableDebug: boolean
  shaderQuality: QualityLevel
  scaleMin: number
  scaleMax: number
}

export class Properties {
  static viewportWidth = 0
  static viewportHeight = 0
  static dpr = Math.min(2, window.devicePixelRatio) ?? 1

  // Mobile detection
  static isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  static isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0

  // Quality level system
  static qualityLevel: QualityLevel = Properties.detectQualityLevel()
  static gui: GUI | null = import.meta.env.DEV ? new GUI() : null

  private static detectQualityLevel(): QualityLevel {
    // Mobile devices → low quality for performance
    if (this.isMobile) {
      console.log("[Properties] Detected quality: low (mobile device)")
      return "low"
    }

    // Desktop → always high quality, let DPR be what device supports
    console.log(`[Properties] Detected quality: high (desktop, DPR: ${this.dpr})`)
    return "high"
  }

  static getSnakeConfig(): SnakeConfig {
    const config = (() => {
      switch (this.qualityLevel) {
        case "low":
          return {
            length: 10, // Shorter snake for mobile
            spineSegments: 50, // 100 → 50 (50% reduction)
            radialSegments: 6, // 8 → 4 (50% reduction)
            texturePoints: 50, // 100 → 50 (50% reduction)
            dpr: 1, // Force 1x on mobile
            enableDebug: false,
            shaderQuality: "low" as QualityLevel,
            scaleMin: 0.05,
            scaleMax: 0.4,
          }
        case "medium":
          return {
            length: 16,
            spineSegments: 75,
            radialSegments: 6,
            texturePoints: 75,
            dpr: Math.min(1.5, this.dpr),
            enableDebug: false,
            shaderQuality: "medium" as QualityLevel,
            scaleMin: 0.1,
            scaleMax: 0.49,
          }
        case "high":
          return {
            length: 26,
            spineSegments: 100,
            radialSegments: 8,
            texturePoints: 100,
            dpr: this.dpr, // Use actual device DPR
            enableDebug: import.meta.env.DEV,
            shaderQuality: "high" as QualityLevel,
            scaleMin: 0.13,
            scaleMax: 0.65,
          }
      }
    })()

    console.log("[Properties] Snake config:", config)
    return config
  }
}
