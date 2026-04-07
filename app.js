import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js";
import { baseFurnitureCatalog } from "./data/furnitureCatalog.js";

const state = {
  house: { width: 12, length: 10, wallHeight: 2.8, wallThickness: 0.2 },
  walls: [],
  furnitureCatalog: [...baseFurnitureCatalog],
  furniture: [],
  selectedObjectId: null,
  blueprint: null,
  blueprintOpacity: 0.35,
};

const ui = {
  houseWidth: document.getElementById("houseWidth"),
  houseLength: document.getElementById("houseLength"),
  wallHeight: document.getElementById("wallHeight"),
  wallThickness: document.getElementById("wallThickness"),
  areaSummary: document.getElementById("areaSummary"),
  addWall: document.getElementById("addWall"),
  wallX1: document.getElementById("wallX1"),
  wallY1: document.getElementById("wallY1"),
  wallX2: document.getElementById("wallX2"),
  wallY2: document.getElementById("wallY2"),
  applyDimensions: document.getElementById("applyDimensions"),
  resetLayout: document.getElementById("resetLayout"),
  categoryFilter: document.getElementById("categoryFilter"),
  furnitureSelect: document.getElementById("furnitureSelect"),
  furnX: document.getElementById("furnX"),
  furnY: document.getElementById("furnY"),
  furnRot: document.getElementById("furnRot"),
  addFurniture: document.getElementById("addFurniture"),
  addCustomFurniture: document.getElementById("addCustomFurniture"),
  customName: document.getElementById("customName"),
  customCategory: document.getElementById("customCategory"),
  customWidth: document.getElementById("customWidth"),
  customDepth: document.getElementById("customDepth"),
  customHeight: document.getElementById("customHeight"),
  customWallMounted: document.getElementById("customWallMounted"),
  placedList: document.getElementById("placedList"),
  planCanvas: document.getElementById("planCanvas"),
  blueprintUpload: document.getElementById("blueprintUpload"),
  blueprintOpacity: document.getElementById("blueprintOpacity"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
};

const ctx = ui.planCanvas.getContext("2d");
let dragOffset = null;

const three = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  roomGroup: null,
  furnGroup: null,
};

function mToPx(m) {
  const margin = 50;
  const scaleX = (ui.planCanvas.width - margin * 2) / state.house.width;
  const scaleY = (ui.planCanvas.height - margin * 2) / state.house.length;
  return Math.min(scaleX, scaleY) * m;
}

function toCanvas(x, y) {
  const margin = 50;
  const scale = mToPx(1);
  return { x: margin + x * scale, y: margin + y * scale };
}

function render2D() {
  ctx.clearRect(0, 0, ui.planCanvas.width, ui.planCanvas.height);
  if (state.blueprint) {
    const origin = toCanvas(0, 0);
    ctx.save();
    ctx.globalAlpha = state.blueprintOpacity;
    ctx.drawImage(state.blueprint, origin.x, origin.y, mToPx(state.house.width), mToPx(state.house.length));
    ctx.restore();
  }

  const topLeft = toCanvas(0, 0);
  ctx.strokeStyle = "#78b8ff";
  ctx.lineWidth = 3;
  ctx.strokeRect(topLeft.x, topLeft.y, mToPx(state.house.width), mToPx(state.house.length));

  state.walls.forEach((w, i) => {
    const a = toCanvas(w.x1, w.y1);
    const b = toCanvas(w.x2, w.y2);
    ctx.strokeStyle = "#c8d4ea";
    ctx.lineWidth = Math.max(2, mToPx(state.house.wallThickness));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1).toFixed(2);
    ctx.fillStyle = "#dce7ff";
    ctx.fillText(`${len} m`, mid.x + 6, mid.y - 4);
    ctx.fillText(`#${i + 1}`, mid.x + 6, mid.y + 12);
  });

  state.furniture.forEach((item) => {
    const center = toCanvas(item.x, item.y);
    const w = mToPx(item.width);
    const d = mToPx(item.depth);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.fillStyle = item.id === state.selectedObjectId ? "#6dd4a6" : item.wallMounted ? "#f6c86f" : "#7f9dff";
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.strokeStyle = "#0b101b";
    ctx.strokeRect(-w / 2, -d / 2, w, d);
    ctx.fillStyle = "#081225";
    ctx.font = "11px sans-serif";
    ctx.fillText(item.name.slice(0, 20), -w / 2 + 4, 3);
    ctx.restore();
  });

  ctx.fillStyle = "#bcd0ef";
  ctx.font = "12px sans-serif";
  ctx.fillText(`House: ${state.house.width.toFixed(2)}m × ${state.house.length.toFixed(2)}m`, 18, 20);
}

function updateAreaSummary() {
  ui.areaSummary.textContent = `Area: ${(state.house.width * state.house.length).toFixed(2)} m²`;
}

function refreshCatalogControls() {
  const categories = ["All", ...new Set(state.furnitureCatalog.map((f) => f.category))];
  ui.categoryFilter.innerHTML = categories.map((c) => `<option>${c}</option>`).join("");
  updateFurnitureSelect();
}

function updateFurnitureSelect() {
  const cat = ui.categoryFilter.value || "All";
  const list = state.furnitureCatalog.filter((f) => cat === "All" || f.category === cat);
  ui.furnitureSelect.innerHTML = list
    .map((f, idx) => `<option value="${idx}">${f.name} (${f.width}×${f.depth}×${f.height}m)</option>`)
    .join("");
  ui.furnitureSelect.dataset.source = JSON.stringify(list);
}

function placeFurniture() {
  const filtered = JSON.parse(ui.furnitureSelect.dataset.source || "[]");
  const selected = filtered[Number(ui.furnitureSelect.value)];
  if (!selected) return;

  state.furniture.push({
    ...selected,
    x: Number(ui.furnX.value),
    y: Number(ui.furnY.value),
    z: selected.wallMounted ? 1.5 : selected.height / 2,
    rotation: Number(ui.furnRot.value),
    id: crypto.randomUUID(),
  });
  renderPlacedList();
  render2D();
  render3D();
}

function renderPlacedList() {
  ui.placedList.innerHTML = "";
  state.furniture.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.name} @ (${item.x.toFixed(2)}, ${item.y.toFixed(2)})m</span>`;

    const actions = document.createElement("div");
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.onclick = () => {
      state.selectedObjectId = item.id;
      render2D();
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = () => {
      state.furniture = state.furniture.filter((f) => f.id !== item.id);
      if (state.selectedObjectId === item.id) state.selectedObjectId = null;
      renderPlacedList();
      render2D();
      render3D();
    };

    actions.append(selectBtn, delBtn);
    li.append(actions);
    ui.placedList.append(li);
  });
}

function setup3D() {
  const container = document.getElementById("threeContainer");
  three.scene = new THREE.Scene();
  three.scene.background = new THREE.Color(0x0f1219);

  three.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000);
  three.camera.position.set(10, 10, 10);

  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(three.renderer.domElement);

  three.controls = new OrbitControls(three.camera, three.renderer.domElement);
  three.controls.target.set(state.house.width / 2, 0, state.house.length / 2);
  three.controls.update();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445577, 1.2);
  three.scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(8, 16, 8);
  three.scene.add(dir);

  const grid = new THREE.GridHelper(80, 80, 0x415071, 0x2a3144);
  three.scene.add(grid);

  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h);
  });

  const tick = () => {
    requestAnimationFrame(tick);
    three.renderer.render(three.scene, three.camera);
  };
  tick();
}

function render3D() {
  if (three.roomGroup) three.scene.remove(three.roomGroup);
  if (three.furnGroup) three.scene.remove(three.furnGroup);

  three.roomGroup = new THREE.Group();
  const floorGeo = new THREE.BoxGeometry(state.house.width, 0.05, state.house.length);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c3243 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(state.house.width / 2, -0.025, state.house.length / 2);
  three.roomGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd2d8e4 });
  const addWallMesh = (cx, cz, len, rot) => {
    const geo = new THREE.BoxGeometry(len, state.house.wallHeight, state.house.wallThickness);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(cx, state.house.wallHeight / 2, cz);
    mesh.rotation.y = rot;
    three.roomGroup.add(mesh);
  };

  addWallMesh(state.house.width / 2, 0, state.house.width, 0);
  addWallMesh(state.house.width / 2, state.house.length, state.house.width, 0);
  addWallMesh(0, state.house.length / 2, state.house.length, Math.PI / 2);
  addWallMesh(state.house.width, state.house.length / 2, state.house.length, Math.PI / 2);

  state.walls.forEach((w) => {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    const rot = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
    const cx = (w.x1 + w.x2) / 2;
    const cz = (w.y1 + w.y2) / 2;
    const geo = new THREE.BoxGeometry(len, state.house.wallHeight, state.house.wallThickness);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb9c3d7 }));
    mesh.position.set(cx, state.house.wallHeight / 2, cz);
    mesh.rotation.y = -rot;
    three.roomGroup.add(mesh);
  });

  three.furnGroup = new THREE.Group();
  state.furniture.forEach((item) => {
    const geo = new THREE.BoxGeometry(item.width, item.height, item.depth);
    const mat = new THREE.MeshStandardMaterial({ color: item.wallMounted ? 0xf5be5b : 0x6f8fff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(item.x, item.z, item.y);
    mesh.rotation.y = (item.rotation * Math.PI) / 180;
    three.furnGroup.add(mesh);
  });

  three.scene.add(three.roomGroup);
  three.scene.add(three.furnGroup);
}

function pointToMeters(ev) {
  const rect = ui.planCanvas.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const py = ev.clientY - rect.top;
  const margin = 50;
  const scale = mToPx(1);
  return { x: (px - margin) / scale, y: (py - margin) / scale };
}

function findFurnitureAt(x, y) {
  return state.furniture.find((item) => {
    const halfW = item.width / 2;
    const halfD = item.depth / 2;
    return x >= item.x - halfW && x <= item.x + halfW && y >= item.y - halfD && y <= item.y + halfD;
  });
}

function bindEvents() {
  ui.applyDimensions.onclick = () => {
    state.house.width = Math.max(1, Number(ui.houseWidth.value));
    state.house.length = Math.max(1, Number(ui.houseLength.value));
    state.house.wallHeight = Math.max(2, Number(ui.wallHeight.value));
    state.house.wallThickness = Math.max(0.05, Number(ui.wallThickness.value));
    updateAreaSummary();
    render2D();
    render3D();
  };

  ui.resetLayout.onclick = () => {
    state.walls = [];
    state.furniture = [];
    state.selectedObjectId = null;
    renderPlacedList();
    render2D();
    render3D();
  };

  ui.addWall.onclick = () => {
    state.walls.push({
      x1: Number(ui.wallX1.value),
      y1: Number(ui.wallY1.value),
      x2: Number(ui.wallX2.value),
      y2: Number(ui.wallY2.value),
    });
    render2D();
    render3D();
  };

  ui.categoryFilter.onchange = updateFurnitureSelect;
  ui.addFurniture.onclick = placeFurniture;

  ui.addCustomFurniture.onclick = () => {
    const custom = {
      name: ui.customName.value.trim(),
      category: ui.customCategory.value.trim() || "Custom",
      width: Number(ui.customWidth.value),
      depth: Number(ui.customDepth.value),
      height: Number(ui.customHeight.value),
      wallMounted: ui.customWallMounted.checked,
    };
    if (!custom.name || [custom.width, custom.depth, custom.height].some((n) => !Number.isFinite(n) || n <= 0)) return;
    state.furnitureCatalog.push(custom);
    refreshCatalogControls();
  };

  ui.blueprintUpload.onchange = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      state.blueprint = img;
      render2D();
    };
    img.src = URL.createObjectURL(file);
  };

  ui.blueprintOpacity.oninput = () => {
    state.blueprintOpacity = Number(ui.blueprintOpacity.value);
    render2D();
  };

  ui.tabs.forEach((tab) => {
    tab.onclick = () => {
      ui.tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const viewId = tab.dataset.view;
      ui.views.forEach((v) => v.classList.toggle("active", v.id === viewId));
    };
  });

  ui.planCanvas.onmousedown = (ev) => {
    const p = pointToMeters(ev);
    const hit = findFurnitureAt(p.x, p.y);
    if (!hit) {
      state.selectedObjectId = null;
      render2D();
      return;
    }
    state.selectedObjectId = hit.id;
    dragOffset = { dx: p.x - hit.x, dy: p.y - hit.y };
    render2D();
  };

  ui.planCanvas.onmousemove = (ev) => {
    if (!state.selectedObjectId || !dragOffset) return;
    const target = state.furniture.find((f) => f.id === state.selectedObjectId);
    if (!target) return;
    const p = pointToMeters(ev);
    target.x = Math.max(0, Math.min(state.house.width, p.x - dragOffset.dx));
    target.y = Math.max(0, Math.min(state.house.length, p.y - dragOffset.dy));
    render2D();
    render3D();
    renderPlacedList();
  };

  window.onmouseup = () => {
    dragOffset = null;
  };
}

function init() {
  refreshCatalogControls();
  updateAreaSummary();
  bindEvents();
  setup3D();
  render2D();
  render3D();
}

init();
