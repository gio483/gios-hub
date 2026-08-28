/**
 * Keylight - the renderer.
 *
 * Two tiers, and the split is pedagogical as much as it is technical:
 *
 *   preview  - ambient only, half resolution, one pass, runs continuously.
 *              Flash is invisible here because flash is invisible through a
 *              viewfinder in real life.
 *   capture  - full resolution, progressive accumulation, flash computed.
 *              The frame only exists after the shutter.
 */

import * as THREE from '../../vendor/three.module.min.js';
import {
  commonVertexShader, roomFragmentShader, resolveFragmentShader, fullscreenVertexShader,
  maskFragmentShader, analysisFragmentShader, ANALYSIS_LOW, ANALYSIS_HIGH, KIND,
  MAX_WINDOWS, MAX_FIXTURES, MAX_FLASH, MAX_OCCLUDERS
} from './shaders.js';
import { buildGearGeometry, buildPhotographerGeometry } from './gear.js';
import { hexToLinear, whiteBalanceGains, autoWhiteBalance, kelvinToRGB } from '../physics/color.js';
import { CLIP_LINEAR, NOISE_FLOOR_LINEAR, KNEE_LINEAR, noiseAmplitude, diffractionBlurRenderPixels } from '../physics/sensor.js';
import { syncBandCoverage } from '../physics/flash.js';
import { interreflectedIlluminance, windowFlux, flashFlux } from '../physics/ambient.js';
import { resolveLight } from '../physics/lightmodel.js';
import { SENSOR_FULL_FRAME, SENSOR_APSC } from '../physics/constants.js';
import { lensById } from '../physics/gear.js';

const MAX_MATERIALS = 24;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1.5, 0.05, 90);

    this.accumTarget = null;
    this.mirrorTarget = null;
    this.size = { w: 2, h: 2 };

    this.uniforms = this._makeUniforms();
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: commonVertexShader,
      fragmentShader: roomFragmentShader,
      uniforms: this.uniforms,
      side: THREE.DoubleSide
    });

    this.resolveUniforms = {
      uScene: { value: null }, uSamples: { value: 1 },
      uKnee: { value: KNEE_LINEAR }, uClip: { value: CLIP_LINEAR },
      uFloor: { value: NOISE_FLOOR_LINEAR }, uZebras: { value: 0 },
      uResolution: { value: new THREE.Vector2(2, 2) }, uVignette: { value: 0 },
      uTime: { value: 0 }
    };
    this.resolveMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVertexShader,
      fragmentShader: resolveFragmentShader,
      uniforms: this.resolveUniforms,
      depthTest: false, depthWrite: false
    });
    this.analysisUniforms = {
      uScene: { value: null }, uSamples: { value: 1 }, uVignette: { value: 0 }
    };
    this.analysisMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVertexShader,
      fragmentShader: analysisFragmentShader,
      uniforms: this.analysisUniforms,
      depthTest: false, depthWrite: false
    });

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.resolveMaterial);
    this.quadScene.add(this.quad);

    this.depthMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: commonVertexShader,
      fragmentShader: 'out vec4 fragColor;\nvoid main(){ fragColor = vec4(0.0); }',
      uniforms: {},
      side: THREE.DoubleSide,
      colorWrite: false
    });

    this.maskUniforms = { uKind: { value: new Float32Array(MAX_MATERIALS) } };
    this.maskMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: commonVertexShader,
      fragmentShader: maskFragmentShader,
      uniforms: this.maskUniforms,
      side: THREE.DoubleSide
    });

    this.roomMesh = null;
    this.gearMesh = null;
    this.compiled = null;
    this.orbit = null;
  }

  _makeUniforms() {
    const arr = (n, f) => Array.from({ length: n }, f);
    return {
      uAperture: { value: 8 }, uISO: { value: 100 }, uShutter: { value: 1 / 128 },
      uWB: { value: v3(1, 1, 1) }, uFlashOn: { value: 0 }, uFrame: { value: 0 },
      uSoftSamples: { value: 1 },
      uAlbedo: { value: arr(MAX_MATERIALS, () => v3(0.5, 0.5, 0.5)) },
      uRoughness: { value: new Float32Array(MAX_MATERIALS).fill(0.9) },
      uSpecular: { value: new Float32Array(MAX_MATERIALS) },
      uEmissive: { value: arr(MAX_MATERIALS, () => v3()) },
      uMirror: { value: new Float32Array(MAX_MATERIALS) },
      uView: { value: new Float32Array(MAX_MATERIALS) },
      uTexKind: { value: new Float32Array(MAX_MATERIALS) },
      uTexScale: { value: new Float32Array(MAX_MATERIALS).fill(1) },
      uTexDir: { value: new Float32Array(MAX_MATERIALS) },
      uWindowCount: { value: 0 },
      uWinCenter: { value: arr(MAX_WINDOWS, () => v3()) },
      uWinRight: { value: arr(MAX_WINDOWS, () => v3()) },
      uWinUp: { value: arr(MAX_WINDOWS, () => v3()) },
      uWinRadiance: { value: arr(MAX_WINDOWS, () => v3()) },
      uFixtureCount: { value: 0 },
      uFixPos: { value: arr(MAX_FIXTURES, () => v3()) },
      uFixIntensity: { value: arr(MAX_FIXTURES, () => v3()) },
      uFillIrradiance: { value: v3() },
      uFlashFill: { value: v3() },
      uFillDir: { value: v3(0, 0.3, 0) },
      uRoomSize: { value: v3(3, 2.7, 4) },
      uFlashCount: { value: 0 },
      uFlashPos: { value: arr(MAX_FLASH, () => v3()) },
      uFlashDir: { value: arr(MAX_FLASH, () => v3(0, 0, 1)) },
      uFlashCoeff: { value: arr(MAX_FLASH, () => v3()) },
      uFlashRadius: { value: new Float32Array(MAX_FLASH) },
      uFlashConeCos: { value: new Float32Array(MAX_FLASH).fill(0.5) },
      uFlashHemi: { value: new Float32Array(MAX_FLASH) },
      uOccluderCount: { value: 0 },
      uOccCenter: { value: arr(MAX_OCCLUDERS, () => v3()) },
      uOccHalf: { value: arr(MAX_OCCLUDERS, () => v3(0.001, 0.001, 0.001)) },
      uOccRot: { value: arr(MAX_OCCLUDERS, () => new THREE.Vector2(1, 0)) },
      uSyncBandTop: { value: 0 }, uNoiseAmount: { value: 0 },
      uClipLinear: { value: CLIP_LINEAR }, uNoiseFloorLinear: { value: NOISE_FLOOR_LINEAR },
      uKneeLinear: { value: KNEE_LINEAR }, uZebras: { value: 0 },
      uResolution: { value: new THREE.Vector2(2, 2) },
      uMirrorTex: { value: null }, uMirrorEnabled: { value: 0 },
      uMirrorMatrix: { value: new THREE.Matrix4() }
    };
  }

  /* ---------------------------------------------------------------- */

  loadScene(compiled) {
    this.compiled = compiled;
    if (this.roomMesh) {
      this.roomMesh.geometry.dispose();
      this.scene.remove(this.roomMesh);
    }
    const g = new THREE.BufferGeometry();
    const a = compiled.attrs;
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    g.setAttribute('aMatId', new THREE.BufferAttribute(a.aMatId, 1));
    g.computeBoundingSphere();
    this.roomMesh = new THREE.Mesh(g, this.material);
    this.roomMesh.frustumCulled = false;
    this.scene.add(this.roomMesh);

    const u = this.uniforms;
    compiled.materials.slice(0, MAX_MATERIALS).forEach((m, i) => {
      const alb = hexToLinear(m.albedo);
      u.uAlbedo.value[i].set(alb[0], alb[1], alb[2]);
      u.uRoughness.value[i] = m.roughness ?? 0.9;
      u.uSpecular.value[i] = m.spec ?? 0.02;
      const e = m.emissive || [0, 0, 0];
      u.uEmissive.value[i].set(e[0], e[1], e[2]);
      u.uMirror.value[i] = m.mirror || 0;
      u.uView.value[i] = m.view || 0;
      u.uTexKind.value[i] = m.tex || 0;
      u.uTexScale.value[i] = m.texScale || 1;
      u.uTexDir.value[i] = m.texDir || 0;
    });

    const room = compiled.scene.room;
    u.uRoomSize.value.set(room.width / 2, room.ceiling, room.depth / 2);

    // Dominant daylight direction: luminance-weighted average of where the
    // windows sit, seen from the middle of the room. The fill term leans
    // this way, which is what keeps a one-window room from looking like it
    // was lit by the ceiling.
    const dir = new THREE.Vector3(0, 0.25, 0);
    for (const w of compiled.windows) {
      const wgt = w.area * Math.pow(2, w.ev - 12);
      dir.x += w.centre[0] * wgt * 0.01;
      dir.y += (w.centre[1] - room.ceiling * 0.45) * wgt * 0.01;
      dir.z += w.centre[2] * wgt * 0.01;
    }
    if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 1, 0);
    u.uFillDir.value.copy(dir);

    u.uWindowCount.value = Math.min(compiled.windows.length, MAX_WINDOWS);
    compiled.windows.slice(0, MAX_WINDOWS).forEach((w, i) => {
      u.uWinCenter.value[i].fromArray(w.centre);
      u.uWinRight.value[i].fromArray(w.right);
      u.uWinUp.value[i].fromArray(w.up);
      u.uWinRadiance.value[i].fromArray(w.radiance);
    });

    u.uFixtureCount.value = Math.min(compiled.fixtures.length, MAX_FIXTURES);
    compiled.fixtures.slice(0, MAX_FIXTURES).forEach((f, i) => {
      u.uFixPos.value[i].fromArray(f.pos);
      u.uFixIntensity.value[i].fromArray(f.intensity);
    });

    this.staticOccluderCount = Math.min(compiled.occluders.length, MAX_OCCLUDERS);
    compiled.occluders.slice(0, MAX_OCCLUDERS).forEach((o, i) => {
      u.uOccCenter.value[i].fromArray(o.centre);
      u.uOccHalf.value[i].fromArray(o.half);
      u.uOccRot.value[i].set(Math.cos(o.yaw), Math.sin(o.yaw));
    });
    u.uOccluderCount.value = this.staticOccluderCount;

    compiled.kinds.slice(0, MAX_MATERIALS).forEach((k, i) => { this.maskUniforms.uKind.value[i] = k; });
    this.hasMirror = compiled.materials.some((m) => (m.mirror || 0) > 0.5);
    this.gearSig = null;
  }

  /**
   * Rebuild the stands, tripod and photographer when anything about their
   * position changed. Derived from the state itself rather than from callers
   * remembering to set a flag, because a stale stand means the frame is
   * scored against hardware that is not where the plan says it is.
   */
  gearSignature(state) {
    let sig = `${state.camX},${state.camZ},${state.camHeight},${state.camYaw}`;
    for (const l of state.lights) {
      sig += `|${l.enabled ? 1 : 0},${l.x},${l.z},${l.height},${l.yaw}`;
    }
    return sig;
  }

  ensureGear(state) {
    const sig = this.gearSignature(state);
    if (sig !== this.gearSig) {
      this.rebuildGear(state);
      this.gearSig = sig;
    }
  }

  rebuildGear(state) {
    const id = this.compiled.gearMatId;
    const mb = buildGearGeometry(state, id);
    const ph = buildPhotographerGeometry(state, id);
    for (const k of ['pos', 'nrm', 'uv', 'mat']) mb[k].push(...ph[k]);
    const a = mb.toAttributes();
    if (this.gearMesh) {
      this.gearMesh.geometry.dispose();
      this.scene.remove(this.gearMesh);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    g.setAttribute('aMatId', new THREE.BufferAttribute(a.aMatId, 1));
    this.gearMesh = new THREE.Mesh(g, this.material);
    this.gearMesh.frustumCulled = false;
    this.scene.add(this.gearMesh);
  }

  setMeshMaterial(mat) {
    if (this.roomMesh) this.roomMesh.material = mat;
    if (this.gearMesh) this.gearMesh.material = mat;
  }

  /**
   * Per-pixel region mask: material id in red, kind in green. The scorer reads
   * the real frame rather than re-deriving what should have happened.
   */
  renderMask(state, aspect, mirrored = false) {
    const r = this.renderer;
    this.ensureGear(state);
    if (!this.maskTarget || this.maskTarget.width !== this.size.w) {
      this.maskTarget?.dispose();
      this.maskTarget = new THREE.WebGLRenderTarget(this.size.w, this.size.h, {
        type: THREE.UnsignedByteType, magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false
      });
    }
    this.applyCamera(state, aspect);
    if (mirrored) this.reflectCamera();
    this.setMeshMaterial(this.maskMaterial);
    r.setRenderTarget(this.maskTarget);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);
    const buf = new Uint8Array(this.size.w * this.size.h * 4);
    r.readRenderTargetPixels(this.maskTarget, 0, 0, this.size.w, this.size.h, buf);
    r.setRenderTarget(null);
    this.setMeshMaterial(this.material);
    return { width: this.size.w, height: this.size.h, pixels: buf };
  }

  /* ---------------------------------------------------------------- */

  /** w and h are final drawing-buffer pixels. CSS size is the caller's job. */
  setSize(w, h) {
    const pw = Math.max(2, Math.round(w));
    const ph = Math.max(2, Math.round(h));
    if (this.size.w === pw && this.size.h === ph) return;
    this.size = { w: pw, h: ph };
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(pw, ph, false);
    if (this.accumTarget) this.accumTarget.dispose();
    this.accumTarget = new THREE.WebGLRenderTarget(pw, ph, {
      type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
      depthBuffer: true, generateMipmaps: false
    });
    if (this.mirrorTarget) this.mirrorTarget.dispose();
    this.mirrorTarget = new THREE.WebGLRenderTarget(Math.round(pw / 2), Math.round(ph / 2), {
      type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
      depthBuffer: true, generateMipmaps: false
    });
    this.uniforms.uResolution.value.set(pw, ph);
    this.resolveUniforms.uResolution.value.set(pw, ph);
  }

  /* ---------------------------------------------------------------- */

  /** Point the camera using floor-plan state plus tilt and lens shift. */
  applyCamera(state, aspect) {
    const lens = lensById(state.lensId) || lensById('wide_zoom');
    const sensor = lens.sensor === 'apsc' ? SENSOR_APSC : SENSOR_FULL_FRAME;
    const f = state.focal;
    const yaw = (state.camYaw * Math.PI) / 180;
    const pitch = (state.tilt * Math.PI) / 180;

    this.camera.position.set(state.camX, state.camHeight, state.camZ);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    // The sim's yaw convention is +Z forward (matching the floor plan);
    // Three cameras look down -Z, hence the half turn.
    this.camera.rotation.y = yaw + Math.PI;
    this.camera.rotation.x = pitch;

    // Off-axis frustum so lens shift keeps the sensor parallel to the wall.
    const near = 0.05, far = 90;
    const tanY = sensor.h / 2 / f;
    const tanX = (sensor.h / 2 / f) * aspect;
    const sy = (state.shiftY || 0) / f;
    const sx = (state.shiftX || 0) / f;
    const top = near * (tanY + sy), bottom = near * (-tanY + sy);
    const right = near * (tanX + sx), left = near * (-tanX + sx);
    this.camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.camera.updateMatrixWorld(true);
    this.camera.aspect = aspect;
  }

  /** Push everything the shader needs for one exposure. */
  applyState(state, { withFlash }) {
    const u = this.uniforms;
    const c = this.compiled;
    u.uAperture.value = state.aperture;
    u.uISO.value = state.iso;
    u.uShutter.value = state.shutter;
    u.uFlashOn.value = withFlash ? 1 : 0;

    const resolved = withFlash ? this.resolveLights(state) : [];
    this.lastResolved = resolved;

    // White balance, including the auto mode's grey-world estimate.
    let wbK = state.whiteBalance;
    if (state.whiteBalanceAuto) {
      const contribs = [
        ...c.windows.map((w) => ({ kelvin: w.kelvin, weight: w.area * Math.pow(2, w.ev - 12) })),
        ...c.fixtures.map((f) => ({ kelvin: f.kelvin, weight: f.lumens / 900 })),
        ...resolved.map((r) => ({ kelvin: r.kelvin, weight: r.fluxLumenSeconds / 3000 }))
      ];
      wbK = autoWhiteBalance(contribs);
      this.autoWB = wbK;
    }
    const gains = whiteBalanceGains(wbK);
    u.uWB.value.set(gains[0], gains[1], gains[2]);

    // Interreflected fill. Ambient part is in lux, flash part in lux-seconds.
    let ambientFlux = 0;
    for (const w of c.windows) ambientFlux += windowFlux(w.area, w.ev);
    for (const f of c.fixtures) ambientFlux += f.lumens;
    const fillLux = interreflectedIlluminance(ambientFlux, c.surfaceArea, c.avgReflectance);
    u.uFillIrradiance.value.set(
      fillLux * c.fillTint[0], fillLux * c.fillTint[1], fillLux * c.fillTint[2]
    );

    const flashFluxLs = [0, 0, 0];
    for (const r of resolved) {
      const phi = flashFlux(r.throwCoeff, r.hemisphere ? 88 : r.coneHalfAngle);
      for (let i = 0; i < 3; i++) flashFluxLs[i] += phi * r.colorRGB[i];
    }
    const flashFill = flashFluxLs.map((phi) =>
      interreflectedIlluminance(phi, c.surfaceArea, c.avgReflectance)
    );
    u.uFlashFill.value.set(
      withFlash ? flashFill[0] * c.fillTint[0] : 0,
      withFlash ? flashFill[1] * c.fillTint[1] : 0,
      withFlash ? flashFill[2] * c.fillTint[2] : 0
    );

    // Flash heads.
    u.uFlashCount.value = Math.min(resolved.length, MAX_FLASH);
    resolved.slice(0, MAX_FLASH).forEach((r, i) => {
      u.uFlashPos.value[i].fromArray(r.origin);
      u.uFlashDir.value[i].fromArray(r.direction);
      u.uFlashCoeff.value[i].set(
        r.throwCoeff * r.colorRGB[0], r.throwCoeff * r.colorRGB[1], r.throwCoeff * r.colorRGB[2]
      );
      u.uFlashRadius.value[i] = r.sourceDiameter / 2;
      u.uFlashConeCos.value[i] = Math.cos((r.coneHalfAngle * Math.PI) / 180);
      u.uFlashHemi.value[i] = r.hemisphere ? 1 : 0;
    });

    // Light stands become occluders too, because they really do cast shadows.
    let occ = this.staticOccluderCount;
    if (withFlash) {
      for (const l of state.lights) {
        if (!l.enabled || occ >= MAX_OCCLUDERS) continue;
        u.uOccCenter.value[occ].set(l.x, l.height / 2, l.z);
        u.uOccHalf.value[occ].set(0.035, l.height / 2, 0.035);
        u.uOccRot.value[occ].set(1, 0);
        occ++;
      }
    }
    u.uOccluderCount.value = occ;

    u.uSyncBandTop.value = withFlash && resolved.length
      ? syncBandCoverage(state.shutter, state.hss) : 0;
    u.uNoiseAmount.value = noiseAmplitude(state.iso, 0.18);
    u.uZebras.value = state.zebras ? 1 : 0;

    this.resolveUniforms.uZebras.value = state.zebras ? 1 : 0;
    this.resolveUniforms.uVignette.value = state.vignette ?? 0.12;
  }

  resolveLights(state) {
    const c = this.compiled;
    const room = {
      width: c.scene.room.width, depth: c.scene.room.depth, ceiling: c.scene.room.ceiling,
      surfaces: {
        ceiling: {
          albedo: lumOfHex(c.scene.materials[c.scene.ceilingMaterial || 'ceiling'].albedo),
          color: c.scene.materials[c.scene.ceilingMaterial || 'ceiling'].albedo
        },
        wall: {
          albedo: lumOfHex(c.scene.materials.wall.albedo),
          color: c.scene.materials.wall.albedo
        }
      }
    };
    return state.lights
      .filter((l) => l.enabled)
      .map((l) => resolveLight(l, room, { shutter: state.shutter, hss: state.hss }))
      .filter(Boolean);
  }

  /**
   * Mirror the current camera through the scene's mirror plane, in place.
   *
   * The reflected camera ends up behind the wall the mirror is hung on, so a
   * normal frustum renders the back of that wall and nothing else. The near
   * plane has to be skewed onto the mirror plane itself (Lengyel's oblique
   * projection) so everything between the camera and the mirror is clipped
   * away. Without it the mirror is simply black.
   */
  reflectCamera() {
    const m = this.compiled.scene.mirrorPlane;
    if (!m) return false;
    const n = new THREE.Vector3().fromArray(m.normal).normalize();
    const p0 = new THREE.Vector3().fromArray(m.point);
    const q = this.camera.quaternion.clone();
    const d = this.camera.position.clone().sub(p0).dot(n);
    this.camera.position.sub(n.clone().multiplyScalar(2 * d));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const rf = fwd.clone().sub(n.clone().multiplyScalar(2 * fwd.dot(n)));
    this.camera.lookAt(this.camera.position.clone().add(rf));
    this.camera.updateMatrixWorld(true);

    // Push the clip plane a centimetre into the room. Sitting exactly on the
    // mirror surface leaves the mirror's own back face inside the frustum,
    // where it renders as a large black rectangle right across the middle of
    // the reflection.
    const clipPoint = p0.clone().add(n.clone().multiplyScalar(0.012));
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, clipPoint);
    plane.applyMatrix4(this.camera.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = this.camera.projectionMatrix;
    const e = P.elements;
    const qv = new THREE.Vector4(
      (Math.sign(clip.x) + e[8]) / e[0],
      (Math.sign(clip.y) + e[9]) / e[5],
      -1,
      (1 + e[10]) / e[14]
    );
    clip.multiplyScalar(2 / clip.dot(qv));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1;
    e[14] = clip.w;
    this.camera.projectionMatrixInverse.copy(P).invert();
    return true;
  }

  renderMirrorPass(state, aspect) {
    if (!this.compiled.scene.mirrorPlane) return;
    const r = this.renderer;
    const saveP = this.camera.position.clone();
    const saveQ = this.camera.quaternion.clone();
    const saveProj = this.camera.projectionMatrix.clone();
    this.reflectCamera();
    this.uniforms.uMirrorEnabled.value = 0;
    // Unbind the mirror texture before drawing into it. Leaving it attached
    // as a sampler while it is also the render target is a feedback loop:
    // WebGL raises INVALID_OPERATION and the whole draw comes back black.
    this.uniforms.uMirrorTex.value = null;
    this.material.blending = THREE.NoBlending;
    this.material.depthWrite = true;
    this.material.depthFunc = THREE.LessEqualDepth;
    r.setRenderTarget(this.mirrorTarget);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    // Remember how the reflected camera saw the world, so the composite can
    // look the reflection up by world position rather than by screen position.
    this.uniforms.uMirrorMatrix.value
      .copy(this.camera.projectionMatrix)
      .multiply(this.camera.matrixWorldInverse);
    this.camera.position.copy(saveP);
    this.camera.quaternion.copy(saveQ);
    this.camera.projectionMatrix.copy(saveProj);
    this.camera.projectionMatrixInverse.copy(saveProj).invert();
    this.camera.updateMatrixWorld(true);
  }

  renderPreview(state, aspect) {
    this.ensureGear(state);
    this.applyCamera(state, aspect);
    // Modeling mode simulates the flash continuously, like the modeling
    // lamp on a studio head. The capture math is identical, so what you
    // watch is what the frame will be - minus the accumulation quality.
    this.applyState(state, { withFlash: !!state.modeling });
    this.uniforms.uFrame.value = 0;
    const r = this.renderer;
    this.material.blending = THREE.NoBlending;
    this.material.depthWrite = true;
    this.material.depthFunc = THREE.LessEqualDepth;
    // Mirrors are live in the viewfinder too. You need to see what the mirror
    // is showing while you are deciding where to stand, which is the entire
    // problem in a bathroom.
    if (this.hasMirror) {
      this.renderMirrorPass(state, aspect);
      this.uniforms.uMirrorTex.value = this.mirrorTarget.texture;
      this.uniforms.uMirrorEnabled.value = 1;
      this.applyCamera(state, aspect);
    } else {
      this.uniforms.uMirrorEnabled.value = 0;
    }
    r.setRenderTarget(this.accumTarget);
    r.clear(true, true, true);
    this.material.blending = THREE.NoBlending;
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    this.resolveUniforms.uScene.value = this.accumTarget.texture;
    this.resolveUniforms.uSamples.value = 1;
    r.clear(true, true, true);
    r.render(this.quadScene, this.quadCamera);
  }

  /**
   * Fire the shutter. Progressive accumulation: each pass jitters the sample
   * point on every area source, so penumbra width comes out of real source
   * geometry instead of a softness slider.
   */
  async capture(state, aspect, passes, onProgress) {
    this.ensureGear(state);
    this.applyCamera(state, aspect);
    this.applyState(state, { withFlash: true });
    const r = this.renderer;

    if (this.hasMirror) {
      this.renderMirrorPass(state, aspect);
      this.uniforms.uMirrorTex.value = this.mirrorTarget.texture;
      this.uniforms.uMirrorEnabled.value = 1;
      this.applyCamera(state, aspect);
    } else {
      this.uniforms.uMirrorEnabled.value = 0;
    }

    r.setRenderTarget(this.accumTarget);
    r.clear(true, true, true);

    // Depth prepass. Additive accumulation and a plain depth test do not mix:
    // a far surface drawn first still passes the test and its light gets added
    // underneath the near one. Resolving depth up front and then drawing with
    // depthFunc EQUAL means each pixel accumulates exactly one surface, and it
    // gives early-Z something to reject against on the expensive passes.
    this.setMeshMaterial(this.depthMaterial);
    r.render(this.scene, this.camera);
    this.setMeshMaterial(this.material);

    this.material.blending = THREE.NoBlending;
    this.material.depthWrite = false;
    this.material.depthFunc = THREE.EqualDepth;
    this.material.blending = THREE.CustomBlending;
    this.material.blendEquation = THREE.AddEquation;
    this.material.blendSrc = THREE.OneFactor;
    this.material.blendDst = THREE.OneFactor;

    // Yield a fixed handful of times, not once per pass.
    //
    // A yield costs a whole frame of latency, so sixty-four of them cost more
    // than the render does. Six is enough to keep the progress bar honest and
    // the tab responsive, on a phone as much as on a desktop.
    const gl = r.getContext();
    const yieldEvery = Math.max(1, Math.ceil(passes / 6));
    const t0 = performance.now();
    let yielded = 0;

    // Subpixel jitter per pass. The accumulation that resolves soft shadows
    // resolves geometric edges for free at the same time - each pass shifts
    // the projection by a fraction of a pixel, and averaging the passes is
    // exactly what a wider pixel filter would have done. The depth prepass
    // must be re-run under the same jitter or EqualDepth rejects everything.
    const pe = this.camera.projectionMatrix.elements;
    const baseE8 = pe[8], baseE9 = pe[9];
    for (let i = 0; i < passes; i++) {
      this.uniforms.uFrame.value = i;
      pe[8] = baseE8 + (halton(i, 2) - 0.5) * 2 / this.size.w;
      pe[9] = baseE9 + (halton(i, 3) - 0.5) * 2 / this.size.h;
      if (passes > 1) {
        this.material.blending = THREE.NoBlending;
        this.setMeshMaterial(this.depthMaterial);
        r.clear(false, true, false);
        r.render(this.scene, this.camera);
        this.setMeshMaterial(this.material);
        this.material.blending = THREE.CustomBlending;
      }
      r.render(this.scene, this.camera);
      if ((i + 1) % yieldEvery === 0 || i === passes - 1) {
        onProgress?.((i + 1) / passes);
        const y0 = performance.now();
        await yieldFrame();
        yielded += performance.now() - y0;
      }
    }
    // One sync point so the measurement is of work done, not work queued.
    // Without it the driver reports microseconds and the next capture asks
    // for the maximum pass count on the strength of it.
    gl.finish();
    pe[8] = baseE8; pe[9] = baseE9;
    this.msPerPass = Math.max(0.02, (performance.now() - t0 - yielded) / passes);

    this.material.blending = THREE.NoBlending;
    this.material.depthWrite = true;
    this.material.depthFunc = THREE.LessEqualDepth;
    r.setRenderTarget(null);
    this.resolveUniforms.uScene.value = this.accumTarget.texture;
    this.resolveUniforms.uSamples.value = passes;
    r.clear(true, true, true);
    r.render(this.quadScene, this.quadCamera);
    return this.readback();
  }

  /**
   * Re-run the resolve pass. The mask passes overwrite the framebuffer, so
   * after scoring the photograph has to be put back on screen.
   */
  presentLast(passes) {
    const r = this.renderer;
    r.setRenderTarget(null);
    this.resolveUniforms.uScene.value = this.accumTarget.texture;
    this.resolveUniforms.uSamples.value = passes;
    r.clear(true, true, true);
    r.render(this.quadScene, this.quadCamera);
  }

  /** A detached copy of what is on screen, for hero targets and panoramas. */
  grabImage() {
    const c = document.createElement('canvas');
    c.width = this.size.w;
    c.height = this.size.h;
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    return c;
  }

  /** Scene-referred linear pixels, for the histogram and the scorer. */
  readback() {
    const { w, h } = this.size;
    const buf = new Uint8Array(w * h * 4);
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return { width: w, height: h, pixels: buf };
  }

  /**
   * Scene-referred linear pixels for the scorer.
   *
   * Goes through an 8-bit log-encoded pass rather than reading the half-float
   * accumulation buffer directly, because half-float readback is not portable
   * and fails silently on several mobile GPUs.
   */
  readbackLinear(passes) {
    const { w, h } = this.size;
    const r = this.renderer;
    if (!this.analysisTarget || this.analysisTarget.width !== w || this.analysisTarget.height !== h) {
      this.analysisTarget?.dispose();
      this.analysisTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.UnsignedByteType, magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false
      });
    }
    this.analysisUniforms.uScene.value = this.accumTarget.texture;
    this.analysisUniforms.uSamples.value = passes;
    this.analysisUniforms.uVignette.value = this.resolveUniforms.uVignette.value;
    this.quad.material = this.analysisMaterial;
    r.setRenderTarget(this.analysisTarget);
    r.clear(true, false, false);
    r.render(this.quadScene, this.quadCamera);
    r.setRenderTarget(null);
    this.quad.material = this.resolveMaterial;

    const codes = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(this.analysisTarget, 0, 0, w, h, codes);

    const span = ANALYSIS_HIGH - ANALYSIS_LOW;
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = 0.18 * Math.pow(2, ANALYSIS_LOW + (i / 255) * span);
    }
    const out = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      out[i * 4] = lut[codes[i * 4]];
      out[i * 4 + 1] = lut[codes[i * 4 + 1]];
      out[i * 4 + 2] = lut[codes[i * 4 + 2]];
      out[i * 4 + 3] = 1;
    }
    return { width: w, height: h, pixels: out };
  }

  dispose() {
    this.analysisTarget?.dispose();
    this.maskTarget?.dispose();
    this.accumTarget?.dispose();
    this.mirrorTarget?.dispose();
    this.roomMesh?.geometry.dispose();
    this.renderer.dispose();
  }
}

/**
 * Yield between accumulation passes so the progress state can paint.
 *
 * A visible tab wants requestAnimationFrame, because that is what actually
 * puts the progress bar on screen. A backgrounded or occluded tab throttles
 * both rAF and setTimeout to roughly once a second, which turns a quarter
 * second capture into half a minute. A MessageChannel post is not throttled,
 * so once we notice a yield taking absurdly long we switch to it and keep
 * going. The user gets paint when paint is possible and progress when it is
 * not.
 */
let throttled = false;

function yieldFrame() {
  if (throttled) return yieldMessage();
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (performance.now() - started > 120) throttled = true;
      resolve();
    };
    requestAnimationFrame(done);
    setTimeout(done, 40);
  });
}

function yieldMessage() {
  return new Promise((resolve) => {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => { mc.port1.close(); resolve(); };
    mc.port2.postMessage(0);
  });
}

/** Low-discrepancy sequence for the pass jitter. */
function halton(i, base) {
  let f = 1, r = 0, n = i + 1;
  while (n > 0) { f /= base; r += f * (n % base); n = Math.floor(n / base); }
  return r;
}

function lumOfHex(hex) {
  const c = hexToLinear(hex);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export { CLIP_LINEAR, NOISE_FLOOR_LINEAR, diffractionBlurRenderPixels, kelvinToRGB, KIND };
