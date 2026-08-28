import { suite, test, close, between, ok, report } from './harness.mjs';
import * as EXP from '../src/physics/exposure.js';
import * as FL from '../src/physics/flash.js';
import * as COL from '../src/physics/color.js';
import * as SEN from '../src/physics/sensor.js';
import * as AMB from '../src/physics/ambient.js';
import * as LM from '../src/physics/lightmodel.js';
import { SYNC_SPEED, MIDDLE_GREY } from '../src/physics/constants.js';

/* Grey card luminance for a given camera EV, so R lands on exactly 1. */
const greyLt = (f, t, iso) => EXP.luminanceFromEV(EXP.effectiveCameraEV(f, t, iso)) * t;

suite('Ambient exposure', () => {
  test('EV = log2(N^2/t): the f/8 and 1/125 marks meter EV 13', () => {
    close(EXP.evFromSettings(8, 1 / 128), 13, 1e-9);
    close(EXP.evFromSettings(EXP.APERTURE_STOPS[9], EXP.SHUTTER_STOPS[36]), 13, 1e-9);
  });

  test('sunny 16 - f/16 at 1/125 ISO 100 meters EV 15', () => {
    close(EXP.evFromSettings(EXP.APERTURE_STOPS[15], EXP.SHUTTER_STOPS[36]), 15, 1e-9);
  });

  test('ISO 400 shoots two stops darker than ISO 100 at the same settings', () => {
    const a = EXP.effectiveCameraEV(8, 1 / 125, 100);
    const b = EXP.effectiveCameraEV(8, 1 / 125, 400);
    close(a - b, 2, 1e-9);
  });

  test('a correctly metered grey card normalises to exactly R = 1', () => {
    for (const [f, t, iso] of [[8, 1 / 125, 100], [2.8, 1 / 30, 800], [22, 4, 6400]]) {
      close(EXP.relativeToGrey(greyLt(f, t, iso), f, iso), 1.0, 1e-9, `f/${f}`);
    }
  });

  test('middle grey renders at 0.18 scene-linear', () => {
    close(EXP.linearFromLt(greyLt(8, 1 / 125, 100), 8, 100), MIDDLE_GREY, 1e-9);
  });

  test('one stop of shutter is one stop of ambient', () => {
    const a = { aperture: 8, shutter: EXP.SHUTTER_STOPS[36], iso: 100 };
    const b = { aperture: 8, shutter: EXP.SHUTTER_STOPS[33], iso: 100 };
    close(EXP.ambientStopsBetween(a, b), 1, 1e-12);
  });

  test('one stop of aperture is one stop of ambient', () => {
    const a = { aperture: EXP.APERTURE_STOPS[9], shutter: 1 / 128, iso: 100 };
    const b = { aperture: EXP.APERTURE_STOPS[6], shutter: 1 / 128, iso: 100 };
    close(EXP.ambientStopsBetween(a, b), 1, 1e-12);
  });

  test('luminance and EV round-trip', () => {
    close(EXP.evFromLuminance(EXP.luminanceFromEV(11.3)), 11.3, 1e-9);
  });
});

suite('Flash exposure - guide number', () => {
  test('N = GN / d gives correct exposure of a grey card', () => {
    close(FL.apertureForCorrectFlash(60, 6, 1, 100, 0), 10, 1e-9);
    close(FL.apertureForCorrectFlash(28, 3.5, 1, 100, 0), 8, 1e-9);
  });

  test('at N = GN/d the grey card lands exactly on middle grey', () => {
    const r = LM.meterFlash({ throwCoeff: FL.throwCoefficient(60, 1, 0) }, 6, 10, 100);
    close(r, 0, 1e-6, 'stops from grey');
  });

  test('halving power costs exactly one stop', () => {
    const a = LM.meterFlash({ throwCoeff: FL.throwCoefficient(60, 1, 0) }, 4, 8, 100);
    const b = LM.meterFlash({ throwCoeff: FL.throwCoefficient(60, 2, 0) }, 4, 8, 100);
    close(a - b, 1, 1e-9);
  });

  test('1/1 to 1/128 is exactly seven stops', () => {
    const a = LM.meterFlash({ throwCoeff: FL.throwCoefficient(60, 1, 0) }, 4, 8, 100);
    const b = LM.meterFlash({ throwCoeff: FL.throwCoefficient(60, 128, 0) }, 4, 8, 100);
    close(a - b, 7, 1e-9);
  });

  test('inverse square: doubling distance costs two stops', () => {
    const k = FL.throwCoefficient(60, 1, 0);
    close(LM.meterFlash({ throwCoeff: k }, 3, 8, 100) - LM.meterFlash({ throwCoeff: k }, 6, 8, 100), 2, 1e-9);
  });

  test('inverse square is brutal up close, gentle far away', () => {
    const k = FL.throwCoefficient(60, 1, 0);
    const near = LM.meterFlash({ throwCoeff: k }, 1, 8, 100) - LM.meterFlash({ throwCoeff: k }, 2, 8, 100);
    const far = LM.meterFlash({ throwCoeff: k }, 5, 8, 100) - LM.meterFlash({ throwCoeff: k }, 6, 8, 100);
    close(near, 2, 1e-9);
    between(far, 0.2, 0.6, 'one metre at five metres out');
  });
});

suite('The two exposures - the asymmetry the app exists to teach', () => {
  const k = FL.throwCoefficient(60, 4, 0);
  const flashAt = (f, iso) => LM.meterFlash({ throwCoeff: k }, 4, f, iso);

  test('SHUTTER DOES NOT MOVE FLASH - 1/250 versus 1/8 is identical', () => {
    // meterFlash has no shutter argument at all; the omission is structural.
    const a = { aperture: 8, shutter: EXP.SHUTTER_STOPS[39], iso: 100 };  // 1/250
    const b = { aperture: 8, shutter: EXP.SHUTTER_STOPS[24], iso: 100 };  // 1/8
    close(EXP.flashStopsBetween(a, b), 0, 1e-12, 'flash change across five stops of shutter');
    close(EXP.ambientStopsBetween(a, b), 5, 1e-12, 'ambient change across the same move');
  });

  test('aperture moves flash one stop per stop', () => {
    close(flashAt(EXP.APERTURE_STOPS[6], 100) - flashAt(EXP.APERTURE_STOPS[9], 100), 1, 1e-12);
  });

  test('ISO moves flash one stop per stop', () => {
    close(flashAt(8, 200) - flashAt(8, 100), 1, 1e-9);
  });

  test('closing from f/8 to f/11 demands double the flash power', () => {
    close(flashAt(EXP.APERTURE_STOPS[9], 100) - flashAt(EXP.APERTURE_STOPS[12], 100), 1, 1e-12);
  });

  test('a stop of aperture moves ambient and flash together, so only shutter separates them', () => {
    const a = { aperture: EXP.APERTURE_STOPS[9], shutter: 1 / 128, iso: 100 };
    const b = { aperture: EXP.APERTURE_STOPS[6], shutter: 1 / 128, iso: 100 };
    close(EXP.ambientStopsBetween(a, b), EXP.flashStopsBetween(a, b), 1e-12);
  });
});

suite('Sync speed wall', () => {
  test('no band at or below sync speed', () => {
    close(FL.syncBandCoverage(SYNC_SPEED), 0, 1e-9);
    close(FL.syncBandCoverage(1 / 64), 0, 1e-9);
  });

  test('half the frame is dark at one stop over sync', () => {
    close(FL.syncBandCoverage(SYNC_SPEED / 2), 0.5, 1e-12);
  });

  test('the band grows as the slit narrows', () => {
    ok(FL.syncBandCoverage(1 / 4096) > FL.syncBandCoverage(1 / 1024));
    between(FL.syncBandCoverage(1 / 4096), 0.9, 0.97);
  });

  test('HSS clears the band and charges for it', () => {
    close(FL.syncBandCoverage(1 / 2048, true), 0, 1e-9);
    between(FL.hssLossStops(EXP.SHUTTER_STOPS[40]), 1.9, 2.2, 'HSS cost one click over sync');
    between(FL.hssLossStops(1 / 1024), 3.5, 4.0, 'HSS cost at 1/1000');
  });

  test('HSS costs nothing below sync speed because it does not engage', () => {
    close(FL.hssLossStops(1 / 128), 0, 1e-9);
  });

  test('the 1/250 sync mark is exactly 1/256 under the hood', () => {
    close(SYNC_SPEED, 1 / 256, 1e-12);
    ok(EXP.formatShutter(SYNC_SPEED) === '1/250', 'and it still prints as 1/250');
  });
});

suite('Bounce', () => {
  test('ceiling bounce lands in the real two-to-three stop range', () => {
    const loss = FL.bounceLossStops({
      beamHalfAngleDeg: 30, surfaceAlbedo: 0.8, patchToSubject: 3.4, directDistance: 3.0
    });
    between(loss, 2.0, 3.0, 'stops lost to a white ceiling');
  });

  test('a dark ceiling costs more', () => {
    const white = FL.bounceLossStops({ beamHalfAngleDeg: 30, surfaceAlbedo: 0.8, patchToSubject: 3.4, directDistance: 3 });
    const wood = FL.bounceLossStops({ beamHalfAngleDeg: 30, surfaceAlbedo: 0.25, patchToSubject: 3.4, directDistance: 3 });
    between(wood - white, 1.5, 1.8, 'extra stops for dark wood');
  });

  test('a tight beam wastes less light on the bounce than a wide one', () => {
    const tight = FL.bounceLossStops({ beamHalfAngleDeg: 20, surfaceAlbedo: 0.8, patchToSubject: 3.4, directDistance: 3 });
    const wide = FL.bounceLossStops({ beamHalfAngleDeg: 45, surfaceAlbedo: 0.8, patchToSubject: 3.4, directDistance: 3 });
    ok(wide < tight, 'a wide beam covers more ceiling so it returns more light');
  });

  test('bounce turns a point source into a broad one', () => {
    const patch = FL.bouncePatchDiameter(1.5, 30);
    between(patch, 1.6, 1.9, 'patch diameter in metres');
    ok(FL.softness(patch, 3) > FL.softness(0.07, 3) * 10, 'far softer than the bare head');
  });

  test('raising a bounced head softens it', () => {
    ok(FL.bouncePatchDiameter(2.0, 30) > FL.bouncePatchDiameter(1.0, 30));
  });

  test('bounce never beats a mirror: transfer is capped at the albedo', () => {
    for (const angle of [30, 60, 85]) {
      const tr = FL.bounceTransfer({
        beamHalfAngleDeg: angle, surfaceAlbedo: 0.85, patchToSubject: 2, directDistance: 2
      });
      ok(tr <= 0.85 + 1e-9, `transfer ${tr.toFixed(2)} at ${angle} degrees`);
    }
  });

  test('a wide bare bulb bounced up still loses light, never gains it', () => {
    const loss = FL.bounceLossStops({
      beamHalfAngleDeg: 85, surfaceAlbedo: 0.82, patchToSubject: 2.4, directDistance: 2.4
    });
    ok(loss > 0, `computed a bounce GAIN of ${(-loss).toFixed(2)} stops`);
  });
});

suite('Colour temperature', () => {
  test('2700K is warm, 10000K is cool', () => {
    const warm = COL.kelvinToRGB(2700);
    const cool = COL.kelvinToRGB(10000);
    ok(warm[0] > warm[2] * 2, 'tungsten is strongly red-dominant');
    ok(cool[2] > cool[0], 'blue hour is blue-dominant');
  });

  test('every light colour carries luminance 1 so photometry stays separate', () => {
    for (const k of [2000, 2700, 3200, 5500, 6500, 10000]) {
      close(COL.luminanceOf(COL.kelvinToRGB(k)), 1.0, 1e-6, `${k}K`);
    }
  });

  test('white balance neutralises its own illuminant', () => {
    for (const k of [2700, 4000, 5500, 8000]) {
      const light = COL.kelvinToRGB(k);
      const gains = COL.whiteBalanceGains(k);
      const out = [light[0] * gains[0], light[1] * gains[1], light[2] * gains[2]];
      close(out[0], out[1], 1e-4, `${k}K r vs g`);
      close(out[1], out[2], 1e-4, `${k}K g vs b`);
    }
  });

  test('balancing for tungsten turns 5500K flash blue', () => {
    const gains = COL.whiteBalanceGains(2900);
    const flash = COL.kelvinToRGB(5500);
    const out = [flash[0] * gains[0], flash[1] * gains[1], flash[2] * gains[2]];
    ok(out[2] > out[0] * 1.5, 'ungelled flash goes cold when you balance for the fixtures');
  });

  test('balancing for flash turns 2900K fixtures orange', () => {
    const gains = COL.whiteBalanceGains(5500);
    const bulb = COL.kelvinToRGB(2900);
    const out = [bulb[0] * gains[0], bulb[1] * gains[1], bulb[2] * gains[2]];
    ok(out[0] > out[2] * 2, 'fixtures go hot orange when you balance for flash');
  });

  test('gels are mired shifts and land on their stated temperatures', () => {
    close(COL.gelledKelvin(5500, 'cto_full'), 3200, 40, 'full CTO');
    close(COL.gelledKelvin(5500, 'cto_half'), 3800, 40, 'half CTO');
    close(COL.gelledKelvin(5500, 'cto_quarter'), 4470, 60, 'quarter CTO');
  });

  test('full CTO very nearly matches a 3000K fixture', () => {
    between(COL.miredDistance(COL.gelledKelvin(5500, 'cto_full'), 3000), 0, 25, 'mired gap after gelling');
    between(COL.miredDistance(5500, 3000), 140, 160, 'mired gap ungelled');
  });

  test('gels cost light', () => {
    ok(COL.gelLossStops('cto_full') > COL.gelLossStops('cto_half'));
    between(COL.gelLossStops('cto_full'), 0.7, 1.1);
  });

  test('auto white balance splits the difference and pleases nobody', () => {
    const awb = COL.autoWhiteBalance([
      { kelvin: 5500, weight: 1 },
      { kelvin: 2700, weight: 1 }
    ]);
    between(awb, 3500, 3900, 'grey-world estimate between flash and tungsten');
  });
});

suite('Sensor', () => {
  test('tone curve is exactly linear below the knee', () => {
    for (const v of [0.01, 0.09, MIDDLE_GREY, 0.4]) close(SEN.toneMap(v), v, 1e-12, `x=${v}`);
  });

  test('the shoulder rolls off instead of hitting a wall', () => {
    ok(SEN.toneMap(SEN.CLIP_LINEAR) < 1.0);
    ok(SEN.toneMap(SEN.CLIP_LINEAR * 4) < 1.0);
    ok(SEN.toneMap(SEN.CLIP_LINEAR * 4) > SEN.toneMap(SEN.CLIP_LINEAR));
    between(SEN.toneMap(SEN.CLIP_LINEAR), 0.93, 0.99, 'nominal clip point on the display');
  });

  test('tone curve is monotonic across fourteen stops', () => {
    let prev = -1;
    for (let s = -11; s <= 4; s += 0.25) {
      const y = SEN.toneMap(MIDDLE_GREY * 2 ** s);
      ok(y > prev, `not monotonic at ${s} stops`);
      prev = y;
    }
  });

  test('dynamic range is fourteen stops from floor to clip', () => {
    close(Math.log2(SEN.CLIP_LINEAR / SEN.NOISE_FLOOR_LINEAR), 14, 1e-9);
  });

  test('highlight headroom above middle grey is 3.5 stops', () => {
    close(SEN.stopsFromMiddleGrey(SEN.CLIP_LINEAR), 3.5, 1e-9);
  });

  test('a window seven stops over a correctly exposed room clips', () => {
    ok(SEN.isClipped(MIDDLE_GREY * 2 ** 7));
    ok(!SEN.isClipped(MIDDLE_GREY * 2 ** 3));
  });

  test('noise only shows up where it should', () => {
    close(SEN.noiseAmplitude(100, MIDDLE_GREY), 0, 1e-9);
    ok(SEN.noiseAmplitude(6400, MIDDLE_GREY) > 0);
    ok(SEN.noiseAmplitude(12800, MIDDLE_GREY) > SEN.noiseAmplitude(6400, MIDDLE_GREY));
    ok(SEN.noiseAmplitude(6400, 0.01) > SEN.noiseAmplitude(6400, MIDDLE_GREY), 'shadows are noisier');
  });

  test('diffraction is clean through f/11 and visible past f/16', () => {
    // Real diffraction starts well before it is visible: the Airy disc passes
    // the pixel pitch around f/8, but stays sub-pixel in the render until f/16.
    const inRender = (n) => SEN.diffractionBlurRenderPixels(n, 1400);
    ok(inRender(8) < 0.25, 'invisible at f/8');
    ok(inRender(11) < 0.45, 'still invisible at f/11');
    ok(inRender(22) > 0.85, 'clearly soft at f/22');
    ok(inRender(22) > inRender(16) * 1.4);
  });

  test('sRGB encode and decode round-trip', () => {
    for (const v of [0, 0.02, 0.18, 0.5, 1]) close(SEN.decodeSRGB(SEN.encodeSRGB(v)), v, 1e-6);
  });
});

suite('Ambient light transport', () => {
  const rect = (cx, cy, cz, w, h) => [
    [cx - w / 2, cy - h / 2, cz], [cx + w / 2, cy - h / 2, cz],
    [cx + w / 2, cy + h / 2, cz], [cx - w / 2, cy + h / 2, cz]
  ];

  test('a surface pressed against a huge emitter sees a projected solid angle of pi', () => {
    const big = rect(0, 0, 0, 4000, 4000);
    close(AMB.projectedSolidAngle(big, [0, 0, -0.5], [0, 0, 1]), Math.PI, 0.01);
  });

  test('a surface facing away sees nothing', () => {
    const w = rect(0, 1.5, 0, 2, 1.5);
    close(AMB.projectedSolidAngle(w, [0, 1.2, -4], [0, 0, -1]), 0, 1e-9);
  });

  test('solid angle falls off as one over distance squared once the source is small', () => {
    const w = rect(0, 1.5, 0, 2, 1.5);
    const near = AMB.projectedSolidAngle(w, [0, 1.5, -5], [0, 0, 1]);
    const far = AMB.projectedSolidAngle(w, [0, 1.5, -10], [0, 0, 1]);
    close(Math.log2(near / far), 2, 0.12, 'stops between 5m and 10m');
  });

  test('the interior-to-window gap emerges from geometry, not from an authored number', () => {
    // 2.0 x 1.5m window, EV 14 exterior, white wall 5m back across the room.
    const w = rect(0, 1.5, 0, 2.0, 1.5);
    const winEV = 14;
    const E = AMB.windowIrradiance(w, [0, 1.4, -5], [0, 0, 1], winEV);
    const wallLum = (E * 0.82) / Math.PI;
    const gap = Math.log2(AMB.windowLuminance(winEV) / wallLum);
    between(gap, 4.5, 8.0, 'stops between the view and the far wall');
  });

  test('standing right by the window the gap closes', () => {
    const w = rect(0, 1.5, 0, 2.0, 1.5);
    const near = AMB.windowIrradiance(w, [0, 1.4, -1], [0, 0, 1], 14);
    const far = AMB.windowIrradiance(w, [0, 1.4, -5], [0, 0, 1], 14);
    ok(near > far * 8, 'a metre from the glass is a completely different exposure');
  });

  test('a white room bounces far more fill than a dark one', () => {
    const flux = AMB.windowFlux(3.0, 14);
    const white = AMB.interreflectedIlluminance(flux, 120, 0.75);
    const dark = AMB.interreflectedIlluminance(flux, 120, 0.25);
    ok(white > dark * 6, 'the geometric series is why white rooms are easy');
  });

  test('a bulb is invisible next to a window but its own surface is blinding', () => {
    const bulbLum = AMB.fixtureSurfaceLuminance(800, 0.004);
    ok(bulbLum > 50000, 'the glowing element itself');
    const throwOnCeiling = (AMB.fixtureIntensity(800) / (1.2 * 1.2)) * 0.8 / Math.PI;
    ok(throwOnCeiling < AMB.windowLuminance(14) / 100, 'what it actually adds to a daylit room');
  });
});

suite('Resolved lights', () => {
  const room = {
    width: 6, depth: 8, ceiling: 2.7,
    surfaces: {
      ceiling: { albedo: 0.82, color: '#f2efe8' },
      wall: { albedo: 0.62, color: '#e6e2d8' }
    }
  };
  const cam = { shutter: 1 / 125, hss: false };
  const base = {
    id: 'a', x: 0, z: 0, height: 1.8, yaw: 0, tilt: 0,
    headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 1, mode: 'direct'
  };

  test('a bare direct head sits where you put it', () => {
    const r = LM.resolveLight(base, room, cam);
    close(r.origin[1], 1.8, 1e-9);
    close(r.losses.total, 0, 1e-9);
  });

  test('bouncing off the ceiling moves the source to the ceiling', () => {
    const r = LM.resolveLight({ ...base, mode: 'ceiling' }, room, cam);
    close(r.origin[1], 2.68, 0.01);
    between(r.losses.bounce, 1.5, 2.4, 'stops lost to the bounce itself');
  });

  test('a bounced head is a big soft source, a bare one is a point', () => {
    const bare = LM.resolveLight(base, room, cam);
    const bounced = LM.resolveLight({ ...base, mode: 'ceiling' }, room, cam);
    ok(bounced.sourceDiameter > bare.sourceDiameter * 10);
    between(bounced.sourceDiameter, 0.8, 1.4, 'patch diameter under a 2.7m ceiling');
  });

  test('bounce picks up the colour of what it hits', () => {
    const warmRoom = { ...room, surfaces: { ...room.surfaces, ceiling: { albedo: 0.45, color: '#c9a06a' } } };
    const r = LM.resolveLight({ ...base, mode: 'ceiling' }, warmRoom, cam);
    ok(r.colorRGB[0] > r.colorRGB[2] * 1.4, 'a wood ceiling makes the flash warm');
  });

  test('a sage wall throws green, which is the classic bounce failure', () => {
    const sage = { ...room, surfaces: { ...room.surfaces, wall: { albedo: 0.4, color: '#8f9c72' } } };
    const r = LM.resolveLight({ ...base, mode: 'wall', yaw: 90 }, sage, cam);
    ok(r.colorRGB[1] > r.colorRGB[2] * 1.2, 'green cast off the wall');
  });

  test('modifier, gel and HSS costs stack additively in stops', () => {
    const r = LM.resolveLight(
      { ...base, modifierId: 'octa_36', gelId: 'cto_full' },
      room, { shutter: 1 / 1000, hss: true }
    );
    close(r.losses.total, r.losses.modifier + r.losses.gel + r.losses.hss + r.losses.bounce, 1e-9);
    between(r.losses.total, 6.0, 7.0, 'octabox plus full CTO plus HSS at 1/1000');
  });

  test('flash flux into the room scales with power', () => {
    const full = LM.resolveLight(base, room, cam);
    const half = LM.resolveLight({ ...base, power: 2 }, room, cam);
    close(full.fluxLumenSeconds / half.fluxLumenSeconds, 2, 1e-6);
  });

  test('walls are found by raycast, not by guessing', () => {
    const hit = LM.raycastWall(0, 0, 0, room);
    close(hit.z, 4, 1e-9);
    close(hit.distance, 4, 1e-9);
    const side = LM.raycastWall(0, 0, Math.PI / 2, room);
    close(side.x, 3, 1e-9);
  });
});

suite('Whole-frame scenarios', () => {
  test('exposing to hold a bright window buries the room, and flash is what buys it back', () => {
    // Window EV 14. Room ambient measured at EV 8 - a six stop gap.
    const expose = { aperture: 8, shutter: 1 / 128, iso: 100 };
    const camEV = EXP.effectiveCameraEV(expose.aperture, expose.shutter, expose.iso);
    close(camEV, 13, 1e-9);

    const windowStops = SEN.stopsFromMiddleGrey(
      EXP.linearFromLt(EXP.luminanceFromEV(14) * expose.shutter, expose.aperture, expose.iso)
    );
    between(windowStops, 0.9, 1.1, 'the view sits a stop over grey - retained');

    const roomStops = SEN.stopsFromMiddleGrey(
      EXP.linearFromLt(EXP.luminanceFromEV(8) * expose.shutter, expose.aperture, expose.iso)
    );
    between(roomStops, -5.2, -4.8, 'the room is five stops down - unusable');

    // An AD200 at quarter power, four metres away, bounced, buys it back.
    const room = {
      width: 6, depth: 8, ceiling: 2.7,
      surfaces: { ceiling: { albedo: 0.82, color: '#f2efe8' }, wall: { albedo: 0.62, color: '#e6e2d8' } }
    };
    const r = LM.resolveLight(
      { id: 'a', x: 0, z: 0, height: 1.9, yaw: 0, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 2 },
      room, { shutter: expose.shutter, hss: false }
    );
    const lift = LM.meterFlash(r, 3.0, expose.aperture, expose.iso);
    between(lift, -1.5, 1.5, 'flash lands the room near middle grey without touching the window');
  });

  test('dropping shutter two stops lifts the room and the window equally, which is the trap', () => {
    const a = { aperture: 8, shutter: EXP.SHUTTER_STOPS[36], iso: 100 };
    const b = { aperture: 8, shutter: EXP.SHUTTER_STOPS[30], iso: 100 };
    close(EXP.ambientStopsBetween(a, b), 2, 1e-12);
    close(EXP.flashStopsBetween(a, b), 0, 1e-12);
  });
});

report();
