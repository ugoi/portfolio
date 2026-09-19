# Lifebuoy and water model

The ring is a force-driven rigid body. Its height and tilt are results of gravity,
displaced water, water-relative drag, and interaction forces. No sine curve sets
the ring pose, and release does not animate it back to a stored position.

## Shared Gerstner surface

`src/waves.ts` is the single source of the five wave directions, wavelengths,
steepnesses and phases. It generates the GLSL calls and evaluates the same surface
on the CPU. For plane-local material coordinate **a**, unit direction **d**,
wavenumber k = 2π/λ and amplitude A = steepness/k:

```
phase = k (d · a) - omega t + initialPhase
horizontalPosition = a + Σ d A cos(phase)
height = WATER_LEVEL + Σ A sin(phase)
orbitalHorizontalVelocity = Σ d A omega sin(phase)
orbitalVerticalVelocity = -Σ A omega cos(phase)
```

The water plane rotates −π/2 around X, so plane-local Y maps to world −Z. The CPU
inverts the horizontal displacement with Newton iterations before querying a
world X/Z location. Surface normals come from the cross product of analytic
parametric derivatives and are normalized. Water velocity is the time derivative
at a *material point*, not the height derivative at a fixed world location.

Deep-water dispersion uses the same metre scale and gravity as the body:
omega = sqrt(g k / METRES_PER_UNIT), where k is in inverse scene units. The
wave phase and rigid body therefore share a physical clock. Any presentation
slow motion must scale that entire clock, rather than slowing only the waves.

Reference: [GPU Gems, Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models).

## Units and flotation

One scene unit represents 0.25 metres for body geometry and dynamics. All forces
are computed in newtons, masses in kilograms, displaced volumes in cubic metres,
and inertia in kg m². Exposed positions and linear velocities remain in scene
units for Three.js; angular velocity is in radians/second.

The body matches the visible torus: major radius 1.43, tube radius 0.395, axial
squash 0.82, multiplied by responsive display scale. Its effective bulk density is
110 kg/m³, representing a lightweight flotation body including its fittings;
water density is 1000 kg/m³. This is an illustrative bulk density, not a measured
specification for an actual certified rescue ring. Its total torus volume is
V = 2π² R a b, where a/b are the elliptical tube semiaxes. Mass is density × V.

The torus is divided into 32 azimuthal cross sections. A locally tangent wave plane
cuts each elliptical disc. The circular-segment area gives its wet volume fraction,
and the corresponding segment centroid gives the application point. For normalized
waterline depth s in [−1, 1]:

```
wetFraction = 1/2 + (asin(s) + s sqrt(1-s²)) / π
buoyancy = waterDensity × gravity × wetVolume
```

Buoyancy acts vertically upward; gravity acts at the centre of mass. Buoyancy at
each displaced-water centroid contributes torque **r × F**, producing pitch and
roll naturally. Fully submerged volume produces exactly Archimedes' force, while
equilibrium in still water displaces the body/water density ratio (11%). The
cross-section quadrature approximates torus curvature and the wave across each
section rather than performing an exact clipped-mesh volume calculation.

Reference: [OpenStax, Archimedes' Principle and Buoyancy](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy).

## Drag, rotation and grabbing

For each wet section, relative velocity includes body translation, rotation at
the force point (**omega × r**), and the sampled orbital water velocity. Drag is:

```
Fdrag = -1/2 × waterDensity × Cd × wettedArea × |relativeVelocity| × relativeVelocity
```

Cd = 1.05 is an approximate isotropic coefficient. Wetted area scales with
wetFraction^(2/3). A small linear dissipative term approximates unresolved viscous
and wave-radiation losses near zero speed; very small rotational air damping
prevents perpetual spin after above-water interaction. These coefficients have
not been experimentally fitted.

The rigid-body solver uses torus principal moments of inertia and Euler's equation
I domega/dt = torque − omega × (I omega), including the gyroscopic term. It advances
translation semi-implicitly and orientation with a normalized quaternion.

A grab stores the hit point in body coordinates. A spring-damper applies force at
that point toward the pointer's world target. This can move and tilt the ring;
release removes the spring and preserves momentum. Force is capped to keep fast
pointer jumps bounded. Optional soft scene boundaries act only outside the visible
area, with no attraction to an original rest pose.

Reference: [NASA, Drag Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).

## Time, pause and tests

`advance(frameDt, freezeWaves)` uses an accumulator and fixed 1/120-second steps.
Ordinary frame partitions produce identical states. A single frame is capped at
0.25 seconds to prevent a hidden-tab backlog. `time` is shared with the shader.
With `freezeWaves=true`, interaction can still integrate against the frozen water
surface, its orbital velocity is zero and the wave clock stays unchanged.
`step(dt, time?)` is a low-level single step: optional time sets wave phase before
the step, then the clock advances by dt. `reset` updates responsive scale and
position, initializes a face-up quaternion (−π/2 X), and briefly settles against
frozen water without changing the wave clock.

Run verification with:

```
node --experimental-strip-types --test tests/physics.test.mjs
```

Tests cover inverse wave sampling, analytic velocity and normals, Archimedes'
force in SI units, still-water equilibrium at both responsive sizes, recovery
after a drop, torque from an off-centre grab, momentum after release, frame-rate
independence, frozen time, and finite long-run state after aggressive dragging.

This is a practical hydrostatic rigid-body approximation driven by an analytic
ocean. It does not solve Navier–Stokes, simulate fluid cells, displace the rendered
water in response to the ring, or predict a real rescue device's performance.

## Interaction and browser checks

The renderer copies the calculated position and quaternion; it never authors the
ring pose during animation. Pointer grabs are raycast against the visible torus.
A projected SVG target reserves touch gestures only around the ring, leaving the
rest of the page available for normal scrolling. The small opening is conservative
at oblique angles, and the body raycast is the final hit test. Pointer capture
keeps a drag active outside its original hit area; release, cancellation, lost
capture, blur and a hidden tab all detach the spring.

Arrow keys pull the ring; R/Home reset its position and Escape releases it. A
repeated key preserves an existing animation frame rather than restarting its
timestamp. In pause/reduced-motion mode, an intentional grab integrates against
frozen water, then stops again on release. Autonomous wave motion requires the
existing start control.

Checked in isolated Chromium/SwiftShader: desktop and mobile rendering, real
mouse dragging, CDP touch dragging and scrolling outside the ring, rapid repeated
arrow keys, start/pause and reduced-motion default. Physics regressions use the
normal npm test command. Software rendering is not evidence of physical iPhone
or Safari performance. Automated accessibility audit found no violations;
contrast over the animated water still requires visual assessment.
