// Color uniforms
uniform vec3 u_baseColor;
uniform vec3 u_spotColor;

// Spot pattern uniforms
uniform float u_spotScale;
uniform float u_spotThreshold;
uniform float u_spotSmoothness;
uniform float u_spotIntensity;
uniform int u_spotOctaves;
uniform float u_spotPersistence;
uniform float u_spotLacunarity;

// Animation uniforms
uniform float u_timeOffset;
uniform float u_animationSpeed;

// Lighting uniforms
uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection;
uniform float u_specularPower;
uniform float u_specularIntensity;
uniform float u_fresnelPower;
uniform float u_fresnelIntensity;

// Normal perturbation uniforms
uniform float u_normalPerturbScale;
uniform float u_normalPerturbStrength;
uniform int u_normalPerturbOctaves;

// Anisotropic highlight uniforms
uniform float u_anisotropicStrength;
uniform float u_anisotropicRoughness;

// Color variation uniforms
uniform float u_bellyLightness;
uniform float u_bellyWidth;

// Varyings from vertex shader
varying vec3 vNormal;
varying float vSpineU;
varying float vTheta;
varying vec3 vWorldPos;
varying vec3 vInstancePos;

/* -------------------------------------------------------------------------- */
/*                                    noise                                   */
/* -------------------------------------------------------------------------- */
// 2D Simplex Noise functions
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float octaveNoise(vec2 uv, int octaves, float persistence, float lacunarity) {
  float total = 0.0;
  float frequency = 1.0;
  float amplitude = 1.0;
  float maxValue = 0.0;

  for (int i = 0 ; i < 8 ; i++) {
    if (i >= octaves)
      break;
    total += snoise(uv * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / maxValue;
}

/* -------------------------------------------------------------------------- */
/*                                    main                                    */
/* -------------------------------------------------------------------------- */
void main() {
  vec3 normal = normalize(vNormal);

  /* --------------------------- normal perturbation -------------------------- */
  // Add micro-scale surface detail by perturbing normals with noise
  // This simulates fine bumps/scales without adding geometry
  if (u_normalPerturbStrength > 0.0) {
    // Create UV coordinates from snake's surface (0-1 along spine, 0-1 around circumference)
    vec2 bumpCoord = vec2(vSpineU, vTheta / (2.0 * 3.14159265359)) * u_normalPerturbScale;

    // Add per-instance variation to break up tiling patterns
    vec2 instanceBumpOffset = vInstancePos.xy * 0.1;
    bumpCoord += instanceBumpOffset;

    // Sample noise to create height field for bumps
    float bumpNoise = octaveNoise(bumpCoord, u_normalPerturbOctaves, 0.5, 2.0);

    // Compute height gradient using finite differences (central difference method)
    // This tells us which direction the surface "slopes" for lighting
    float delta = 0.01;
    float bumpU = octaveNoise(bumpCoord + vec2(delta, 0.0), u_normalPerturbOctaves, 0.5, 2.0);
    float bumpV = octaveNoise(bumpCoord + vec2(0.0, delta), u_normalPerturbOctaves, 0.5, 2.0);
    vec2 gradient = vec2(bumpU - bumpNoise, bumpV - bumpNoise) / delta;

    // Build local tangent space for applying the bump perturbation
    vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));

    // Apply gradient to normal (negative because height increase means normal points up)
    normal = normalize(normal - gradient.x * tangent * u_normalPerturbStrength - gradient.y * bitangent * u_normalPerturbStrength);
  }

  /* ---------------------------- base color pattern -------------------------- */
  // Create procedural spot pattern (like python or boa skin)

  // Build UV coordinates: stable as snake moves (tied to spine position, not world space)
  vec2 baseCoord = vec2(
    vSpineU,                          // 0-1 along snake's length
    vTheta / (2.0 * 3.14159265359)    // 0-1 around circumference
  );

  // Add fine per-vertex variation to prevent repetitive look within each segment
  vec2 instanceOffset = vInstancePos.xy * 0.1;

  // Scale UVs for spot frequency control
  vec2 noiseCoord = (baseCoord + instanceOffset) * u_spotScale;

  // Optional: animate pattern over time (e.g., for pulsing effect)
  if (u_animationSpeed > 0.0) {
    noiseCoord += vec2(u_timeOffset * u_animationSpeed);
  }

  // Generate organic noise pattern with multiple octaves for natural variation
  float noiseValue = octaveNoise(noiseCoord, u_spotOctaves, u_spotPersistence, u_spotLacunarity);

  // Remap noise from [-1, 1] to [0, 1] for thresholding
  noiseValue = noiseValue * 0.5 + 0.5;

  // Convert continuous noise to distinct spots with smooth transitions
  // Threshold determines spot density, smoothness controls edge softness
  float spotMask = smoothstep(u_spotThreshold - u_spotSmoothness, u_spotThreshold + u_spotSmoothness, noiseValue);

  // Mix base skin color with spot color based on mask
  vec3 color = mix(u_baseColor, u_spotColor, spotMask * u_spotIntensity);

  /* ---------------------------- belly lightening ---------------------------- */
  // Many snakes have lighter undersides - add this biological detail
  if (u_bellyLightness > 0.0) {
    // Use cosine to map circumferential angle to vertical position
    // cos(theta): 1 at top, -1 at bottom (theta wraps around snake)
    float verticalPos = cos(vTheta);

    // Create smooth gradient from belly (bottom) to back (top)
    // Remapped so 1 = belly, 0 = back
    float bellyMask = smoothstep(1.0 - u_bellyWidth, 1.0, -verticalPos + 1.0);

    // Lighten color on belly (multiplicative brightening)
    color = mix(color, color * (1.0 + u_bellyLightness), bellyMask);
  }

  /* ------------------------------- lighting --------------------------------- */
  // Apply physically-based lighting to enhance depth and realism

  vec3 viewDir = normalize(u_cameraPosition - vWorldPos);

  // 1. Fresnel rim lighting: edges glow when viewed at grazing angles
  //    Essential for the shiny, scale-like appearance of snake skin
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), u_fresnelPower);
  vec3 rimLight = vec3(1.0) * fresnel * u_fresnelIntensity;

  // 2. Diffuse lighting: basic shading based on surface orientation to light
  //    Clamped to prevent pure black (ambient light fill)
  float diffuse = max(dot(normal, u_lightDirection), 0.0);
  diffuse = diffuse * 0.6 + 0.4;  // Compress dynamic range for softer shadows

  // 3. Specular highlights: shiny reflections simulating wet or scaly surface
  vec3 specular;

  if (u_anisotropicStrength > 0.0) {
    // Anisotropic specular: elongated highlights along scales (circumferential direction)
    // Real scales have directional microstructure causing stretched reflections

    // Derive surface tangent (along circumference, perpendicular to spine)
    vec3 spineDir = normalize(dFdx(vWorldPos));  // Screen-space derivative approximates spine
    vec3 tangent = normalize(cross(normal, spineDir));
    vec3 bitangent = normalize(cross(normal, tangent));

    // Half-vector between light and view (Blinn-Phong model)
    vec3 halfDir = normalize(u_lightDirection + viewDir);

    // Ward anisotropic BRDF (simplified): different roughness along tangent vs bitangent
    float dotTH = dot(tangent, halfDir);
    float dotBH = dot(bitangent, halfDir);
    float dotNH = dot(normal, halfDir);

    // Roughness controls highlight shape: stretched along tangent, tight along bitangent
    float roughnessT = u_anisotropicRoughness;        // Circumferential (stretched)
    float roughnessB = u_anisotropicRoughness * 0.1;  // Radial (tight)

    // Ward model exponent calculation
    float exponentT = dotTH * dotTH / (roughnessT * roughnessT);
    float exponentB = dotBH * dotBH / (roughnessB * roughnessB);
    float spec = exp(-(exponentT + exponentB) / max(dotNH * dotNH, 0.001));

    // Blend anisotropic with standard specular for artistic control
    float isoSpec = pow(max(dotNH, 0.0), u_specularPower);
    spec = mix(isoSpec, spec, u_anisotropicStrength);

    specular = vec3(1.0) * spec * u_specularIntensity;
  } else {
    // Standard isotropic specular (Blinn-Phong): uniform circular highlights
    vec3 halfDir = normalize(u_lightDirection + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), u_specularPower);
    specular = vec3(1.0) * spec * u_specularIntensity;
  }

  // Combine all lighting components
  color = color * diffuse + specular + rimLight;

  /* --------------------------------- output --------------------------------- */
  gl_FragColor = vec4(color, 1.0);
}
