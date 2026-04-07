# FloorPlan Studio

A browser-based floorplan app for planning renovations with **exact metric dimensions**.

## Features

- Set overall house dimensions (width, length), wall thickness, and wall height.
- Measure area in square meters automatically.
- Draw interior walls by entering start/end coordinates in meters.
- Place furniture from a large editable catalog with real-world dimensions.
- Add your own custom furniture dimensions and categories.
- Upload a blueprint/reference image and trace it in the 2D editor.
- Move placed furniture interactively in the 2D canvas.
- View the same layout in 3D and orbit the camera freely.

## Quick start

Because this app uses ES Modules, run with a local server.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Notes

- This version is built as a foundation for a Planner5D/Maket-style workflow.
- The furniture catalog is preloaded with many common items and can be expanded in `data/furnitureCatalog.js`.
- You can create advanced constraints (snap, wall attachment rules, door/window cutouts, material editor, exports) on top of the current architecture.
