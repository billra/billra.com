# RGB Color Cube

Geometry & Controls Documentation

## The Corner View: Flattened Isometric Projection

The primary interface displays a flat, hexagonal shape composed of three
interconnected rhombuses (diamonds). This layout uses a
**flattened isometric view**, which is a 3D-to-2D geometric projection. Imagine
looking at a physical 3D cube from a **corner view**, where the corner closest
to the eye points directly forward, and the three visible faces slope away
symmetrically. By flattening this perspective into a 2D plane, the layout
preserves the proportional relationships along the axes, allowing the three
outer faces of the RGB cube to be mapped simultaneously without distortion.

When the control slider is set to maximum intensity (100%), the interface
displays these three outer faces. In this state, every individual color point on
the screen has at least one color channel (Red, Green, or Blue) at its maximum
possible value. The shared central vertex where all three faces meet represents
pure white, which then blends outward toward the primary and secondary colors
located at the far edges.

## The Intensity Slider and Color Rays

The slider controls the overall intensity of the corner view via scalar
multiplication. As the slider is adjusted downward, a scaling factor is applied
simultaneously to every color visible on the faces. Geometrically, this action
visualizes points traveling down an **intensity ray**. Within the 3D cube model,
an intensity ray is a straight line originating from pure black at the hidden
far corner and terminating at a specific coordinate on one of the outer faces.

Because this ray is a straight line, the proportional ratio of Red to Green to
Blue remains completely constant anywhere along it. Moving the slider pushes the
colors down their respective rays toward zero, dimming the slice of the color
space into black while preserving the base identity and relationships of the
channels. By utilizing this layout, the tool allows for the visualization and
specification of all possible color values within the RGB spectrum. Every color
exists as a specific coordinate on the outer faces, scaled by a specific
intensity value.

## Proportional Scaling

To understand the math of the slider, it helps to look at the channels as
ratios. Consider a color where Red is at minimum, Green is at half-capacity, and
Blue is at maximum capacity. Because the slider acts as a direct multiplier,
setting the slider to 50% cuts all three of these channel values exactly in half
simultaneously. Red remains at minimum, Green drops to a quarter-capacity, and
Blue drops to half-capacity. This proportional relationship holds true for any
coordinate chosen on the visual map, ensuring the hue does not shift as the
color darkens.

## Navigating Grayscale and the Neutral Axis

Within this geometric layout, the entire spectrum of grayscale values is
accessible. Because the central shared vertex represents pure white (zero
saturation), remaining on this center point while lowering the intensity slider
pushes the color straight down the **neutral axis**. This axis is the diagonal
line passing directly through the core of the 3D cube from white to black. This
action scales white down through every shade of neutral gray until it reaches
pure black, bypassing the colorful outer edges entirely.

## Complementary Colors and Geometry

The hexagonal layout visualizes **complementary colors** through spatial
opposites. Drawing a straight line from any color on the outer edge, through the
white center, and out to the opposite edge will always land on that color's
complement. For example, the pure Red vertex sits directly across from the pure
Cyan vertex. This demonstrates how colors on opposite sides of the RGB spectrum
cancel each other out to create neutral white light in the center.

## Relationship to HSV and HSB

This geometric model reveals the underlying logic behind the HSV and HSB color
models commonly used in digital design. **HSV** (Hue, Saturation, Value) and
**HSB** (Hue, Saturation, Brightness) are identical concepts under different
names, designed to translate the Cartesian coordinates of the RGB cube into a
mathematical **Cylindrical Coordinate System** that aligns with human
perception.

In a standard Cartesian RGB system, colors are plotted on a 3D grid using $x$,
$y$, and $z$ axes representing width, height, and depth. To define a point, you
specify three linear distances along these perpendicular axes. This makes
intuitive adjustments difficult; humans do not naturally calculate how much Red,
Green, and Blue light to add or subtract to make a dusty navy blue slightly more
vibrant while keeping the same core color.

To solve this, HSV and HSB warp the math into a
**Cylindrical Coordinate System**. Instead of three flat, intersecting grids, a
cylindrical system defines any point in 3D space using three completely
different geometric metrics:

- **An Angle ($\theta$):** A rotational direction measured around a central
  vertical axis, sweeping out a circle.
- **A Radius ($r$):** A horizontal distance measuring how far out to move from
  that central axis toward the edge of the circle.
- **A Height ($z$):** A linear vertical distance measuring how far up or down to
  move along the central axis.

The physical layout and controls of this tool map directly to these cylindrical
dimensions:

- **Hue (The Angle):** The angular direction, or rotation, around the center
  point (ranging from $0^\circ$ to $360^\circ$). Imagine tracing a circle around
  the white vertex; the position along that circular path, whether pointing
  toward the red, green, or blue edge, determines the base hue.
- **Saturation (The Radius):** The distance from the pure white center.
  Remaining at the center yields zero saturation (grayscale), while moving
  outward toward the edges yields maximum saturation (pure, vivid color).
- **Value / Brightness (The Height):** The depth along the intensity ray, which
  is mapped directly to the slider.

While traditional software interfaces often slice this invisible mathematical
cylinder into flat 2D color wheels or squares to make them easier to click on a
flat monitor, this tool's geometry visualizes the exact same underlying
architecture. By separating the spectrum into these three dimensions, the math
aligns with how humans naturally categorize what they see: we isolate the
*identity* of a color (Hue) from its *purity* (Saturation) and its *lighting*
(Value), allowing users to lock in a specific color and simply scale it down
uniformly to be darker.
