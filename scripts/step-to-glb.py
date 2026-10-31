"""
Converts a STEP file (CAD export) into a GLB for the 3D viewer: one mesh per solid, Y-up, metres,
hard edges kept sharp, in the site's colours (paper grey, chosen solids in the red accent).

    python3 -m venv .venv-cad && .venv-cad/bin/pip install build123d trimesh
    .venv-cad/bin/python scripts/step-to-glb.py part.step public/models/part.glb --list
    .venv-cad/bin/python scripts/step-to-glb.py part.step public/models/part.glb --red 3,5

--list prints the solids (index, volume, size) so you can pick the ones to colour red.
The venv is gitignored; nothing here is needed for the build.
"""

import argparse

import numpy as np
import trimesh
from build123d import import_step


def linear(srgb):
    """glTF stores base colours in linear light; trimesh writes the bytes as they are."""
    c = np.array(srgb) / 255
    return [*np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4), 1.0]


PAPER = linear([186, 182, 172])  # printed parts, a grey that reads on the --c-surface stage
RED = linear([232, 64, 31])  # --c-accent

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('step')
parser.add_argument('glb')
parser.add_argument('--red', default='', help='comma-separated solid indices to colour red')
parser.add_argument('--list', action='store_true', help='print the solids')
parser.add_argument('--tolerance', type=float, default=0.04, help='chord tolerance in mm')
args = parser.parse_args()

red = {int(i) for i in args.red.split(',') if i}
solids = import_step(args.step).solids()
scene = trimesh.Scene()
for i, solid in enumerate(solids):
    if args.list:
        size = solid.bounding_box().size
        print(f'{i}: {solid.volume:,.0f} mm³, {size.X:.1f} × {size.Y:.1f} × {size.Z:.1f} mm')
    verts, tris = solid.tessellate(tolerance=args.tolerance, angular_tolerance=0.25)
    # STEP is Z-up in millimetres, glTF is Y-up in metres.
    vertices = np.array([(p.X, p.Z, -p.Y) for p in verts]) / 1000
    mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(tris))
    mesh.merge_vertices()
    mesh = trimesh.graph.smooth_shade(mesh, angle=np.radians(30))
    mesh.visual = trimesh.visual.TextureVisuals(
        material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=RED if i in red else PAPER, metallicFactor=0, roughnessFactor=0.6
        )
    )
    scene.add_geometry(mesh, node_name=f'solid-{i}', geom_name=f'solid-{i}')

scene.export(args.glb)
print(f'{args.glb}: {len(solids)} solids, {sum(len(g.faces) for g in scene.geometry.values()):,} triangles')
