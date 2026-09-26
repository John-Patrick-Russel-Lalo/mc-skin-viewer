# MC Head Viewer

A Minecraft head skin viewer built with Three.js. Drag to rotate, pick a skin,
toggle the second layer, and capture a PNG.

---

## Why is this project only three files?

`index.html`, `main.js`, `style.css` — that's it. No `package.json`, no bundler,
no framework, no build step, no `dist/`. This is on purpose, and the reason is
simple: **the goal of this repo is to show how the whole thing works, not to be
a production app template.**

Most 3D web projects start behind a wall of tooling. You run `npm create vite`,
install 200 dependencies, and the actual Three.js code is buried in a folder
called `src/components/Scene.tsx` behind 6 layers of abstraction. You can't see
what the browser runs, and you can't tell which parts matter.

Here you get the opposite. Everything is visible:

| Concern | Where it lives |
| --- | --- |
| What exists on screen | `index.html` — every button, slider and div |
| How it looks | `style.css` — pure CSS, no preprocessor |
| How it moves | `main.js` — the entire 3D app, top to bottom |

Concretely, this buys a few things:

**Zero setup.** Double-click `index.html` and it runs. No install, no dev server,
no waiting, no "command not found". Good for teaching, tinkering, or opening on
a machine that isn't yours.

**The whole lifecycle is readable in one pass.** You can read `main.js` from
line 1 to the last line and see the complete order of events: create scene →
create camera → create renderer → add lights → load models → load texture →
start the animation loop. No file hopping, no circular imports, no
`useEffect(() => {...}, [])` to decode.

**Three.js is loaded exactly as the docs describe it.** The library and its
addons come straight from a CDN in plain `<script>` tags, so the code you read
here is the same code you'd find in the official examples — just without the
framework wrapper. `THREE.Scene` means literally `THREE.Scene`.

**It's a small app.** One screen, one model, one texture. Spreading ~300 lines of
JavaScript across ten modules would be architecture for its own sake.

The trade-off: no code splitting, no minification, no TypeScript types, no
dependency pinning, and the Three.js version is pinned to r128 in a URL you
could forget to update. That's fine here. If this grew into something bigger,
that's the moment to reach for Vite — and at that point you'll already
understand exactly what the tooling is doing for you.

---

## Project structure

```
├── index.html   markup + the Three.js <script> tags
├── main.js      the whole application
├── style.css    all styling, Minecraft-style CSS variables
├── model/       .gltf head models (geometry embedded in the file)
│   ├── model.gltf              base head
│   └── FinalHeadLayer.gltf     the second-layer / hat version
├── skins/       example 64x64 skin PNGs
└── tools/       generate-skins.js — offline script to make skin textures
```

## Running it

Open `index.html` in a browser. That's it.

If your browser is strict about `localStorage` or loading local files, serve the
folder instead:

```bash
npx serve .
```

---

# Tutorial: learning Three.js from this project

Three.js sounds intimidating, but the whole library is really just **five ideas
repeated forever**. Learn these five and you can read any Three.js code,
including `main.js`.

## The five core pieces

1. **Scene** — the list of everything that exists in your world.
2. **Camera** — the eye you look through.
3. **Renderer** — draws the scene through the camera onto a canvas.
4. **Light** — without it, meshes are black.
5. **Animation loop** — called ~60 times a second: move things, then render.

## Step 1 — A spinning cube, the smallest possible app

Make a file called `test.html` and open it. Nothing else needed.

```html
<!DOCTYPE html>
<html>
  <body style="margin:0">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script>
      // 1. Where things exist
      const scene = new THREE.Scene();

      // 2. Your eye. (field of view, aspect, near, far)
      const camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
      );
      camera.position.z = 3;

      // 3. The thing that draws
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(renderer.domElement);

      // 4. An object, and light
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffd83d })
      );
      scene.add(cube);
      scene.add(new THREE.AmbientLight(0xffffff, 1));

      // 5. The loop
      function animate() {
        requestAnimationFrame(animate);
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
      }
      animate();
    </script>
  </body>
</html>
```

That's a complete Three.js app. Everything in `main.js` is this same pattern
with more detail.

**Note the code convention:** `new THREE.Thing` takes a *geometry* (what shape,
how big) and a *material* (what colour, shiny, see-through). A `Mesh` is the
combination of the two. You will see this pair everywhere.

## Step 2 — The coordinate system, so rotations make sense

```
        +Y  (up)
         |
         |      +Z  (out of the screen, toward you)
         |     /
         |    /
         |   /
    -----+-------- +X  (right)
      (origin)
```

`+X` is right, `+Y` is up, `+Z` comes out of the screen toward the viewer.
Positions are `object.position.set(x, y, z)`.

Which is why the camera setup in `main.js` makes sense:

```js
camera.position.set(0, 1, 60);   // main.js:40 — 60 units back along +Z
```

`60` is far, not `3` like the cube, because the model is exported in millimetre
scale. **Always check your units** — a Blender export at 1 unit = 1 cm will need
a very different camera distance than a cube at 1 unit = 1 m.

## Step 3 — Let the user look around: OrbitControls

Hardcoding `camera.position` means the user can't explore. OrbitControls lets
them drag to orbit and scroll to zoom.

Because the addons aren't in the main `three.min.js` file, load them as extra
scripts — the order matters, Three.js must come first:

```html
<script src=".../three.min.js"></script>
<script src=".../OrbitControls.js"></script>
```

Then (main.js:39-48):

```js
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;    // lock the camera to the object
controls.enableZoom = false;   // we provide our own zoom slider
controls.enableDamping = true; // smooth, not snappy
controls.update();             // must be called or the camera snaps on first drag
```

`controls.update()` inside the animation loop is what makes damping feel smooth —
forget it and dragging feels broken.

## Step 4 — Loading a real 3D model: GLTFLoader

`.gltf` / `.glb` is the modern interchange format for 3D models (think "PNG for
3D"). `GLTFLoader` fetches the file and hands you back a **group** of objects.

```js
const loader = new THREE.GLTFLoader();
loader.load('./model/model.gltf', (gltf) => {
  scene.add(gltf.scene);   // the loaded model is gltf.scene
});
```

**Loading is asynchronous.** The file isn't there yet on line 1 — it arrives
later. That's why it's a callback, and why `main.js` wraps it in a Promise
(main.js:62-69) so it can wait for *both* models before doing anything:

```js
Promise.all([loadModel(a), loadModel(b)]).then(() => {
  // both are ready now
});
```

**`traverse()` walks every child, including grandchildren.** Models are
hierarchies — a head can contain a nose, an eye, a hat. To change the material
on everything at once:

```js
model.traverse((child) => {
  if (child.isMesh) {
    child.material = new THREE.MeshStandardMaterial({ color: 0x808080 });
  }
});
```

`child.isMesh` is how you ask "is this one of the visible drawable parts?" The
rest are empties and groups used for positioning.

**`visible` is the cheapest way to switch things on and off** (main.js:112-113):

```js
overlayModel.visible = isOverlayChecked.checked;
```

Hidden objects cost nothing to draw — no need to add/remove from the scene.

## Step 5 — Textures: pasting an image onto a model

A material's `map` is the image painted on the surface:

```js
child.material.map = texture;
```

Load one with `TextureLoader` (main.js:165):

```js
const textureLoader = new THREE.TextureLoader();
textureLoader.load('skins/steve.png', (texture) => { /* ... */ });
```

Minecraft skins are 64×64 pixel art. Scaled up they turn to mush unless you tell
Three.js **not** to blend the pixels (main.js:132-134):

```js
texture.magFilter = THREE.NearestFilter;   // when magnified
texture.minFilter = THREE.NearestFilter;   // when shrunk
```

`NearestFilter` = hard pixel edges (correct for pixel art).
`LinearFilter` = smooth blur (correct for photos). Setting both plus
`generateMipmaps = false` is the standard "crisp pixel art" recipe.

### Bonus: the canvas trick (main.js:123-138)

The skin is *premultiplied onto a big canvas* before it becomes a texture. Why?
Because the model geometry uses a few pixels of transparency to round off the
edges, and a 64×64 image stretched across it loses that. `drawImage` scales the
skin up ~20× onto a larger canvas first, so there's more real pixel data for the
mesh to sample:

```js
const canvas = document.createElement('canvas');
canvas.width = texture.image.width * 20;
ctx.imageSmoothingEnabled = false;   // same pixel-art rule
ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);

const upscaled = new THREE.Texture(canvas);  // a texture from a canvas works
```

The transparent parts of a Minecraft skin are handled by these three material
settings (main.js:147-149):

```js
child.material.transparent = true;   // respect alpha
child.material.alphaTest = 0.1;     // throw away near-invisible pixels
child.material.side = THREE.DoubleSide; // draw back faces too
```

`alphaTest` is the important one. It's a hard cutoff, so those discarded pixels
don't write to the depth buffer — which stops the invisible parts of the skin
from casting ugly shadows over the face.

## Step 6 — Resizing correctly

Cameras don't know how big they'll be, so you tell them:

```js
function resizeRenderer() {
  const width = containerDiv.clientWidth;
  const height = containerDiv.clientHeight;
  camera.aspect = width / height;      // must match the canvas shape
  camera.updateProjectionMatrix();     // required after changing aspect/fov
  renderer.setSize(width, height);
}
```

Two things beginners always miss:

- **`updateProjectionMatrix()`** after changing `aspect` or `fov`. Change the
  number, call that, or nothing happens. The zoom slider (main.js:197-198) does
  exactly this.
- **`devicePixelRatio`** for sharp output on retina screens (main.js:19):
  `renderer.setPixelRatio(window.devicePixelRatio * 2)`. Without it, your 3D
  looks blurry on a Mac while the CSS UI stays crisp.

`ResizeObserver` (main.js:246) is the modern way to catch size changes — it
fires when *any* element resizes, not just `window`, so it works when a sidebar
opens or the window is dragged.

## Step 7 — Saving a PNG

The renderer's canvas is already an image, so exporting is one line
(main.js:226-234):

```js
renderer.render(scene, camera);                    // make sure it's current
const imageData = renderer.domElement.toDataURL('image/png');
const link = document.createElement('a');
link.href = imageData;
link.download = 'mc-head.png';
link.click();
```

`toDataURL()` returns a `data:` URL — the image encoded as text. Setting it as
an `<a>`'s `href` and calling `click()` triggers a download without touching the
filesystem.

## Step 8 — Saving user settings

Three.js has no opinion about this, so `main.js` uses plain `localStorage`
(main.js:250-285). The only Three.js-specific part is saving the camera, so the
view resets to where the user left it:

```js
localStorage.setItem('cameraAngleX', JSON.stringify(camera.position.x));
```

And note the order of operations in `init()` (main.js:296-302): `loadSettings()`
must run **before** `animate()` starts, or the camera gets overwritten one frame
later.

---

## How the pieces map back to `main.js`

| Concept | Where |
| --- | --- |
| Scene, camera, renderer | `main.js:14-28` |
| Lights | `main.js:31-36` |
| OrbitControls | `main.js:39-48` |
| GLTFLoader + Promise.all | `main.js:62-94` |
| `traverse()` + material setup | `main.js:97-107` |
| `visible` toggle | `main.js:110-120` |
| Pixel-art canvas upscale | `main.js:123-138` |
| Texture + transparency | `main.js:140-168` |
| Resize + pixel ratio | `main.js:19, 236-248` |
| PNG export | `main.js:226-234` |
| localStorage save/load | `main.js:250-285` |
| Animation loop | `main.js:288-293` |

## Where to go next

- Add a `MeshStandardMaterial` roughness/metalness playground to see what
  lighting does.
- Replace the skin slots with a drag-and-drop upload.
- Try `three` r180+ via an import map and ES modules — compare how much cleaner
  the imports are, then decide if the complexity is worth it for your project.
