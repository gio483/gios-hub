/**
 * Keylight - colour temperature, white balance and gels.
 *
 * Light colours come from the Planckian locus (Kim et al. cubic fit to the
 * CIE 1931 blackbody curve), converted xyY -> XYZ -> linear sRGB with
 * luminance held at 1.0. Holding Y = 1 matters: it keeps chromaticity and
 * photometry in separate channels, so multiplying a light colour by its
 * cd*s/m2 value stays photometrically correct.
 *
 * Gels are modelled as mired shifts, which is how they are actually
 * specified, so gelling a 7000K source and a 5500K source correctly give
 * different results instead of both snapping to a stored value.
 */

/** Correlated colour temperature (K) -> CIE 1931 xy chromaticity. */
export function kelvinToXY(kelvin) {
  const T = Math.max(1667, Math.min(25000, kelvin));
  let x;
  if (T <= 4000) {
    x = -0.2661239e9 / (T * T * T) - 0.2343589e6 / (T * T) + 0.8776956e3 / T + 0.179910;
  } else {
    x = -3.0258469e9 / (T * T * T) + 2.1070379e6 / (T * T) + 0.2226347e3 / T + 0.240390;
  }
  let y;
  if (T <= 2222) {
    y = -1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683;
  } else if (T <= 4000) {
    y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483;
  }
  return { x, y };
}

/** xyY (Y = 1) -> linear sRGB. May contain small negatives out of gamut. */
export function xyToLinearRGB(x, y) {
  const Y = 1.0;
  const X = (x * Y) / y;
  const Z = ((1 - x - y) * Y) / y;
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
  ];
}

/**
 * Colour temperature -> linear sRGB with luminance normalised to 1.
 * Out-of-gamut negatives are clamped, then luminance is restored so the
 * photometric magnitude survives the clamp.
 */
export function kelvinToRGB(kelvin) {
  const { x, y } = kelvinToXY(kelvin);
  let rgb = xyToLinearRGB(x, y).map((v) => Math.max(0, v));
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  if (lum > 1e-6) rgb = rgb.map((v) => v / lum);
  return rgb;
}

/* ------------------------------------------------------------------ */
/* White balance                                                       */
/* ------------------------------------------------------------------ */

/**
 * Per-channel gains that render an illuminant of `kelvin` as neutral.
 * This is what a camera actually stores as its WB coefficients.
 */
export function whiteBalanceGains(kelvin) {
  const rgb = kelvinToRGB(kelvin);
  const g = rgb.map((v) => 1 / Math.max(1e-4, v));
  const lum = 0.2126 * (rgb[0] * g[0]) + 0.7152 * (rgb[1] * g[1]) + 0.0722 * (rgb[2] * g[2]);
  return g.map((v) => v / lum);
}

/**
 * Auto white balance: luminance-weighted average of the colour temperatures
 * actually contributing to the frame. It is a grey-world estimate, so it
 * splits the difference and satisfies nobody, which is the point.
 */
export function autoWhiteBalance(contributions) {
  let wSum = 0;
  let miredSum = 0;
  for (const c of contributions) {
    if (!c || c.weight <= 0) continue;
    wSum += c.weight;
    miredSum += c.weight * (1e6 / c.kelvin);
  }
  if (wSum <= 0) return 5500;
  return 1e6 / (miredSum / wSum);
}

/* ------------------------------------------------------------------ */
/* Gels                                                                */
/* ------------------------------------------------------------------ */

export const GELS = {
  none:      { id: 'none',      label: 'No gel',      miredShift: 0,   lossStops: 0.0 },
  cto_quarter: { id: 'cto_quarter', label: '1/4 CTO', miredShift: 42,  lossStops: 0.3 },
  cto_half:  { id: 'cto_half',  label: '1/2 CTO',     miredShift: 81,  lossStops: 0.45 },
  cto_full:  { id: 'cto_full',  label: 'Full CTO',    miredShift: 131, lossStops: 0.9 }
};

/** Apply a gel's mired shift to a source colour temperature. */
export function gelledKelvin(sourceKelvin, gelId) {
  const gel = GELS[gelId] || GELS.none;
  const mired = 1e6 / sourceKelvin + gel.miredShift;
  return 1e6 / mired;
}

export function gelLossStops(gelId) {
  return (GELS[gelId] || GELS.none).lossStops;
}

/**
 * Distance between two colour temperatures in mireds. Mireds, not Kelvin,
 * are what the eye responds to: 2700 to 3200 is a big visible move, 8000 to
 * 8500 is almost nothing.
 */
export function miredDistance(k1, k2) {
  return Math.abs(1e6 / k1 - 1e6 / k2);
}

/** Multiply two linear RGB triples (light colour through a surface albedo). */
export function mulRGB(a, b) {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

/** sRGB hex string -> linear RGB triple. */
export function hexToLinear(hex) {
  const h = hex.replace('#', '');
  const to = (s) => {
    const v = parseInt(s, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return [to(h.slice(0, 2)), to(h.slice(2, 4)), to(h.slice(4, 6))];
}

export function linearToHex(rgb) {
  const to = (v) => {
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0');
  };
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

/** Luminance (Y) of a linear RGB triple. */
export function luminanceOf(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
