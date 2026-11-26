// Réplica en JavaScript del remuestreo de Pillow (libImaging/Resample.c) para imágenes de 8 bits.
//
// Por qué: el modelo se evaluó con el preprocesamiento del backend (PIL.Image.resize). Para que el
// navegador dé las mismas probabilidades no basta con "redimensionar un canvas": Pillow usa un filtro
// separable con coeficientes en punto fijo (22 bits), primero horizontal y después vertical, con un
// redondeo a 8 bits entre ambas pasadas. Aquí se reproduce ese cálculo con enteros exactos.

const PRECISION_BITS = 32 - 8 - 2;
const ONE = 2 ** PRECISION_BITS;

type Filter = { support: number; fn: (x: number) => number };

/** Filtro bilineal (triángulo) de Pillow: support 1. */
export const BILINEAR: Filter = {
  support: 1,
  fn: (x) => {
    if (x < 0) x = -x;
    return x < 1 ? 1 - x : 0;
  },
};

/** Filtro bicúbico de Pillow (a = -0.5): support 2. Es el predeterminado de Image.resize. */
export const BICUBIC: Filter = {
  support: 2,
  fn: (x) => {
    const a = -0.5;
    if (x < 0) x = -x;
    if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
    if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
    return 0;
  },
};

interface Coeffs {
  ksize: number;
  bounds: Int32Array; // [xmin, cantidad] por pixel de salida
  kk: Float64Array; // coeficientes enteros (punto fijo) como números exactos
}

const trunc = (v: number) => (v < 0 ? Math.ceil(v) : Math.floor(v)); // conversión (int) de C

function precomputeCoeffs(inSize: number, in0: number, in1: number, outSize: number, filter: Filter): Coeffs {
  const scale = (in1 - in0) / outSize;
  const filterscale = scale < 1 ? 1 : scale;
  const support = filter.support * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const kk = new Float64Array(outSize * ksize);
  const prekk = new Float64Array(ksize);
  for (let xx = 0; xx < outSize; xx++) {
    const center = in0 + (xx + 0.5) * scale;
    let ww = 0;
    const ss = 1 / filterscale;
    let xmin = trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    prekk.fill(0);
    for (let x = 0; x < xmax; x++) {
      const w = filter.fn((x + xmin - center + 0.5) * ss);
      prekk[x] = w;
      ww += w;
    }
    for (let x = 0; x < xmax; x++) {
      const k = ww !== 0 ? prekk[x] / ww : prekk[x];
      // normalize_coeffs_8bpc: redondeo simétrico a punto fijo.
      kk[xx * ksize + x] = k < 0 ? trunc(-0.5 + k * ONE) : trunc(0.5 + k * ONE);
    }
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { ksize, bounds, kk };
}

const clip8 = (ss: number) => {
  const v = Math.floor(ss / ONE); // desplazamiento aritmético >> PRECISION_BITS
  return v < 0 ? 0 : v > 255 ? 255 : v;
};

/**
 * Redimensiona una imagen de `channels` canales (1 = gris, 3 = RGB) como `PIL.Image.resize((w, h), filtro)`.
 * `data` tiene los píxeles intercalados por fila.
 */
export function resample(data: Uint8Array, width: number, height: number, channels: number,
  outW: number, outH: number, filter: Filter): Uint8Array {
  const needH = outW !== width;
  const needV = outH !== height;
  const horiz = precomputeCoeffs(width, 0, width, outW, filter);
  const vert = precomputeCoeffs(height, 0, height, outH, filter);
  const yFirst = vert.bounds[0];
  const yLast = vert.bounds[outH * 2 - 2] + vert.bounds[outH * 2 - 1];

  let src = data;
  let srcW = width;
  let srcH = height;
  let rowOffset = 0;
  if (needH) {
    // Pasada horizontal solo sobre las filas que usará la pasada vertical (igual que Pillow).
    const rows = yLast - yFirst;
    const tmp = new Uint8Array(outW * rows * channels);
    for (let y = 0; y < rows; y++) {
      const inRow = (y + yFirst) * width * channels;
      const outRow = y * outW * channels;
      for (let xx = 0; xx < outW; xx++) {
        const xmin = horiz.bounds[xx * 2];
        const xmax = horiz.bounds[xx * 2 + 1];
        const k = xx * horiz.ksize;
        for (let c = 0; c < channels; c++) {
          let ss = ONE / 2;
          for (let x = 0; x < xmax; x++) ss += data[inRow + (x + xmin) * channels + c] * horiz.kk[k + x];
          tmp[outRow + xx * channels + c] = clip8(ss);
        }
      }
    }
    src = tmp;
    srcW = outW;
    srcH = rows;
    rowOffset = yFirst;
  }
  if (!needV) {
    // Sin pasada vertical las filas usadas son todas (yFirst = 0).
    return src.length === outW * outH * channels ? src : src.slice(0, outW * outH * channels);
  }
  const out = new Uint8Array(outW * outH * channels);
  for (let yy = 0; yy < outH; yy++) {
    const ymin = vert.bounds[yy * 2] - rowOffset;
    const ymax = vert.bounds[yy * 2 + 1];
    const k = yy * vert.ksize;
    for (let xx = 0; xx < outW; xx++) {
      for (let c = 0; c < channels; c++) {
        let ss = ONE / 2;
        for (let y = 0; y < ymax; y++) ss += src[((y + ymin) * srcW + xx) * channels + c] * vert.kk[k + y];
        out[(yy * outW + xx) * channels + c] = clip8(ss);
      }
    }
  }
  void srcH;
  return out;
}

/** `PIL.Image.convert("L")`: luma ITU-R 601 con la aritmética entera de Pillow. */
export function toGray(rgb: Uint8Array, pixels: number): Uint8Array {
  const out = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) {
    out[i] = (rgb[i * 3] * 19595 + rgb[i * 3 + 1] * 38470 + rgb[i * 3 + 2] * 7471 + 0x8000) >>> 16;
  }
  return out;
}
