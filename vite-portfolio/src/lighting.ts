// Direction from the water towards the sun. Surface reflections, the visible
// solar disc and the light transmitted into the pool all use this same source.
export const SUN_DIRECTION = [0.18, 0.11, -1] as const;

// Linear-light procedural atmosphere shared by the background, distant water
// and the underwater Snell window. Clouds remain still when motion is paused.
export const SKY_GLSL = `
  uniform vec3 uSunDirection;

  float skyHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float skyNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    vec2 blend = f * f * (3.0 - 2.0 * f);
    return mix(mix(skyHash(cell), skyHash(cell + vec2(1.0, 0.0)), blend.x),
      mix(skyHash(cell + vec2(0.0, 1.0)), skyHash(cell + 1.0), blend.x), blend.y);
  }
  float skyClouds(vec2 p) {
    float value = 0.0;
    float amplitude = .5;
    for (int i = 0; i < 4; i++) {
      value += skyNoise(p) * amplitude;
      p = mat2(.8, -.6, .6, .8) * p * 2.07 + 3.7;
      amplitude *= .5;
    }
    return value;
  }
  vec3 daylightSky(vec3 direction) {
    direction = normalize(direction);
    float height = max(direction.y, 0.0);
    vec3 horizon = vec3(.22, .43, .64);
    vec3 zenith = vec3(.025, .12, .32);
    vec3 color = mix(horizon, zenith, pow(height, .48));
    float sunAngle = max(dot(direction, uSunDirection), 0.0);
    // Keep the low sun's gold around its disc: a broad white veil would
    // desaturate both the visible atmosphere and every reflected wave.
    color += vec3(.045, .025, .005) * pow(sunAngle, 12.0);
    color += vec3(.18, .09, .018) * pow(sunAngle, 110.0);
    // Broad, soft cirrus has angular perspective instead of screen-space noise.
    vec2 cloudUV = direction.xz / (height + .24) * 1.8;
    float cloud = smoothstep(.47, .72, skyClouds(cloudUV + vec2(3.2, -1.7)));
    cloud *= smoothstep(.015, .22, height);
    vec3 cloudColor = vec3(.58, .70, .80) + vec3(.10, .055, .012) * pow(sunAngle, 7.0);
    color = mix(color, cloudColor, cloud * .48);
    color += vec3(.78, .34, .065) * pow(sunAngle, 900.0);
    float sunDisc = smoothstep(cos(.010), cos(.0065), sunAngle);
    color += vec3(9.0, 7.4, 4.8) * sunDisc;
    // Sky below the horizon is only sampled by rough surface reflections.
    return mix(vec3(.08, .17, .20), color, smoothstep(-.12, .01, direction.y));
  }
`;
