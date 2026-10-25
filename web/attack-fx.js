// Outgoing attack choreography keyed by the public `attackStyle` of an attack
// cue. Each plan lists its overlay elements, the strike and impact motions as
// [element, keyframes, duration], and the sound cue for each beat.
const SVG = 'http://www.w3.org/2000/svg'
const place = (el, style) => { Object.assign(el.style, style); return el }
const zigzag = (from, to, jitter) => {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length
  const steps = Math.max(4, Math.round(length / 34)), points = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, offset = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * jitter
    points.push(`${(from.x + dx * t + nx * offset).toFixed(1)},${(from.y + dy * t + ny * offset).toFixed(1)}`)
  }
  return points.join(' ')
}
const lunge = (ux, uy, back, forward) => [{ translate: '0 0' }, { translate: `${-ux * back}px ${-uy * back}px`, offset: .3 },
  { translate: `${ux * forward}px ${uy * forward}px`, offset: .65 }, { translate: '0 0' }]
const dodge = [{ translate: '0 0' }, { translate: '20px 0' }, { translate: '0 0' }]
const shake = [{ translate: '0 0', filter: 'brightness(1)' }, { translate: '-7px 0', filter: 'brightness(1.8) sepia(.5)', offset: .2 },
  { translate: '7px 0', offset: .45 }, { translate: '-3px 0', offset: .7 }, { translate: '0 0', filter: 'brightness(1)' }]

const STYLES = {
  default({ node, start, end, length, angle, ux, uy, miss }) {
    const slash = place(node('div', 'ah-combat-slash'), { left: start.x + 'px', top: start.y + 'px', width: length + 'px', rotate: angle + 'rad' })
    const burst = place(node('div', 'ah-combat-burst'), { left: end.x + 'px', top: end.y + 'px' })
    return {
      elements: [slash, burst], strikeSound: { synth: 'swing' }, impactSound: { synth: 'hit' },
      strike: source => [[source, lunge(ux, uy, 10, 28), 360],
        [slash, [{ scale: '0 1', opacity: 0 }, { scale: '1 1', opacity: 1, offset: .65 }, { scale: '1 1', opacity: 0 }], 360]],
      impact: target => [[target, miss ? dodge : shake, 340], [burst, [{ scale: '.3', opacity: 1 }, { scale: '1.5', opacity: 0 }], 440]],
    }
  },
  firearm({ node, start, end, angle, ux, uy, miss }) {
    // A miss carries the round past the target and slightly off line.
    const aim = miss ? { x: end.x + ux * 70 - uy * 38, y: end.y + uy * 70 + ux * 38 } : end
    const flight = Math.atan2(aim.y - start.y, aim.x - start.x)
    const muzzle = place(node('div', 'ah-combat-muzzle'), { left: start.x + ux * 22 + 'px', top: start.y + uy * 22 + 'px', rotate: angle + 'rad' })
    const tracer = place(node('div', 'ah-combat-tracer'), { left: start.x + 'px', top: start.y + 'px', rotate: flight + 'rad' })
    const hole = place(node('div', 'ah-combat-hole'), { left: end.x + 'px', top: end.y + 'px' })
    return {
      elements: [muzzle, tracer, hole], strikeSound: { sample: 'gunshot' }, impactSound: { synth: 'hit' },
      strike: source => [[source, [{ translate: '0 0' }, { translate: `${-ux * 14}px ${-uy * 14}px`, offset: .2 }, { translate: '0 0' }], 280],
        [muzzle, [{ scale: '.3', opacity: 1 }, { scale: '1.3', opacity: .95, offset: .3 }, { scale: '1.5', opacity: 0 }], 220],
        [tracer, [{ translate: '0 0', opacity: 1 }, { translate: `${aim.x - start.x}px ${aim.y - start.y}px`, opacity: miss ? 0 : 1 }], 160]],
      impact: target => [[target, miss ? dodge : [{ translate: '0 0', filter: 'brightness(1)' }, { translate: `${ux * 9}px ${uy * 9}px`, filter: 'brightness(2)', offset: .15 },
        { translate: '0 0', filter: 'brightness(1)' }], 260],
      [hole, [{ scale: '.2', opacity: 1 }, { scale: '1', opacity: 1, offset: .25 }, { scale: '1.15', opacity: 0 }], 560]],
    }
  },
  lightning({ node, start, end, angle, ux, uy, miss }) {
    const aim = miss ? { x: end.x + ux * 70 - uy * 38, y: end.y + uy * 70 + ux * 38 } : end
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('class', 'ah-combat-bolts')
    const bolts = [[14, 'is-main'], [26, 'is-branch']].map(([jitter, cls]) => {
      const bolt = document.createElementNS(SVG, 'polyline')
      bolt.setAttribute('class', 'ah-combat-bolt ' + cls)
      bolt.setAttribute('points', zigzag(start, aim, jitter))
      svg.append(bolt); return bolt
    })
    const charge = place(node('div', 'ah-combat-charge'), { left: start.x + ux * 18 + 'px', top: start.y + uy * 18 + 'px', rotate: angle + 'rad' })
    const burst = place(node('div', 'ah-combat-burst is-electric'), { left: end.x + 'px', top: end.y + 'px' })
    const flicker = [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: .25, offset: .2 }, { opacity: 1, offset: .32 },
      { opacity: .4, offset: .5 }, { opacity: .95, offset: .62 }, { opacity: 0 }]
    return {
      elements: [svg, charge, burst], strikeSound: { sample: 'lightningZap' }, impactSound: { synth: 'hit' },
      strike: source => [[source, [{ translate: '0 0', filter: 'brightness(1)' }, { translate: `${-ux * 8}px ${-uy * 8}px`, filter: 'brightness(1.6) hue-rotate(180deg)', offset: .3 },
        { translate: '0 0', filter: 'brightness(1)' }], 420],
      [charge, [{ scale: '.3', opacity: 0 }, { scale: '1.2', opacity: 1, offset: .3 }, { scale: '1', opacity: .8, offset: .7 }, { scale: '1.4', opacity: 0 }], 420],
      [bolts[0], flicker, 420], [bolts[1], flicker.map((frame, index) => index % 2 ? { ...frame, opacity: frame.opacity * .7 } : frame), 380]],
      impact: target => [[target, miss ? dodge : [{ translate: '0 0', filter: 'brightness(1)' },
        ...[3, -3, 2, -2, 1].map((x, index) => ({ translate: `${x}px ${-x}px`, filter: index % 2 ? 'brightness(1)' : 'brightness(2.2) saturate(.3) hue-rotate(180deg)' })),
        { translate: '0 0', filter: 'brightness(1)' }], 380],
      [burst, [{ scale: '.3', opacity: 1 }, { scale: '1.6', opacity: 0 }], 420]],
    }
  },
  spell({ node, start, end, ux, uy, miss }) {
    const aim = miss ? { x: end.x + ux * 72 - uy * 42, y: end.y + uy * 72 + ux * 42 } : end
    const dx = aim.x - start.x, dy = aim.y - start.y
    const sigil = place(node('div', 'ah-combat-sigil'), { left: start.x + 'px', top: start.y + 'px' })
    const orb = place(node('div', 'ah-combat-orb'), { left: start.x + 'px', top: start.y + 'px' })
    const ward = place(node('div', 'ah-combat-ward'), { left: end.x + 'px', top: end.y + 'px' })
    return {
      elements: [sigil, orb, ward], strikeSound: { synth: 'spellCast' }, impactSound: { synth: 'spellHit' },
      strike: source => [[source, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.5) hue-rotate(70deg)', offset: .45 }, { filter: 'brightness(1)' }], 480],
        [sigil, [{ scale: '.2', rotate: '-35deg', opacity: 0 }, { scale: '1', rotate: '20deg', opacity: 1, offset: .4 }, { scale: '1.25', rotate: '90deg', opacity: 0 }], 480],
        [orb, [{ translate: '0 0', scale: '.3', opacity: 0 }, { translate: '0 0', scale: '1', opacity: 1, offset: .23 },
          { translate: `${dx}px ${dy}px`, scale: '.8', opacity: 1, offset: .82 }, { translate: `${dx}px ${dy}px`, scale: '.2', opacity: 0 }], 480]],
      impact: target => [[target, miss ? dodge : shake, 340],
        [ward, [{ scale: '.2', rotate: '-35deg', opacity: 0 }, { scale: '.7', rotate: '10deg', opacity: miss ? .45 : 1, offset: .18 },
          { scale: '1.55', rotate: '80deg', opacity: 0 }], 490]],
    }
  },
  blade({ node, end, box, ux, uy, miss }) {
    const size = Math.max(80, Math.min(240, Math.max(box.width, box.height) * 1.1))
    const cuts = [-36, 24].map(deg => place(node('div', 'ah-combat-cut'), { left: end.x + 'px', top: end.y + 'px', width: size + 'px', rotate: deg + 'deg' }))
    const hidden = 'inset(-12px 100% -12px -12px)', shown = 'inset(-12px -12px -12px -12px)'
    const sweep = delay => [{ clipPath: hidden, opacity: 1 }, ...(delay ? [{ clipPath: hidden, opacity: 1, offset: delay }] : []),
      { clipPath: shown, opacity: 1, offset: delay + .3 }, { clipPath: shown, opacity: 0 }]
    return {
      elements: cuts, strikeSound: { sample: 'bladeSlash' }, impactSound: { sample: 'bladeHit' },
      strike: source => [[source, lunge(ux, uy, 14, 46), 320]],
      impact: target => [[target, miss ? dodge : [{ translate: '0 0', filter: 'brightness(1)' }, { translate: `${ux * 8}px ${uy * 8}px`, filter: 'brightness(1.6) saturate(1.6) hue-rotate(-20deg)', offset: .2 },
        { translate: `${-ux * 4}px ${-uy * 4}px`, offset: .5 }, { translate: '0 0', filter: 'brightness(1)' }], 360],
      [cuts[0], sweep(0), 380], [cuts[1], sweep(.28), 480]],
    }
  },
}

// Area damage cue (`kind: 'blast'`): a lit charge is thrown from the acting
// investigator to the chosen location, then detonates over every target there.
export function blastChoreography({ node, from, center, radius, targets }) {
  const size = Math.max(120, Math.min(320, radius * 2.2))
  const stick = place(node('div', 'ah-blast-stick'), { left: from.x + 'px', top: from.y + 'px' })
  const flash = node('div', 'ah-blast-flash')
  flash.style.setProperty('--x', center.x + 'px'); flash.style.setProperty('--y', center.y + 'px')
  const fireball = place(node('div', 'ah-blast-fireball'), { left: center.x + 'px', top: center.y + 'px', width: size + 'px', height: size + 'px' })
  const ring = place(node('div', 'ah-blast-ring'), { left: center.x + 'px', top: center.y + 'px', width: size + 'px', height: size + 'px' })
  const smoke = place(node('div', 'ah-blast-smoke'), { left: center.x + 'px', top: center.y + 'px', width: size * 1.2 + 'px', height: size * 1.2 + 'px' })
  const debris = Array.from({ length: 12 }, (_, index) => {
    const turn = index / 12 * Math.PI * 2 + Math.random() * .4, reach = size * (.55 + Math.random() * .45)
    return [place(node('div', 'ah-blast-debris'), { left: center.x + 'px', top: center.y + 'px' }), Math.cos(turn) * reach, Math.sin(turn) * reach]
  })
  const hits = targets.map(([el, at]) => [el, place(node('div', 'ah-combat-burst is-fire'), { left: at.x + 'px', top: at.y + 'px' })])
  const dx = center.x - from.x, dy = center.y - from.y, lift = Math.max(70, Math.hypot(dx, dy) * .35)
  return {
    elements: [smoke, fireball, ring, ...debris.map(([el]) => el), ...hits.map(([, burst]) => burst), stick, flash],
    throwSound: { synth: 'swing' }, blastSound: { sample: 'dynamiteBlast' },
    throw: [[stick, [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: `${dx / 2}px ${dy / 2 - lift}px`, rotate: '330deg', offset: .5, opacity: 1 },
      { translate: `${dx}px ${dy}px`, rotate: '660deg', opacity: 1 }], 560]],
    blast: [
      [flash, [{ opacity: 0 }, { opacity: .55, offset: .08 }, { opacity: 0 }], 360],
      [fireball, [{ scale: '.15', opacity: 1 }, { scale: '1', opacity: 1, offset: .35 }, { scale: '1.25', opacity: 0 }], 700],
      [ring, [{ scale: '.2', opacity: 1 }, { scale: '1.7', opacity: 0 }], 620],
      [smoke, [{ scale: '.4', opacity: 0 }, { scale: '.9', opacity: .85, offset: .3 }, { scale: '1.3', opacity: 0 }], 1100],
      ...debris.map(([el, x, y]) => [el, [{ translate: '0 0', opacity: 1 }, { translate: `${x}px ${y}px`, opacity: 0 }], 520 + Math.random() * 260]),
      ...hits.flatMap(([el, burst]) => [[el, [{ translate: '0 0', filter: 'brightness(1)' }, { translate: '-9px 4px', filter: 'brightness(1.9) sepia(.8) saturate(2)', offset: .15 },
        { translate: '8px -3px', offset: .35 }, { translate: '-4px 2px', offset: .6 }, { translate: '0 0', filter: 'brightness(1)' }], 520],
      [burst, [{ scale: '.3', opacity: 1 }, { scale: '1.5', opacity: 0 }], 480]]),
    ],
  }
}

export function attackChoreography(style, geometry) {
  const name = Object.hasOwn(STYLES, style) ? style : 'default'
  return { style: name, ...STYLES[name](geometry) }
}
