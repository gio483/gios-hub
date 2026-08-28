/**
 * Keylight - the Learning Center.
 *
 * Each module constrains the interface to the one variable it is teaching,
 * then checks the actual captured frame. Goals are written as tests against
 * measurements, never against a stored "correct" arrangement, so any setup
 * that genuinely produces the result passes.
 */

import { APERTURE_STOPS, SHUTTER_STOPS, ISO_STOPS, formatShutter } from '../physics/exposure.js';
import { syncBandCoverage } from '../physics/flash.js';
import { MIDDLE_GREY } from '../physics/constants.js';

const stopsOf = (y) => Math.log2(Math.max(1e-9, y) / MIDDLE_GREY);

/** Median exposure of ordinary surfaces, in stops from middle grey. */
export function roomStops(result) {
  const s = result?.regions;
  return result?.surfaceMedianStops ?? 0;
}

const goal = (id, text, test) => ({ id, text, test });

export const MODULES = [
  {
    n: 1,
    id: 'two-exposures',
    title: 'The two exposures',
    blurb: 'Shutter and ISO move the ambient. Aperture, power and distance move the flash. Every frame you will ever light is those two dials at once.',
    sceneId: 'living-room',
    intro: [
      'There are two completely separate exposures happening in the same frame.',
      'The window, the room and everything lit by daylight respond to shutter, aperture and ISO. The flash responds to aperture, power and distance, and does not care about shutter at all. It fires for about a thousandth of a second, so whether the shutter stays open for a two hundred and fiftieth or a whole second makes no difference to it.',
      'That single asymmetry is the entire craft. You set the ambient with shutter, then you set the room with flash, and the two do not fight.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];  // f/8
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[24];   // 1/8, far too much ambient to start
      s.whiteBalance = 5200;
      s.whiteBalanceAuto = false;
      s.lights = [{
        id: 'L1', x: -1.1, z: -3.5, height: 2.0, yaw: 25, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 8, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: { camera: true, plan: ['camera', 'L1'], controls: ['aperture', 'iso', 'lens', 'focal', 'mode', 'modifier', 'gel', 'head', 'height', 'tilt', 'wb'] },
    hint: 'Only shutter and flash power are live. Everything else is pinned.',
    goals: [
      goal('window', 'Hold the window between half a stop and two stops over, using shutter only',
        ({ result }) => {
          const c = result?.criteria.find((x) => x.id === 'window');
          return !!c && !c.notApplicable && c.stats.mean >= 0.2 && c.stats.mean <= 2.2 && c.stats.blown < 0.16;
        }),
      goal('room', 'Then bring the room to middle grey using flash power only',
        ({ result }) => Math.abs(result?.surfaceMedianStops ?? -9) < 0.85)
    ],
    coach: ({ state, lastResult }) => {
      if (!lastResult) return 'Fire a frame. You will not see the flash in the live view, because you cannot see flash through a viewfinder in real life either.';
      const w = lastResult.criteria.find((c) => c.id === 'window');
      const room = lastResult.surfaceMedianStops ?? 0;
      if (w && w.stats.blown > 0.16) {
        return `The window is ${Math.round(w.stats.blown * 100)}% blown. Shorten the shutter. You are at ${formatShutter(state.shutter)}.`;
      }
      if (w && w.stats.mean < 0.2) return 'The window has gone heavy. Let the shutter out a little.';
      if (room < -0.85) return `The room is ${room.toFixed(1)} stops under. Raise flash power. Notice the window does not move when you do.`;
      if (room > 0.85) return `The room is ${room.toFixed(1)} stops over. Drop flash power. Again, the window will not move.`;
      return 'That is the whole idea. Two exposures, two sets of controls, no argument between them.';
    },
    reward: 60
  },

  {
    n: 2,
    id: 'sync-wall',
    title: 'The sync speed wall',
    blurb: 'Go past 1/250 and a black band eats the frame. Find it, understand why, then meet high speed sync and what it costs.',
    sceneId: 'living-room',
    intro: [
      'A focal plane shutter is two curtains. Below sync speed the first finishes travelling before the second starts, so for a moment the whole sensor is open and the flash can light all of it.',
      'Above sync speed there is never a moment when the sensor is fully uncovered. A slit sweeps across instead, and the flash pulse only lights the strip that happens to be open. Everything else is a black band.',
      'High speed sync fixes it by firing a burst for the entire curtain travel rather than one pulse. It works, and it costs you roughly two stops at sync speed and another stop every time you halve the shutter after that.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[6];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[39];
      s.hss = false;
      s.lights = [{
        id: 'L1', x: 1.0, z: -2.0, height: 1.95, yaw: 15, tilt: 0, mode: 'direct',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 4, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: { plan: ['camera'], controls: ['aperture', 'iso', 'lens', 'focal', 'gel', 'head', 'tilt', 'wb'] },
    hint: 'Push the shutter past 1/250 and watch what the curtain does.',
    goals: [
      goal('find-band', 'Shoot a frame with the curtain visibly eating the picture',
        ({ history }) => history.some((h) => h.band > 0.25)),
      goal('hss', 'Then shoot past 1/250 again with high speed sync on and no band left',
        ({ state, history }) => history.some((h) => h.hss && h.shutter < 1 / 256 - 1e-9 && h.band < 0.01) && state.hss),
      goal('cost', 'Get that HSS frame properly exposed anyway, and feel what it cost',
        ({ history }) => history.some((h) => h.hss && h.shutter < 1 / 256 - 1e-9 && h.band < 0.01 && Math.abs(h.roomStops) < 1.0))
    ],
    coach: ({ state }) => {
      const band = syncBandCoverage(state.shutter, state.hss);
      if (band > 0.02) return `At ${formatShutter(state.shutter)} the shutter is only ever ${Math.round((1 - band) * 100)}% open at any instant. The flash lights that strip and nothing else.`;
      if (state.hss && state.shutter < 1 / 256) return 'HSS is on. The band is gone and so is a lot of your power. Check how far you had to push the head.';
      return 'You are at or below sync speed. Push past 1/250 and see what happens.';
    },
    reward: 60
  },

  {
    n: 3,
    id: 'inverse-square',
    title: 'Inverse square and distance',
    blurb: 'Power is not the only dial. Distance is a stronger one, and it changes the falloff across the room as well as the level.',
    sceneId: 'living-room',
    intro: [
      'Light falls off with the square of distance. Move a head from one metre to two and you have lost two stops, not one.',
      'That is brutal up close and gentle far away, which is the useful part. A head one metre from a wall lights the near end four times harder than the far end. The same head five metres back lights the whole wall almost evenly.',
      'So distance sets both the level and the evenness. Once you feel that, you stop reaching for the power dial first.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[36];
      s.lights = [{
        id: 'L1', x: 2.2, z: -1.0, height: 2.0, yaw: 200, tilt: 0, mode: 'direct',
        headId: 'ad200_bare', modifierId: 'none', gelId: 'none', power: 4, enabled: true
      }];
      s.selected = 'L1';
    },
    // The bare bulb, deliberately: a fresnel's cone can only ever light a
    // slice, so a whole-room drill about distance needs the omni head.
    lock: { controls: ['power', 'aperture', 'iso', 'shutter', 'lens', 'focal', 'mode', 'modifier', 'gel', 'head', 'wb'] },
    hint: 'Power is pinned at 1/4 on the bare bulb. Move the head on the plan instead.',
    goals: [
      goal('level', 'Land the room on middle grey by moving the head, not by changing power',
        ({ result }) => Math.abs(result?.surfaceMedianStops ?? -9) < 0.7),
      goal('feather', 'Then even it out: under three and a half stops between the brightest and darkest wall',
        ({ result }) => (result?.criteria.find((c) => c.id === 'even')?.stats.spread ?? 9) < 3.5)
    ],
    coach: ({ lastResult }) => {
      if (!lastResult) return 'The head is close to a wall and pinned at quarter power. Only its position and aim are live.';
      const room = lastResult.surfaceMedianStops ?? 0;
      const spread = lastResult.criteria.find((c) => c.id === 'even')?.stats.spread ?? 0;
      if (room > 0.7) return `Too hot by ${room.toFixed(1)} stops. Back the head away. Remember: doubling the distance costs two stops, not one.`;
      if (room < -0.7) return `${room.toFixed(1)} stops under. Bring the head closer, but watch the falloff as you do.`;
      if (spread > 3.5) return `Level is right but there are ${spread.toFixed(1)} stops across the room. Pull the head back further and aim past the near wall rather than straight at it. That is feathering.`;
      return 'Even and correctly placed, on distance alone.';
    },
    reward: 70
  },

  {
    n: 4,
    id: 'bare-bounce',
    title: 'Bare versus bounce',
    blurb: 'What a ceiling costs you in stops, what it buys in softness, and the colour it quietly hands you back.',
    sceneId: 'living-room',
    intro: [
      'Point a head at a white ceiling and the ceiling becomes the light. A hard 70mm source turns into a soft two metre one, and the shadows go from cut edges to gradients.',
      'It costs you two to three stops. It also picks up the colour of whatever it hit, which is fine off white plaster and a problem off wood or a painted wall.',
      'Raising a bounced head does not dim it, because the patch it makes grows exactly as fast as it fades. It only gets softer.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[36];
      s.lights = [{
        id: 'L1', x: 1.0, z: -2.2, height: 1.9, yaw: 20, tilt: 0, mode: 'direct',
        headId: 'ad200_bare', modifierId: 'none', gelId: 'none', power: 8, enabled: true
      }];
      s.selected = 'L1';
    },
    // Bare bulb rather than fresnel: the comparison is hard-versus-soft, and
    // an omni source is the only bare head that can carry a whole room.
    lock: { controls: ['aperture', 'iso', 'shutter', 'lens', 'focal', 'gel', 'head', 'wb'] },
    hint: 'Shoot it bare first. Then bounce it and pay the difference in power.',
    goals: [
      goal('bare', 'Shoot one frame bare, correctly exposed',
        ({ history }) => history.some((h) => h.mode === 'direct' && Math.abs(h.roomStops) < 0.85)),
      goal('bounce', 'Shoot it again off the ceiling, correctly exposed, and note the power you needed',
        ({ history }) => history.some((h) => h.mode === 'ceiling' && Math.abs(h.roomStops) < 0.85)),
      goal('softer', 'The bounced frame should be the cleaner one: under three stops of spread',
        ({ result, state }) => state.lights[0]?.mode === 'ceiling' &&
          (result?.criteria.find((c) => c.id === 'even')?.stats.spread ?? 9) < 3.2)
    ],
    coach: ({ state, lastResult }) => {
      const l = state.lights[0];
      if (!l) return null;
      if (l.mode === 'direct') return 'Bare head. Hard shadows, full power, and every texture in the room raked.';
      return lastResult && Math.abs(lastResult.surfaceMedianStops) > 0.85
        ? 'Bouncing just cost you about two stops. Open the head up to pay for it.'
        : 'That is the trade. Two stops for a two metre soft source and the ceiling colour thrown in.';
    },
    reward: 70
  },

  {
    n: 5,
    id: 'colour-gels',
    title: 'Colour temperature and gels',
    blurb: 'Ungelled flash against warm fixtures is the blue and orange split that makes interiors look amateur. There are three ways out.',
    sceneId: 'dark-office',
    intro: [
      'Flash is about 5500K. Household fixtures are 2700K to 3000K. White balance is one global setting, so with both in frame something has to give.',
      'You have three honest choices. Gel the flash down to match the fixtures and balance warm. Balance for the flash and accept the fixtures going orange, which can read as deliberate. Or overpower the fixtures so completely that they stop mattering.',
      'What you cannot do is leave both at full strength, balance in the middle, and hope.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[6];
      s.iso = ISO_STOPS[6];
      s.shutter = SHUTTER_STOPS[30];
      s.whiteBalance = 5500;
      s.whiteBalanceAuto = false;
      s.lights = [{
        id: 'L1', x: -1.0, z: -1.6, height: 2.0, yaw: 15, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 4, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: { controls: ['lens', 'focal', 'head'] },
    hint: 'Gels and white balance are both live. Fix the split.',
    goals: [
      goal('consistent', 'Get colour consistency to 80% or better',
        ({ result }) => (result?.criteria.find((c) => c.id === 'colour')?.fraction ?? 0) >= 0.8),
      goal('exposed', 'Without wrecking the exposure to do it',
        ({ result }) => Math.abs(result?.surfaceMedianStops ?? -9) < 1.0)
    ],
    coach: ({ state, lastResult }) => {
      const c = lastResult?.criteria.find((x) => x.id === 'colour');
      if (!c) return 'Shoot it ungelled first so you can see the split you are fixing.';
      if (c.stats.split > 1.4) return `Split is ${c.stats.split.toFixed(2)}. Try a full CTO on the head and drop white balance to around 3000K.`;
      if (c.stats.split > 0.8) return `Closer. ${c.stats.split.toFixed(2)} left. A quarter or half CTO, or nudge white balance the other way.`;
      if (Math.abs(state.whiteBalance - 3000) < 700 && c.fraction > 0.8) return 'Matched warm. The fixtures and the flash are now the same light.';
      return 'Colour is holding together.';
    },
    reward: 80
  },

  {
    n: 6,
    id: 'fixtures',
    title: 'Fixtures as subjects',
    blurb: 'Make the chandelier glow, with real falloff on the ceiling, without letting it bloom into a white blob.',
    sceneId: 'living-room',
    intro: [
      'A fixture that is switched on should read as switched on. That means brighter than the surface behind it, with a visible pool of its own light nearby.',
      'It also means not letting it blow out. The glowing element itself will always clip, and that is fine, but the shade and the ceiling around it should still have shape.',
      'The trap is dragging the shutter to make the fixtures glow. That lifts the window at exactly the same rate, and you lose both.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[30];
      s.camX = -1.4; s.camZ = -2.4; s.camYaw = 20; s.focal = 28;
      s.lights = [{
        id: 'L1', x: 1.2, z: -1.6, height: 2.0, yaw: 20, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 4, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: { controls: ['lens', 'head'] },
    hint: 'The fixtures and the window both want ambient. Only one of them can have it.',
    goals: [
      goal('glow', 'Fixtures reading as lit, with shape left around them: 80% or better',
        ({ result }) => (result?.criteria.find((c) => c.id === 'fixtures')?.fraction ?? 0) >= 0.8),
      goal('window', 'And the window still held',
        ({ result }) => {
          const c = result?.criteria.find((x) => x.id === 'window');
          return !c || c.notApplicable || c.fraction >= 0.75;
        })
    ],
    coach: ({ lastResult }) => {
      const f = lastResult?.criteria.find((c) => c.id === 'fixtures');
      if (!f) return 'Frame the chandelier and shoot.';
      if (f.stats?.mean < 0.4) return 'The fixtures are dead. Let a little more ambient in, or move so they are against a darker surface.';
      if (f.stats?.halo > 0.4) return 'They are blooming. Pull ambient back and put the level into the room with flash instead.';
      return 'They read as lit and the ceiling around them still has shape.';
    },
    reward: 80
  },

  {
    n: 7,
    id: 'reflections',
    title: 'Reflections and where you cannot hide',
    blurb: 'A bathroom is a room full of surfaces that show the camera exactly where you are standing.',
    sceneId: 'bathroom',
    intro: [
      'Mirrors, glass and polished stone all obey the same rule: the angle out equals the angle in. If you can see the head in the surface, the camera can too.',
      'That gives you a positive way to work rather than trial and error. Reflect the camera through the mirror plane and anything inside that reflected cone is going to appear.',
      'Find the positions that do not show. In a small bathroom there may only be a couple.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[33];
      s.lights = [{
        id: 'L1', x: 0.6, z: -1.0, height: 2.0, yaw: 0, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 8, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: { controls: ['lens'] },
    hint: 'Watch the mirror. You and your stand are both candidates for appearing in it.',
    goals: [
      goal('clean', 'Nothing of yours anywhere in the frame or the mirror',
        ({ result }) => (result?.criteria.find((c) => c.id === 'gear')?.fraction ?? 0) >= 0.99),
      goal('lit', 'And the room still properly lit',
        ({ result }) => Math.abs(result?.surfaceMedianStops ?? -9) < 1.0)
    ],
    coach: ({ lastResult }) => {
      const g = lastResult?.criteria.find((c) => c.id === 'gear');
      if (!g) return 'Shoot it and see what turns up in the glass.';
      if (g.stats.inMirror > 0.004) return 'You are in the mirror. Move off the mirror axis, or wait for module ten and shift the lens sideways instead.';
      if (g.stats.inFrame > 0.00025) return 'A stand is in frame. Bring it behind the camera line.';
      if (g.stats.glassHits?.length) return `The flash is bouncing straight back out of ${g.stats.glassHits[0]}. Change the head angle.`;
      return 'Clean. Nothing of yours in the picture.';
    },
    reward: 90
  },

  {
    n: 8,
    id: 'shadow-logic',
    title: 'Shadow logic',
    blurb: 'One dominant direction, and it agrees with the window. Two hard sources and the room stops being believable.',
    sceneId: 'great-room',
    intro: [
      'A room lit by a window has one shadow direction. Add a hard flash pointing the other way and the eye reads it as lit immediately, even if it cannot say why.',
      'Two hard heads of similar strength give every object two shadows. Nothing in nature does that.',
      'The fix is not fewer lights. It is one light being clearly the key and the others being soft, weak, or bounced.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[3];
      s.shutter = SHUTTER_STOPS[33];
      s.lights = [
        { id: 'L1', x: -1.8, z: -1.4, height: 2.2, yaw: 40, tilt: 0, mode: 'direct',
          headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 2, enabled: true },
        { id: 'L2', x: 2.0, z: -0.6, height: 2.2, yaw: -50, tilt: 0, mode: 'direct',
          headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 2, enabled: true }
      ];
      s.selected = 'L1';
    },
    lock: { controls: ['lens'] },
    hint: 'Two hard heads at equal power. Fix the shadow story.',
    goals: [
      goal('single', 'Shadow logic at 85% or better',
        ({ result }) => (result?.criteria.find((c) => c.id === 'shadows')?.fraction ?? 0) >= 0.85),
      goal('lit', 'With the room still lit properly',
        ({ result }) => Math.abs(result?.surfaceMedianStops ?? -9) < 1.0)
    ],
    coach: ({ lastResult }) => {
      const s = lastResult?.criteria.find((c) => c.id === 'shadows');
      if (!s) return 'Shoot it as it stands and look at the shadows on the floor.';
      if (s.stats.rivals) return 'Two hard shadows. Bounce the second head, soften it, or drop it two stops so it only fills.';
      if (s.stats.conflict > 0.3) return 'The key is fighting the daylight direction. Swing it round to the window side.';
      return 'One direction, and it agrees with the window.';
    },
    reward: 90
  },

  {
    n: 9,
    id: 'focal-length',
    title: 'Focal length and the room',
    blurb: 'The same room at 16, 24 and 35mm. Wider is not more impressive, it is more to light and more places to be caught.',
    sceneId: 'kitchen',
    intro: [
      'Focal length decides how much room you have committed to lighting. At 16mm the whole space is in frame and there is nowhere to put a stand. At 35mm you are lighting a slice and you can hide anything.',
      'Wide also reads cheap. Sixteen millimetres is a real estate listing. High end interiors live around 24 to 35mm full frame equivalent, and they look calmer for it.',
      'Shoot the same corner three times and feel the difference in what you had to solve.'
    ],
    setup: (s) => {
      s.lensId = 'wide_zoom';
      s.focal = 17;
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[33];
      s.lights = [{
        id: 'L1', x: -1.4, z: -1.8, height: 2.0, yaw: 10, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 4, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: {},
    hint: 'Same corner, three focal lengths. Notice what changes about the lighting problem, not just the framing.',
    goals: [
      goal('wide', 'Shoot it at 17mm or wider', ({ history }) => history.some((h) => h.eqFocal <= 19)),
      goal('mid', 'Shoot it around 24mm', ({ history }) => history.some((h) => h.eqFocal >= 22 && h.eqFocal <= 27)),
      goal('long', 'Shoot it around 35mm', ({ history }) => history.some((h) => h.eqFocal >= 32 && h.eqFocal <= 42)),
      goal('best', 'And get 70 or better on one of the two longer ones',
        ({ history }) => history.some((h) => h.eqFocal >= 22 && h.total >= 70))
    ],
    coach: ({ state }) => {
      const eq = Math.round(state.focal * (state.lensId === 'apsc_wide' ? 1.53 : 1));
      if (eq < 20) return `${eq}mm. Everything is in frame, including places to hide nothing. This is where stands get caught.`;
      if (eq < 30) return `${eq}mm. This is the range high end interiors actually live in.`;
      return `${eq}mm. You are lighting a slice now, which is a far smaller problem.`;
    },
    reward: 90
  },

  {
    n: 10,
    id: 'tilt-shift',
    title: 'Tilt shift',
    blurb: 'Rise instead of tilt. Lateral shift to stand off axis. And the point where the image circle runs out.',
    sceneId: 'bathroom',
    intro: [
      'Tipping the camera up to get the ceiling makes every vertical converge. Shifting the lens up instead moves the image circle across a sensor that stays parallel to the wall, so the verticals stay parallel and you simply see more ceiling.',
      'Lateral shift is the professional trick for a mirror. Stand off to the side, out of the reflection, and shift the lens sideways until the frame is centred again.',
      'It is not free. Past about eight to ten millimetres you run out of image circle and the corners go dark and soft, and shifting costs a fraction of a stop even before that.'
    ],
    unlocks: ['tilt_shift'],
    setup: (s) => {
      s.lensId = 'tilt_shift';
      s.focal = 24;
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[33];
      s.tilt = 0; s.shiftX = 0; s.shiftY = 0;
      s.lights = [{
        id: 'L1', x: 0.5, z: -1.2, height: 2.0, yaw: 0, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 8, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: { controls: ['lens'] },
    hint: 'The 24mm tilt shift is yours now. Rise, fall and lateral shift are on the Lens tab.',
    goals: [
      goal('rise', 'Use rise rather than tilt: at least 5mm of shift with the camera dead level',
        ({ history }) => history.some((h) => Math.abs(h.shiftY) >= 5 && Math.abs(h.tilt) < 0.35)),
      goal('mirror', 'Stand off the mirror axis, shift laterally, and keep yourself out of the reflection',
        ({ history }) => history.some((h) => Math.abs(h.shiftX) >= 4 && h.inMirror < 0.004 && h.inFrame < 0.00025)),
      goal('limit', 'Push the shift past 10mm once and see the corners go',
        ({ history }) => history.some((h) => Math.hypot(h.shiftX, h.shiftY) > 10))
    ],
    coach: ({ state }) => {
      const mag = Math.hypot(state.shiftX, state.shiftY);
      if (mag > 10) return `${mag.toFixed(0)}mm of shift. You are outside the image circle now: the corners are dark and soft. That is the real limit, not a setting.`;
      if (Math.abs(state.tilt) > 0.5) return 'You are still tilting. Level the camera and use rise instead, and watch the verticals straighten.';
      if (mag > 0.5) return `${mag.toFixed(0)}mm of shift, camera level. Verticals parallel, framing kept, and it cost you a fraction of a stop.`;
      return 'Level the camera, then add rise to get the ceiling back.';
    },
    reward: 120
  },

  {
    n: 11,
    id: 'full-frame',
    title: 'The full frame',
    blurb: 'A room you have not lit before, no hints, one scored shot.',
    sceneId: 'blue-hour',
    intro: [
      'No coaching from here. Read the room, decide what the frame is about, and light it.',
      'Everything you have is available. The rubric is the same one an art director would use.'
    ],
    setup: (s) => {
      s.aperture = APERTURE_STOPS[9];
      s.iso = ISO_STOPS[0];
      s.shutter = SHUTTER_STOPS[30];
      s.lights = [{
        id: 'L1', x: 0.0, z: -2.0, height: 2.0, yaw: 0, tilt: 0, mode: 'ceiling',
        headId: 'ad200_fresnel', modifierId: 'none', gelId: 'none', power: 4, enabled: true
      }];
      s.selected = 'L1';
    },
    lock: {},
    noCoach: true,
    hint: '',
    goals: [goal('score', 'Score 70 or better', ({ result }) => (result?.total ?? 0) >= 70)],
    reward: 150
  }
];

export function moduleById(id) { return MODULES.find((m) => m.id === id); }
export function moduleByNumber(n) { return MODULES.find((m) => m.n === n); }

/** Modules unlock in order. Nothing here is optional. */
export function isUnlocked(mod, progress) {
  if (mod.n === 1) return true;
  const prev = MODULES.find((m) => m.n === mod.n - 1);
  return progress.completedModules.includes(prev.id);
}
