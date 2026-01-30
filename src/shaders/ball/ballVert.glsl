varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
  
  vPosition = worldPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
}