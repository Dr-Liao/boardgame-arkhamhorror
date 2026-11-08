import { ATTACK_THEMES } from './attack-themes.js'

const fade = [{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1', offset: .25 }, { opacity: 0, scale: '1.4' }]
const react = miss => miss
  ? [{ translate: '0 0' }, { translate: '18px 0', offset: .4 }, { translate: '0 0' }]
  : [{ translate: '0 0', filter: 'brightness(1)' }, { translate: '-6px 3px', filter: 'brightness(1.7)', offset: .2 },
    { translate: '5px -2px', offset: .45 }, { translate: '0 0', filter: 'brightness(1)' }]

// Different motions share a small set of templates. Every motif is code-native,
// stays in the overlay, and has no knowledge of card rules or card numbers.
export function themedAttackChoreography(style, g, basic) {
  const theme = ATTACK_THEMES[style]
  const { node, start, end, ux, uy, box, miss } = g
  const aim = miss ? { x: end.x + ux * 65 - uy * 38, y: end.y + uy * 65 + ux * 38 } : end
  const dx = aim.x - start.x, dy = aim.y - start.y, angle = Math.atan2(dy, dx)
  const length = Math.max(1, Math.hypot(dx, dy))
  const elements = [], strike = [], impact = []
  const at = (cls, position, styles = {}, text) => {
    const el = node('div', `ah-p1-part ${cls}`, text)
    Object.assign(el.style, { left: position.x + 'px', top: position.y + 'px', ...styles })
    el.style.setProperty('--p1', theme.color)
    el.setAttribute('aria-hidden', 'true'); elements.push(el); return el
  }
  const hit = at('ah-p1-hit', aim)
  impact.push([hit, miss ? [{ opacity: 0 }, { opacity: 0 }] : fade, 480])
  const sourceMotion = source => [source, [{ filter: 'brightness(1)', translate: '0 0' },
    { filter: 'brightness(1.4)', translate: `${-ux * 6}px ${-uy * 6}px`, offset: .35 }, { filter: 'brightness(1)', translate: '0 0' }], 420]

  const shards = (count, cls = 'ah-p1-spark') => {
    for (let i = 0; i < count; i++) {
      const turn = i / count * Math.PI * 2, reach = 35 + (i % 3) * 15
      const part = at(cls, aim, { rotate: i * 47 + 'deg' })
      impact.push([part, [{ translate: '0 0', scale: '.3', opacity: 0 },
        { opacity: miss ? .25 : 1, offset: .15 }, { translate: `${Math.cos(turn) * reach}px ${Math.sin(turn) * reach}px`, scale: '1', opacity: 0 }], 550])
    }
  }

  if (theme.family === 'projectile') {
    const motif = theme.motif
    const projectile = at(`ah-p1-projectile is-${motif}`, start, { rotate: angle + 'rad' })
    const arcing = ['bottle', 'vial', 'flare'].includes(motif)
    const lift = arcing ? Math.min(110, length * .3) : 0
    const launch = at(`ah-p1-launch is-${motif}`, start, { rotate: angle + 'rad' })
    strike.push([launch, fade, 400], [projectile,
      [{ translate: '0 0', opacity: 0, rotate: angle + 'rad' },
        { translate: '0 0', opacity: 1, offset: .15 },
        { translate: `${dx / 2}px ${dy / 2 - lift}px`, opacity: 1, rotate: arcing ? '150deg' : angle + 'rad', offset: .55 },
        { translate: `${dx}px ${dy}px`, opacity: 1, rotate: arcing ? '300deg' : angle + 'rad' }], 510])
    impact.push([projectile, [{ opacity: 1 }, { opacity: 0 }], 320])
    if (['harpoon', 'spear'].includes(motif)) {
      const tether = at(`ah-p1-tether is-${motif}`, start, { width: length + 'px', rotate: angle + 'rad' })
      strike.push([tether, [{ scale: '0 1', opacity: 0 }, { scale: '1 1', opacity: 1 }], 510])
      impact.push([tether, [{ opacity: .8 }, { opacity: 0 }], 400])
    }
    if (motif === 'vial') {
      const puddle = at('ah-p1-acid', aim)
      impact.push([puddle, fade, 650]); shards(9, 'ah-p1-droplet')
    } else if (motif === 'bottle') shards(10, 'ah-p1-glass')
    else if (motif === 'flare') {
      const flare = at('ah-p1-flare', aim)
      impact.push([flare, fade, 620]); shards(8)
    } else shards(5)
  } else if (theme.family === 'flame') {
    const jet = at('ah-p1-flame', start, { width: length + 'px', rotate: angle + 'rad' })
    const core = at('ah-p1-flame-core', start, { width: length + 'px', rotate: angle + 'rad' })
    const burn = at('ah-p1-burn', aim)
    strike.push([jet, [{ scale: '0 .35', opacity: 0 }, { scale: '.7 .7', opacity: 1, offset: .3 },
      { scale: '1 1', opacity: .85, offset: .6 }, { scale: '1 .85', opacity: 1 }], 620],
      [core, [{ scale: '0 1', opacity: 0 }, { scale: '1 1', opacity: .9, offset: .6 }, { opacity: .4 }], 620])
    impact.push([jet, [{ opacity: 1 }, { opacity: 0 }], 360], [core, [{ opacity: .4 }, { opacity: 0 }], 280],
      [burn, miss ? [{ opacity: 0 }, { opacity: 0 }] : fade, 600]); shards(10)
  } else if (theme.family === 'beast') {
    const beast = at(`ah-p1-beast is-${theme.motif}`, start, { rotate: angle + 'rad' })
    strike.push([beast, [{ translate: '0 0', scale: '.5', opacity: 0 }, { opacity: .9, offset: .2 },
      { translate: `${dx * .55}px ${dy * .55 - 32}px`, scale: '1.1', opacity: 1, offset: .6 },
      { translate: `${dx}px ${dy}px`, scale: '1', opacity: 0 }], 460])
    const jaws = at(`ah-p1-jaws is-${theme.motif}`, aim)
    impact.push([jaws, [{ scale: '1.3', opacity: 0 }, { scale: '.8', opacity: 1, offset: .3 }, { scale: '.5', opacity: 0 }], 450])
    if (theme.motif === 'ghostHound') {
      for (let i = 0; i < 4; i++) {
        const echo = at('ah-p1-hound-echo', { x: start.x + dx * (i + 1) / 5, y: start.y + dy * (i + 1) / 5 })
        strike.push([echo, fade, 330 + i * 45])
      }
    }
    if (theme.motif === 'claws') {
      for (let i = 0; i < 4; i++) {
        const claw = at('ah-p1-claw', { x: aim.x + i * 14 - 21, y: aim.y }, { rotate: '-25deg' })
        impact.push([claw, fade, 420 + i * 45])
      }
    }
  } else if (theme.family === 'bind') {
    const cord = at('ah-p1-cord', aim, { width: Math.max(70, Math.min(160, box.width)) + 'px' })
    const ends = at('ah-p1-cord-ends', aim)
    strike.push([cord, [{ scale: '1.6 1', opacity: 0 }, { scale: '1.2 1', opacity: 1 }], 380])
    impact.push([cord, [{ scale: '1.2 1', rotate: '-15deg', opacity: 1 }, { scale: '.65 .8', rotate: '15deg', opacity: 1, offset: .45 }, { opacity: 0 }], 600],
      [ends, fade, 500])
  } else if (theme.family === 'wave') {
    for (let i = 0; i < 4; i++) {
      const wave = at('ah-p1-sound-wave', start, { rotate: angle + 'rad' })
      strike.push([wave, [{ translate: '0 0', scale: '.2', opacity: 0 }, { opacity: .9, offset: .15 + i * .08 },
        { translate: `${dx}px ${dy}px`, scale: String(1 + i * .15), opacity: 0 }], 510 + i * 40])
      const note = at('ah-p1-note', { x: aim.x + i * 20 - 30, y: aim.y - i * 12 }, {}, i % 2 ? '♪' : '♩')
      impact.push([note, [{ translate: '0 0', opacity: 0 }, { opacity: 1, offset: .2 }, { translate: '0 -45px', opacity: 0 }], 550])
    }
  } else {
    // Arcane blades keep the physical strike; spells keep their cast/flight.
    // Motifs add distinct structure and motion, rather than a palette swap.
    const base = basic(theme.family === 'blade' ? 'blade' : 'spell', g)
    elements.push(...base.elements)
    strike.push(...base.strike(null).filter(([el]) => el))
    impact.push(...base.impact(null).filter(([el]) => el))
    const position = ['book','eclipse','charge','moon'].includes(theme.motif) ? start : aim
    const motif = at(`ah-p1-motif is-${theme.motif}`, position)
    const frames = [{ opacity: 0, scale: '.25', rotate: '-30deg' },
      { opacity: 1, scale: '1', rotate: '0deg', offset: .35 }, { opacity: 0, scale: '1.4', rotate: '35deg' }]
    if (position === start) strike.push([motif, frames, 480])
    else impact.push([motif, frames, 580])
    if (theme.motif === 'book') for (let i = 0; i < 3; i++) {
      const page = at('ah-p1-page', start, { rotate: i * 15 - 15 + 'deg' })
      strike.push([page, [{ rotate: '-65deg', opacity: 0 }, { rotate: '15deg', opacity: 1, offset: .4 }, { rotate: '75deg', opacity: 0 }], 380 + i * 80])
    }
    if (['ghost','charge','moon','seal'].includes(theme.motif)) {
      for (let i = 0; i < 3; i++) {
        const edge = at(`ah-p1-arcane-edge is-${theme.motif}`, { x: aim.x + i * 14 - 14, y: aim.y }, { rotate: i * 18 - 36 + 'deg' })
        impact.push([edge, fade, 400 + i * 70])
      }
    }
    if (theme.motif === 'drain') for (let i = 0; i < 5; i++) {
      const drop = at('ah-p1-blood', aim)
      impact.push([drop, [{ translate: '0 0', opacity: 0 }, { opacity: miss ? 0 : 1, offset: .2 },
        { translate: `${-dx}px ${-dy + i * 5}px`, opacity: 0 }], 540 + i * 30])
    }
  }
  return { style, family: theme.family, color: theme.color, elements,
    strikeSound: theme.strikeSound, impactSound: theme.impactSound,
    strike: source => [sourceMotion(source), ...strike],
    impact: target => [[target, react(miss), 360], ...impact] }
}
