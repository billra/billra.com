# ColorCube

Let's look at the "folded-out" planar net (the three diamonds). Since we already
know that every point on those three faces has a **Value (Brightness) of 100%**,
we only need to figure out how **Hue** and **Saturation** map to that flat
surface.

Here is how to read a point on those faces:

## 1. Saturation is "Distance from Center"

In our folded-out net, all three faces meet in the exact middle at pure White
(`#FFF`, which is $255, 255, 255$).

- **0% Saturation:** You are standing dead center on the White vertex.
- **100% Saturation:** You have walked all the way to the outer jagged edges
  (Pure Red, Pure Blue, Pure Cyan, etc.).

**The Mathematical Trick:** To find the Saturation of any color on those faces,
just look at the **lowest** RGB number.

- If the lowest number is also `255`, you are at pure white (0% Saturation).
- If the lowest number is `0`, you have hit the outer edge (100% Saturation).
- If the lowest number is somewhere in the middle, say `127`, you are halfway
  between the center and the edge (50% Saturation).

## 2. Hue is "Which Direction You Walk"

If Saturation is *how far* you walk from the white center, Hue is
*which direction* you chose to walk.

- If you walk straight down the Red axis, your Hue is $0^\circ$.
- If you walk straight down the Green axis, your Hue is $120^\circ$.
- If you walk straight down the Blue axis, your Hue is $240^\circ$.
- If you walk somewhere in between—for example, between Red and Green—you end up at Yellow ($60^\circ$).

**The Mathematical Trick:**
To calculate the exact Hue angle, the computer looks at the **highest** number
(which tells it which face you are on) and the **middle** number (which tells it
how far you are leaning toward the next color).

By separating the color into these three dimensions, software allows artists to say:
*"I want this exact direction of color (Hue), this amount of pureness (Saturation), but I just want to scale it down to be darker (Value)."*
