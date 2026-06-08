const RAINBOW_DENSITY = 6;
const FADE_FREQ = 0.15;

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255,
    ag = (pa >> 8) & 255,
    ab = pa & 255;
  const br = (pb >> 16) & 255,
    bg = (pb >> 8) & 255,
    bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function resolveColor(color: string, x: number, y: number): string {
  if (!color || color[0] === "#") return color;
  if (color === "rainbow") {
    const hue = ((((x + y) * RAINBOW_DENSITY) % 360) + 360) % 360;
    return `hsl(${hue}, 85%, 55%)`;
  }
  if (color.startsWith("fade:")) {
    const [a, b] = color.slice(5).split(",");
    const t = (Math.sin((x + y) * FADE_FREQ) + 1) / 2;
    return lerpHex(a, b, t);
  }
  return color;
}
