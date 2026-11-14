import re, json
import numpy as np

def convert_lola_to_int16(lbl_path, img_path, out_path, downsample=1):
    """
    Converts a LOLA polar LDEM .IMG to a raw little-endian Int16 file.
    downsample: integer factor, block-averaged (e.g. 2 halves width/height).
    Writes out_path (.bin) and out_path + '.json' (metadata).
    Stored values are the original DN. height_m = DN * scale + offset
    (offset is relative to the reference sphere radius in the label).
    """
    # --- read the label ---
    text = open(lbl_path, errors="ignore").read()
    def get(key, cast=float, default=None):
        m = re.search(rf"^\s*{key}\s*=\s*([^\s<]+)", text, re.M)
        return cast(m.group(1).strip('"')) if m else default

    lines   = get("LINES", int)
    samples = get("LINE_SAMPLES", int)
    scale   = get("SCALING_FACTOR", float, 1.0)
    offset  = get("OFFSET", float, 0.0)
    mpp     = get("MAP_SCALE", float)           # meters per pixel
    radius  = get("A_AXIS_RADIUS", float, 1737.4)  # km, may be absent
    print(f"LBL: {samples}x{lines}, scale={scale}, offset={offset}, mpp={mpp}")

    # --- read the raw image ---
    arr = np.memmap(img_path, dtype="<i2", mode="r", shape=(lines, samples))

    # --- optional downsample (block mean) ---
    if downsample > 1:
        f = downsample
        h, w = (lines // f) * f, (samples // f) * f
        blocks = arr[:h, :w].reshape(h // f, f, w // f, f)
        arr = np.rint(blocks.mean(axis=(1, 3))).astype("<i2")
        mpp = mpp * f if mpp else None
        lines, samples = h // f, w // f
    else:
        arr = np.asarray(arr)

    # --- write binary ---
    arr.astype("<i2").tofile(out_path)

    meta = {
        "width": samples, "height": lines,
        "dtype": "int16", "endian": "little",
        "scale": scale, "offset": offset,
        "metersPerPixel": mpp,
        "projection": "polar stereographic, south pole, center lon 0",
        "refRadiusKm": radius,
    }
    with open(out_path + ".json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Wrote {out_path} ({arr.nbytes/1e6:.1f} MB)")

# usage
convert_lola_to_int16(
    "LDEM_80S_120M.LBL",
    "LDEM_80S_120M.IMG",
    "south_pole_120m.bin",
    downsample=1,   # try 2 to get ~12 MB
)
