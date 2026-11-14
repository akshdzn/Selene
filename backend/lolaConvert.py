import os
import re
import json
import argparse
import numpy as np

def resolve_path(filename, search_dirs=None):
    """Finds filename in given search directories or relative to script/cwd."""
    if os.path.exists(filename):
        return filename
    if search_dirs is None:
        search_dirs = [
            os.path.dirname(os.path.abspath(__file__)),
            os.path.join(os.getcwd(), "backend"),
            os.getcwd(),
        ]
    for d in search_dirs:
        candidate = os.path.join(d, filename)
        if os.path.exists(candidate):
            return candidate
    return filename

def convert_lola_to_int16(lbl_path, img_path, out_path, downsample=4):
    """
    Converts a LOLA polar stereographic LDEM (.LBL + .IMG) to a raw Int16 binary (.bin + .json).
    Automatically reads all projection parameters, scaling, and dimensions from the .LBL file.
    
    :param lbl_path: Path to the .LBL label file
    :param img_path: Path to the .IMG raw image file
    :param out_path: Path to output .bin file (will also write out_path + '.json')
    :param downsample: Integer factor (e.g. 1 = original 20m, 2 = 40m, 4 = 80m)
    """
    lbl_file = resolve_path(lbl_path)
    img_file = resolve_path(img_path)

    if not os.path.exists(lbl_file):
        raise FileNotFoundError(f"Label file not found: {lbl_path}")
    if not os.path.exists(img_file):
        raise FileNotFoundError(f"Image file not found: {img_path}")

    text = open(lbl_file, errors="ignore").read()

    def get(key, cast=float, default=None):
        m = re.search(rf"^\s*{key}\s*=\s*([^\s<]+)", text, re.M)
        return cast(m.group(1).strip('"')) if m else default

    lines = get("LINES", int)
    samples = get("LINE_SAMPLES", int)
    scale = get("SCALING_FACTOR", float, 1.0)
    offset = get("OFFSET", float, 0.0)
    mpp = get("MAP_SCALE", float, 20.0)
    radius = get("A_AXIS_RADIUS", float, 1737.4)
    max_lat = get("MAXIMUM_LATITUDE", float, -87.5)
    min_lat = get("MINIMUM_LATITUDE", float, -90.0)
    line_offset = get("LINE_PROJECTION_OFFSET", float, (lines + 1) / 2.0)
    sample_offset = get("SAMPLE_PROJECTION_OFFSET", float, (samples + 1) / 2.0)

    print(f"Reading {os.path.basename(lbl_file)}:")
    print(f"  Dimensions: {samples} x {lines} (Line Samples x Lines)")
    print(f"  Resolution: {mpp} m/pixel, Latitude range: [{min_lat}°, {max_lat}°]")
    print(f"  Scaling Factor: {scale}, Offset: {offset} m, Ref Radius: {radius} km")

    # Read binary raw image
    arr = np.memmap(img_file, dtype="<i2", mode="r", shape=(lines, samples))

    if downsample > 1:
        f = int(downsample)
        h, w = (lines // f) * f, (samples // f) * f
        print(f"Downsampling by factor of {f} (block average)...")
        blocks = arr[:h, :w].reshape(h // f, f, w // f, f)
        arr = np.rint(blocks.mean(axis=(1, 3))).astype("<i2")
        mpp = mpp * f
        lines, samples = h // f, w // f
        line_offset = line_offset / f
        sample_offset = sample_offset / f
    else:
        arr = np.asarray(arr)

    # Ensure output directory exists
    out_dir = os.path.dirname(os.path.abspath(out_path))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # Save Int16 binary file
    arr.astype("<i2").tofile(out_path)

    # Save JSON metadata
    meta = {
        "width": samples,
        "height": lines,
        "dtype": "int16",
        "endian": "little",
        "scale": scale,
        "offset": offset,
        "metersPerPixel": mpp,
        "projection": "polar stereographic, south pole, center lon 0",
        "refRadiusKm": radius,
        "maxLat": max_lat,
        "minLat": min_lat,
        "lineProjectionOffset": line_offset,
        "sampleProjectionOffset": sample_offset,
        "source": os.path.basename(img_file),
    }

    json_path = out_path + ".json"
    with open(json_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Successfully generated:")
    print(f"  Binary:   {out_path} ({arr.nbytes / 1e6:.2f} MB, {samples}x{lines} @ {mpp:.1f} m/pix)")
    print(f"  Metadata: {json_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert LOLA 87.5S DEM to Int16 binary + JSON metadata")
    parser.add_argument("--lbl", default="LDEM_875S_20M.LBL", help="Path to LOLA .LBL file")
    parser.add_argument("--img", default="LDEM_875S_20M.IMG", help="Path to LOLA .IMG file")
    parser.add_argument("--out", default=None, help="Output .bin path (default auto-named based on resolution)")
    parser.add_argument("--downsample", type=int, default=4, help="Downsample factor (e.g. 1=20m, 2=40m, 4=80m)")

    args = parser.parse_args()

    # Determine default output file name if not provided
    if args.out is None:
        eff_mpp = int(20 * args.downsample)
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        args.out = os.path.join(backend_dir, f"south_pole_875s_{eff_mpp}m.bin")

    convert_lola_to_int16(
        lbl_path=args.lbl,
        img_path=args.img,
        out_path=args.out,
        downsample=args.downsample,
    )
