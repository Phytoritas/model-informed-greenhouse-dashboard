"""Export the saved KNU display mesh for the dashboard, without running twin-studio.

The source repository is read-only. Facility/detail triangles retain their source
coordinates, winding and sidedness. Only the repeated tomato-row LOD uses a
per-organ vertex-clustering approximation; it is never a scientific mesh.
"""

from __future__ import annotations

import argparse
from array import array
from collections import defaultdict
import json
from math import floor, isfinite, sqrt
from pathlib import Path
import sys


def normal(a, b, c):
    u = [b[i] - a[i] for i in range(3)]
    v = [c[i] - a[i] for i in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    length = sqrt(sum(x * x for x in n))
    return [x / length for x in n] if length > 1e-12 else None


def mesh_bounds(meshes):
    points = [p for mesh in meshes for p in mesh["vertices_enu_m"]]
    return {"min": [min(p[i] for p in points) for i in range(3)],
            "max": [max(p[i] for p in points) for i in range(3)]}


def clustered(vertices, triangles, cell):
    cells, members, remap = {}, [], []
    for p in vertices:
        key = tuple(floor(v / cell) for v in p)
        if key not in cells:
            cells[key] = len(members)
            members.append([])
        index = cells[key]
        members[index].append(p)
        remap.append(index)
    reduced = [[sum(p[i] for p in group) / len(group) for i in range(3)] for group in members]
    faces, seen = [], set()
    for tri in triangles:
        mapped = [remap[index] for index in tri]
        key = tuple(sorted(mapped))
        if len(set(mapped)) == 3 and key not in seen and normal(*(reduced[i] for i in mapped)):
            seen.add(key)
            faces.append(mapped)
    return reduced, faces


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.source.read_text(encoding="utf-8"))
    if source["coordinate_system"] != "WorldENU" or source["units"] != "m":
        raise ValueError("Only native WorldENU metre geometry is supported")
    meshes = source["meshes"]
    for mesh in meshes:
        if not all(len(p) == 3 and all(isfinite(v) for v in p) for p in mesh["vertices_enu_m"]):
            raise ValueError("Invalid source vertex")
        if not all(len(t) == 3 and all(isinstance(i, int) and 0 <= i < len(mesh["vertices_enu_m"]) for i in t) for t in mesh["triangles"]):
            raise ValueError("Invalid source triangle")
    plants = [m for m in meshes if m["group"].startswith("plant_")]
    facility = [m for m in meshes if not m["group"].startswith("plant_")]
    plant_origin = source["source"]["inputs"]["plant_origin_enu_m"]
    groups = defaultdict(list)
    for mesh in facility:
        groups[("facility", mesh["group"], mesh["sidedness"])].append(mesh)
    for target in ("tomatoDetail", "tomatoRows"):
        for mesh in plants:
            groups[(target, mesh["group"], mesh["sidedness"])].append(mesh)
    packed = bytearray()
    batches = []

    def pack(values, code):
        data = array(code, values)
        if sys.byteorder != "little":
            data.byteswap()
        offset = len(packed)
        packed.extend(data.tobytes())
        return {"byteOffset": offset, "length": len(data)}

    for (target, group, sidedness), group_meshes in groups.items():
        vertices, indices, lines, parts = [], [], [], []
        for mesh in group_meshes:
            points = mesh["vertices_enu_m"]
            triangles = mesh["triangles"]
            if target != "facility":
                points = [[p[i] - plant_origin[i] for i in range(3)] for p in points]
            if target == "tomatoRows":
                # Preserve slender stems; leaf/fruit LOD is display-only.
                cell = 0.012 if group == "plant_leaf" else 0.007
                points, triangles = clustered(points, triangles, cell)
            start = len(indices)
            vertex_start = len(vertices) // 6
            accum = [[0.0, 0.0, 0.0] for _ in points]
            edges = {}
            for tri in triangles:
                n = normal(*(points[i] for i in tri))
                if n is None:
                    continue
                indices.extend(vertex_start + i for i in tri)
                for index in tri:
                    for axis in range(3):
                        accum[index][axis] += n[axis]
                if target == "facility":
                    for a, b in zip(tri, (*tri[1:], tri[0])):
                        key = tuple(sorted((a, b)))
                        if key not in edges:
                            edges[key] = [1, n, False]
                        else:
                            edges[key][0] += 1
                            edges[key][2] |= sum(n[i] * edges[key][1][i] for i in range(3)) < 0.995
            for p, n in zip(points, accum):
                length = sqrt(sum(v * v for v in n))
                vertices.extend((*p, *([v / length for v in n] if length else [0.0, 0.0, 1.0])))
            for (a, b), (count, _, crease) in edges.items():
                if count == 1 or crease:
                    lines.extend((vertex_start + a, vertex_start + b))
            parts.append({"start": start, "count": len(indices) - start,
                          "center": [sum(p[i] for p in points) / len(points) for i in range(3)],
                          "sourceId": mesh.get("surface_id", mesh.get("owner_uuid"))})
        batches.append({"target": target, "group": group, "sidedness": sidedness,
                        "vertices": pack(vertices, "f"), "indices": pack(indices, "I"),
                        "lines": pack(lines, "I"), "parts": parts})

    info = source["source"]
    manifest = {
        "version": 1, "coordinateSystem": "WorldENU", "units": "m", "binary": "knu-scene.bin",
        "sourceFile": args.source.name, "facilityBounds": mesh_bounds(facility),
        "plantBounds": mesh_bounds(plants), "plantOrigin": plant_origin,
        "facilityFrame": info["frames"]["facility"],
        "site": {"name": "경북대 온실", "latitude": 35.89563490480227,
                 "longitude": 128.61344881397602, "utcOffsetHours": 9,
                 "source": "twin-studio/scripts/compute_knu_solar_position.py; user-provided 2026-09-07"},
        "sourceScope": {key: value for key, value in info.items() if key.endswith("_assembly")},
        "nativePlantCount": info["plant_instance_count"],
        "sourceOrganCounts": info["source_organ_counts"],
        "batches": batches,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "knu-scene.bin").write_bytes(packed)
    (args.output / "knu-scene.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"binary_bytes": len(packed), "batches": len(batches),
                      "triangle_counts": {target: sum(b["indices"]["length"] // 3 for b in batches if b["target"] == target)
                                          for target in ("facility", "tomatoDetail", "tomatoRows")}}, indent=2))


if __name__ == "__main__":
    main()
