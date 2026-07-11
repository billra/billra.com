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

When the control slider is set to `1` (or 100%), the interface displays these
three outer faces. In this state, every individual color point on the screen has
at least one RGB channel (Red, Green, or Blue) maxed out at its highest possible
value in 3-digit hex notation (`F`, representing 255). The shared central vertex
where all three faces meet represents pure white (`#FFF`), which then blends
outward toward the primary and secondary colors located at the far edges.

## The Intensity Slider and Color Rays

The slider controls the overall intensity of the corner view via scalar
multiplication. As the slider is adjusted downward, a scaling factor is applied
simultaneously to every color visible on the faces. Geometrically, this action
visualizes points traveling down an **intensity ray**. Within the 3D cube model,
an intensity ray is a straight line originating from pure black (`#000`) at the
hidden far corner and terminating at a specific pixel on one of the outer faces.

Because this ray is straight, the proportional ratio of Red to Green to Blue
remains constant anywhere along the line. Moving the slider pushes the colors
down their respective rays toward zero, dimming the slice of the color space
into black while preserving the base identity of the colors. By utilizing this
layout, the tool allows for the visualization and specification of all possible
color values within the RGB spectrum. Every color exists as a specific
coordinate on the outer faces, scaled by a specific intensity value.

## Decoding the Hexadecimal Shorthand

To fully utilize the slider, it is helpful to understand the math of 3-digit hex
notation. A standard color like `#08F` translates to Red at `0` (minimum), Green
at `8` (roughly 50%), and Blue at `F` (maximum). Because the slider acts as a
multiplier, setting the slider to 50% cuts all three of these values in half
simultaneously. Half of `F` (15) is 7.5, which rounds up to 8, resulting in
`#048`. This proportional relationship holds true for any coordinate chosen on
the visual map.

## Navigating Grayscale and the Neutral Axis

Within this geometric layout, the entire spectrum of grayscale values is
accessible. Because the central shared vertex represents pure white (zero
saturation), remaining on this center point while lowering the intensity slider
pushes the color straight down the **neutral axis**. This axis is the diagonal
line passing through the core of the 3D cube from white to black. This action
scales white (`#FFF`) down through every shade of neutral gray until it reaches
pure black (`#000`), bypassing the colorful outer edges.

## Complementary Colors and Geometry

The hexagonal layout visualizes **complementary colors** through spatial
opposites. Drawing a straight line from any color on the outer edge, through the
white center, and out to the opposite edge will always land on that color's
complement. For example, the pure Red vertex sits directly across from the pure
Cyan vertex. This demonstrates how colors on opposite sides of the RGB spectrum
cancel each other out to create neutral white light in the center.

## Relationship to HSV and HSB

This geometric model is the logic behind the HSV and HSB color models used in
digital design. **HSV** (Hue, Saturation, Value) and **HSB** (Hue, Saturation,
Brightness) are identical concepts under different names, designed to translate
the Cartesian coordinates of the RGB cube into a cylindrical system for human
use.

The physical layout and controls of this tool map directly to these color models:

* **Hue:** The angular direction, or rotation, around the center point. Imagine
  tracing a circle around the white vertex; the position along that circular
  path, whether pointing toward the red, green, or blue edge, determines the
  base hue.
* **Saturation:** The distance from the pure white center. Remaining at the
  center yields zero saturation, while moving toward the outer edges yields
  maximum saturation.
* **Value (or Brightness):** The depth along the intensity ray, which is mapped
  to the slider.

By separating the RGB spectrum into these three dimensions, the software allows
artists to say, "I want this direction of color (Hue), this amount of pureness
(Saturation), but I just want to scale it down to be darker (Value)."
