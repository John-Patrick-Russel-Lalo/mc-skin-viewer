// Variables and Dom Elements
const ButtonDownload = document.getElementById('Button-Download');
const SliderFov = document.getElementById('slider-zoom');
const isOverlayChecked = document.getElementById('isOverlay');
const labelCheckbox = document.getElementById('textCheckbox');
const SkinUpload = document.getElementById('Skin-Upload');
const skinName = document.getElementById('skinName');
const stageHint = document.getElementById('stage-hint');
const stageLoading = document.getElementById('stage-loading');
const containerDiv = document.getElementById('container-3d');
const skinSlots = [...document.querySelectorAll('#skin-examples .slot')];

// Three.js Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(containerDiv.clientWidth, containerDiv.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio * 2 || 2);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.background = new THREE.Color(
  getComputedStyle(document.documentElement)
    .getPropertyValue('--guv')
    .trim() || 0xc6c6c6
);

containerDiv.style.display = "none";
containerDiv.appendChild(renderer.domElement);

// Lighting
const Dlight = new THREE.DirectionalLight(0xdddddd, 1.2);
Dlight.position.set(15, 5, 10);
scene.add(Dlight);

const AMlight = new THREE.AmbientLight(0xffffff, 1);
scene.add(AMlight);

// Orbit Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
camera.position.set(0, 1, 60);
camera.updateProjectionMatrix();

controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = true;
controls.update();
controls.addEventListener('change', saveSettings);
controls.addEventListener('start', () => stageHint.classList.add('is-hidden'));

// Variables for Models
let overlayModel = null;
let notOverlayModel = null;

// Currently applied skin: an example url, a data url, or null while loading
let currentSkin = null;

// Texture Loader
const textureLoader = new THREE.TextureLoader();

/* === Model Loading === */

function loadModel(loader, url, onLoad) {
  return new Promise((resolve) => {
    loader.load(url, (gltf) => {
      onLoad(gltf.scene);
      resolve(gltf.scene);
    });
  });
}

function loadModels() {
  const loader = new THREE.GLTFLoader();

  return Promise.all([
    // Non-Overlay Model
    loadModel(loader, './model/model.gltf', (model) => {
      notOverlayModel = model;
      configureModelMaterial(notOverlayModel);
      scene.add(notOverlayModel);
    }),

    // Overlay Model
    loadModel(loader, './model/FinalHeadLayer.gltf', (model) => {
      overlayModel = model;
      configureModelMaterial(overlayModel);
      overlayModel.visible = false;
      scene.add(overlayModel);
    }),
  ]).then(() => {
    toggleModelVisibility();
    stageLoading.classList.add('is-hidden');
    applyCurrentSkin();
  });
}

// Configure Materials for Default Models
function configureModelMaterial(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0x808080,
        metalness: 0.1,
      });
      child.material.needsUpdate = true;
    }
  });
}

/* === Model Visibility Toggle === */
function toggleModelVisibility() {
  if (overlayModel && notOverlayModel) {
    overlayModel.visible = isOverlayChecked.checked;
    notOverlayModel.visible = !isOverlayChecked.checked;

    labelCheckbox.textContent = isOverlayChecked.checked
      ? 'Overlay On'
      : 'Overlay Off';
  }
  saveSettings();
}

/* === Texture Handling === */
function upscaleTexture(texture, scaleValue = 20) {
  const canvas = document.createElement('canvas');
  canvas.width = texture.image.width * scaleValue;
  canvas.height = texture.image.height * scaleValue;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);

  const upscaledTexture = new THREE.Texture(canvas);
  upscaledTexture.magFilter = THREE.NearestFilter;
  upscaledTexture.minFilter = THREE.NearestFilter;
  upscaledTexture.generateMipmaps = false;
  upscaledTexture.needsUpdate = true;

  return upscaledTexture;
}

function applyTexture(texture) {
  [overlayModel, notOverlayModel].forEach((model) => {
    if (!model) return;

    model.traverse((child) => {
      if (child.isMesh) {
        child.material.map = texture;
        child.material.transparent = true;
        child.material.alphaTest = 0.1;
        child.material.side = THREE.DoubleSide;
        child.material.receiveShadow = true;
        child.material.castShadow = true;
        child.material.needsUpdate = true;
      }
    });
  });
}

function loadSkin(url, label) {
  currentSkin = { url, label };
  skinName.textContent = label;
  skinName.title = label;

  if (!overlayModel || !notOverlayModel) return;

  textureLoader.load(url, (texture) => {
    applyTexture(upscaleTexture(texture));
  });
}

function applyCurrentSkin() {
  if (currentSkin) loadSkin(currentSkin.url, currentSkin.label);
}

function applySkin(file) {
  if (file.type !== 'image/png') {
    alert('Please upload a PNG file.');
    SkinUpload.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    skinSlots.forEach((slot) => slot.classList.remove('is-active'));
    loadSkin(e.target.result, file.name);
  };

  reader.readAsDataURL(file);
}

function selectSkin(slot) {
  skinSlots.forEach((item) => item.classList.toggle('is-active', item === slot));
  loadSkin(slot.dataset.skin, slot.dataset.name);
}

/* === Slider === */
function applyFov(value) {
  camera.fov = 101 - value * 2;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const min = SliderFov.min;
  const max = SliderFov.max;
  const percentage = ((value - min) / (max - min)) * 100;
  SliderFov.style.setProperty('--fill', `${percentage}%`);

  saveSettings();
}

/* === Event Listeners === */
skinSlots.forEach((slot) => {
  slot.querySelector('.slot__face').style.backgroundImage = `url("${slot.dataset.skin}")`;
  slot.addEventListener('click', () => selectSkin(slot));
});

SkinUpload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) applySkin(file);
});

isOverlayChecked.addEventListener('change', toggleModelVisibility);

SliderFov.addEventListener('input', () => {
  applyFov(SliderFov.value);
});

ButtonDownload.addEventListener('click', () => {
  renderer.render(scene, camera);
  const imageData = renderer.domElement.toDataURL('image/png');

  const link = document.createElement('a');
  link.href = imageData;
  link.download = 'mc-head.png';
  link.click();
});

function resizeRenderer() {
  const width = containerDiv.clientWidth;
  const height = containerDiv.clientHeight;
  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

new ResizeObserver(resizeRenderer).observe(containerDiv);

window.addEventListener('resize', resizeRenderer);

function saveSettings() {
  localStorage.setItem("fov", SliderFov.value);
  localStorage.setItem("isoverlay", isOverlayChecked.checked);
  localStorage.setItem("cameraAngleX", JSON.stringify(camera.position.x));
  localStorage.setItem("cameraAngleY", JSON.stringify(camera.position.y));
  localStorage.setItem("cameraAngleZ", JSON.stringify(camera.position.z));
}

function loadSettings() {
  const savedFov = localStorage.getItem("fov");
  const savedIsoverlay = localStorage.getItem("isoverlay");
  const savedCamX = localStorage.getItem("cameraAngleX");
  const savedCamY = localStorage.getItem("cameraAngleY");
  const savedCamZ = localStorage.getItem("cameraAngleZ");

  if (savedFov !== null) {
    SliderFov.value = savedFov;
    applyFov(savedFov);
  } else {
    SliderFov.value = 50;
    applyFov(50);
  }

  if (savedCamX && savedCamY) {
    camera.position.x = JSON.parse(savedCamX);
    camera.position.y = JSON.parse(savedCamY);
    camera.position.z = JSON.parse(savedCamZ);
  } else {
    camera.position.x = -35.10;
    camera.position.y = 30.10;
  }

  if (savedIsoverlay !== null) {
    isOverlayChecked.checked = savedIsoverlay === 'true';
  }
}

/* === Animation Loop === */
function animate() {
  requestAnimationFrame(animate);
  Dlight.position.copy(camera.position);
  controls.update();
  renderer.render(scene, camera);
}

/* === Initialization === */
function init() {
  containerDiv.style.display = 'block';
  loadSettings();
  selectSkin(skinSlots.find((slot) => slot.classList.contains('is-active')) || skinSlots[0]);
  loadModels();
  animate();
}

// Start Application
init();
