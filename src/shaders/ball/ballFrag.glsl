uniform vec3 u_color;
uniform vec3 u_lightDirection;
uniform vec3 u_cameraPosition;
uniform float u_emissiveIntensity;
uniform float u_specularPower;
uniform float u_fresnelPower;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(u_lightDirection);
  vec3 viewDir = normalize(u_cameraPosition - vPosition);

  // Diffuse lighting (Lambert)
  float diffuse = max(dot(normal, lightDir), 0.0);

  // Specular highlight (Blinn-Phong)
  vec3 halfDir = normalize(lightDir + viewDir);
  float specular = pow(max(dot(normal, halfDir), 0.0), u_specularPower);

  // Fresnel rim lighting
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), u_fresnelPower);

  // Combine lighting
  vec3 emissive = u_color * u_emissiveIntensity;
  vec3 diffuseColor = u_color * diffuse * 0.6;
  vec3 specularColor = vec3(1.0) * specular * 0.5;
  vec3 fresnelColor = u_color * fresnel * 0.4;

  vec3 finalColor = emissive + diffuseColor + specularColor + fresnelColor;

  gl_FragColor = vec4(finalColor, 1.0);
}