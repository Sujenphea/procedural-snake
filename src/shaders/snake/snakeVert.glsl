// texture
uniform sampler2D u_tPosition;
uniform sampler2D u_tNormal;

// Thickness profile
uniform float u_tailRampEnd;
uniform float u_scaleMin;
uniform float u_scaleMax;
uniform float u_neckStart;
uniform float u_neckEnd;
uniform float u_neckDepth;
uniform float u_headStart;
uniform float u_headEnd;
uniform float u_headRadius;
uniform float u_headBulge;

// Cross-section radii (defines tube surface shape)
uniform float u_radiusN; // normal direction (vertical)
uniform float u_radiusB; // binormal direction (horizontal)

// Effects
uniform float u_zOffset; // belly offset in normal direction
uniform float u_twistAmount;

// Instance geometry shaping
uniform float u_instanceScaleX; // spine direction (along curve)
uniform float u_instanceScaleY; // circumferential direction
uniform float u_instanceScaleZ; // outward from surface

// Per-instance attributes
attribute float spineU; // 0..1 along spine
attribute float theta; // 0..2π around circumference

// varyings
varying vec3 vNormal;
varying float vSpineU;
varying float vTheta;
varying vec3 vWorldPos;
varying vec3 vInstancePos;

/* -------------------------------------------------------------------------- */
/*                                    main                                    */
/* -------------------------------------------------------------------------- */
void main() {
  /* ---------------------- spine position and orientation -------------------- */
  // Sample the curve's position and normal from textures
  vec3 spinePos = texture2D(u_tPosition, vec2(spineU, 0.5)).xyz;
  vec3 spineNormal = normalize(texture2D(u_tNormal, vec2(spineU, 0.5)).xyz * 2.0 - 1.0);

  // Calculate tangent using finite difference (direction along the curve)
  float delta = 0.01;
  vec3 posAhead = texture2D(u_tPosition, vec2(spineU + delta, 0.5)).xyz;
  vec3 posBehind = texture2D(u_tPosition, vec2(spineU - delta, 0.5)).xyz;
  vec3 tangent = normalize(posAhead - posBehind);

  // Binormal completes the right-handed coordinate frame
  vec3 binormal = cross(tangent, spineNormal);

  /* --------------------------- thickness profile ---------------------------- */
  // Build the snake's thickness from multiple components (0..1 range)

  // 1. Tail ramp: fade in from 0 at the tail tip
  float tailRamp = smoothstep(0.0, u_tailRampEnd, spineU);

  // 2. Neck pinch: narrow section before the head
  float neckMid = (u_neckStart + u_neckEnd) * 0.5;
  float neckDown = smoothstep(u_neckStart, neckMid, spineU);
  float neckUp = smoothstep(neckMid, u_neckEnd, spineU);
  float neckPinch = 1.0 - u_neckDepth * neckDown * (1.0 - neckUp);

  // 3. Head bulge: localized expansion in the head region
  float headMid = (u_headStart + u_headEnd) * 0.5;
  float headRampUp = smoothstep(u_headStart, headMid, spineU);
  float headRampDown = smoothstep(headMid, u_headEnd, spineU);
  float headBulge = u_headBulge * headRampUp * (1.0 - headRampDown);

  // 4. Head base radius: transition from body thickness to head size
  float headBaseRadius = neckPinch * mix(1.0, u_headRadius, headRampUp);

  // 5. Tip closure: taper to zero at the very end to close the head
  float tipClosure = 1.0 - smoothstep(0.97, 1.0, spineU);

  // Combine all thickness components into final value
  float combinedThickness = tailRamp * (headBaseRadius + headBulge) * tipClosure;
  float scale = max(mix(u_scaleMin, u_scaleMax, combinedThickness), 0.001);

  /* -------------------------- tube surface position ------------------------- */
  // Add twist effect that accumulates along the spine
  float twistedTheta = theta + spineU * u_twistAmount;

  // Scale the elliptical cross-section radii
  float radiusNormal = scale * u_radiusN;
  float radiusBinormal = scale * u_radiusB;

  // Calculate offset from spine to tube surface (elliptical cross-section)
  vec3 ringOffset = spineNormal * cos(twistedTheta) * radiusNormal + binormal * sin(twistedTheta) * radiusBinormal;

  // Apply belly offset (pushes surface down slightly for realism)
  ringOffset += spineNormal * combinedThickness * u_zOffset;

  vec3 surfacePos = spinePos + ringOffset;

  /* --------------------------- tube surface normal -------------------------- */
  // Surface normal for the elliptical tube (swapped radii for correct curvature)
  vec3 surfaceNormal = normalize(spineNormal * cos(twistedTheta) * radiusBinormal + binormal * sin(twistedTheta) * radiusNormal);

  /* -------------------- local coordinate frame at surface ------------------- */
  // Build orthonormal frame aligned to tube surface
  vec3 circumTangent = normalize(cross(surfaceNormal, tangent));
  vec3 spineDirection = normalize(cross(circumTangent, surfaceNormal));

  // Create transformation matrix: X=along spine, Y=around circumference, Z=outward from surface
  mat3 surfaceFrame = mat3(spineDirection, circumTangent, surfaceNormal);

  /* ------------------------------ final position ----------------------------- */
  // Scale the instanced geometry based on position along snake
  vec3 scaledPos = vec3(
    position.x * scale * u_instanceScaleX,
    position.y * scale * u_instanceScaleY,
    position.z * scale * u_instanceScaleZ
  );

  // Transform from local space to tube surface, then to world space
  vec3 worldPos = surfacePos + surfaceFrame * scaledPos;

  /* ------------------------------- final normal ------------------------------ */
  // Apply inverse scale to normal (maintains correct lighting under non-uniform scaling)
  vec3 correctedNormal = normalize(vec3(
    normal.x / u_instanceScaleX,
    normal.y / u_instanceScaleY,
    normal.z / u_instanceScaleZ
  ));

  vec3 worldNormal = surfaceFrame * correctedNormal;
  vNormal = normalize((modelMatrix * vec4(worldNormal, 0.0)).xyz);

  /* --------------------------------- output --------------------------------- */
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

  // Pass data to fragment shader
  vSpineU = spineU;
  vTheta = theta;
  vWorldPos = (modelMatrix * vec4(worldPos, 1.0)).xyz;
  vInstancePos = position;
}
