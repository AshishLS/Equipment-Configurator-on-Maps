import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import mapboxgl from 'mapbox-gl';
import { isPointInsidePolygon, snapToGrid } from './geo';

export class ThreeLayerEngine {
  constructor({ map, onObjectUpdate }) {
    this.map = map;
    this.onObjectUpdate = onObjectUpdate;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.renderer = null;
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);
    this.objectsGroup = new THREE.Group();
    this.rootGroup.add(this.objectsGroup);
    this.objectMeshes = new Map();
    this.objectMetaByMeshId = new Map();
    this.boundaryLocal = [];
    this.originLngLat = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.measurementLine = null;
    this.measurementDots = [];
    this.selectedMesh = null;
    this.mapMoveBound = () => {
      if (this.transformControls) this.transformControls.update();
    };
  }

  createCustomLayer(id = 'three-custom-layer') {
    this.layerId = id;
    return {
      id,
      type: 'custom',
      renderingMode: '3d',
      onAdd: (map, gl) => this.onAdd(map, gl),
      render: (gl, matrix) => this.render(gl, matrix)
    };
  }

  onAdd(map, gl) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(100, 180, 120);
    directional.castShadow = true;
    this.scene.add(directional);

    const grid = new THREE.GridHelper(200, 200, 0x64748b, 0x1e293b);
    grid.position.y = 0.01;
    this.rootGroup.add(grid);

    this.transformControls = new TransformControls(this.camera, this.map.getCanvas());
    this.transformControls.setMode('translate');
    this.transformControls.showY = false;
    this.transformControls.addEventListener('objectChange', () => this.handleTransformChange());
    this.transformControls.addEventListener('dragging-changed', (event) => {
      map.dragPan[event.value ? 'disable' : 'enable']();
    });
    this.scene.add(this.transformControls);

    map.getCanvas().addEventListener('click', this.handleCanvasClick);
    map.on('move', this.mapMoveBound);
  }

  handleCanvasClick = (event) => {
    const rect = this.map.getCanvas().getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(this.objectsGroup.children, false);
    if (intersects.length) {
      this.selectedMesh = intersects[0].object;
      this.transformControls.attach(this.selectedMesh);
    } else {
      this.selectedMesh = null;
      this.transformControls.detach();
    }
    this.map.triggerRepaint();
  };

  handleTransformChange() {
    if (!this.selectedMesh) return;
    const meta = this.objectMetaByMeshId.get(this.selectedMesh.id);
    if (!meta) return;

    const snapped = {
      x: snapToGrid(this.selectedMesh.position.x),
      z: snapToGrid(this.selectedMesh.position.z)
    };

    if (!isPointInsidePolygon(snapped, this.boundaryLocal)) {
      this.selectedMesh.position.x = meta.prevX;
      this.selectedMesh.position.z = meta.prevZ;
      return;
    }

    this.selectedMesh.position.x = snapped.x;
    this.selectedMesh.position.z = snapped.z;
    meta.prevX = snapped.x;
    meta.prevZ = snapped.z;

    const rotation = this.selectedMesh.rotation.y;
    this.onObjectUpdate(meta.objectId, { x: snapped.x, z: snapped.z, rotation });
  }

  rotateSelected(delta = Math.PI / 8) {
    if (!this.selectedMesh) return;
    const meta = this.objectMetaByMeshId.get(this.selectedMesh.id);
    if (!meta) return;
    this.selectedMesh.rotation.y += delta;
    this.onObjectUpdate(meta.objectId, { rotation: this.selectedMesh.rotation.y });
    this.map.triggerRepaint();
  }

  setOrigin(originLngLat) {
    this.originLngLat = originLngLat;
    if (!originLngLat) return;
    const merc = mapboxgl.MercatorCoordinate.fromLngLat(originLngLat, 0);
    const scale = merc.meterInMercatorCoordinateUnits();
    this.rootGroup.position.set(merc.x, merc.z, merc.y);
    this.rootGroup.scale.set(scale, scale, -scale);
  }

  setBoundary(points) {
    this.boundaryLocal = points ?? [];
    if (this.groundMesh) {
      this.rootGroup.remove(this.groundMesh);
      this.groundMesh.geometry.dispose();
      this.groundMesh.material.dispose();
    }
    if (!points?.length) return;

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);
    points.slice(1).forEach((point) => shape.lineTo(point.x, point.z));
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshStandardMaterial({
      color: '#1f2937',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    this.groundMesh = new THREE.Mesh(geometry, material);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.rootGroup.add(this.groundMesh);
  }

  upsertObjects(objects, library) {
    const activeIds = new Set(objects.map((obj) => obj.id));
    this.objectMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.objectsGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.objectMetaByMeshId.delete(mesh.id);
        this.objectMeshes.delete(id);
      }
    });

    objects.forEach((item) => {
      const existing = this.objectMeshes.get(item.id);
      const spec = library.find((lib) => lib.id === item.type);
      if (!spec) return;

      if (!existing) {
        const geometry = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
        const material = new THREE.MeshStandardMaterial({ color: spec.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.y = spec.height / 2;

        const edges = new THREE.EdgesGeometry(geometry);
        const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#e2e8f0' }));
        mesh.add(wireframe);

        this.objectsGroup.add(mesh);
        this.objectMeshes.set(item.id, mesh);
        this.objectMetaByMeshId.set(mesh.id, { objectId: item.id, prevX: item.x, prevZ: item.z });
      }

      const mesh = this.objectMeshes.get(item.id);
      mesh.position.x = item.x;
      mesh.position.z = item.z;
      mesh.rotation.y = item.rotation ?? 0;
      const meta = this.objectMetaByMeshId.get(mesh.id);
      if (meta) {
        meta.prevX = item.x;
        meta.prevZ = item.z;
      }
    });
  }

  setMeasurementLine(localPoints) {
    if (this.measurementLine) {
      this.rootGroup.remove(this.measurementLine);
      this.measurementLine.geometry.dispose();
      this.measurementLine.material.dispose();
      this.measurementLine = null;
    }
    this.measurementDots.forEach((dot) => {
      this.rootGroup.remove(dot);
      dot.geometry.dispose();
      dot.material.dispose();
    });
    this.measurementDots = [];

    if (!localPoints || localPoints.length < 2) return;
    const points = localPoints.map((point) => new THREE.Vector3(point.x, 0.1, point.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({ color: '#f8fafc', dashSize: 1, gapSize: 0.5 });
    this.measurementLine = new THREE.Line(geometry, material);
    this.measurementLine.computeLineDistances();
    this.rootGroup.add(this.measurementLine);

    points.forEach((p) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshStandardMaterial({ color: '#facc15' }));
      dot.position.copy(p);
      this.measurementDots.push(dot);
      this.rootGroup.add(dot);
    });
  }

  render(gl, matrix) {
    const m = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = m;
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
    gl.finish?.();
  }

  dispose() {
    this.map.getCanvas().removeEventListener('click', this.handleCanvasClick);
    this.map.off('move', this.mapMoveBound);
  }
}
