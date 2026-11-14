import re, json
import numpy as np

def convert_lola_to_int16(lbl_path, img_path, out_path, downsample=1):
    text = open(lbl_path, errors="ignore").read()

    def get(key, cast=float, default=None):
        m = re.search(rf"^\s*{key}\s*=\s*([^\s<]+)", text, re.M)
        return cast(m.group(1).strip('"')) if m else default

    lines   = get("LINES", int)
    samples = get("LINE_SAMPLES", int)
    scale   = get("SCALING_FACTOR", float, 1.0)
    offset  = get("OFFSET", float, 0.0)
    mpp     = get("MAP_SCALE", float)
    radius  = get("A_AXIS_RADIUS", float, 1737.4)
    print(f"LBL: {samples}x{lines}, scale={scale}, offset={offset}, mpp={mpp}")

    arr = np.memmap(img_path, dtype="<i2", mode="r", shape=(lines, samples))

    if downsample > 1:
        f = downsample
        h, w = (lines // f) * f, (samples // f) * f
        blocks = arr[:h, :w].reshape(h // f, f, w // f, f)
        arr = np.rint(blocks.mean(axis=(1, 3))).astype("<i2")
        mpp = mpp * f if mpp else None
        lines, samples = h // f, w // f
    else:
        arr = np.asarray(arr)

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

if __name__ == "__main__":
    convert_lola_to_int16(
        "LDEM_80S_80M.LBL",
        "LDEM_80S_80M.IMG",
        "south_pole_320m.bin",
        downsample=4,
    )
