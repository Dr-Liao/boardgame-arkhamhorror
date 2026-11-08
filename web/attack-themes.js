// Pure presentation profiles shared with the server's style allowlist.
const theme = (family, motif, color, strikeSound, impactSound) => Object.freeze({ family, motif, color, strikeSound, impactSound })
const sample = name => Object.freeze({ sample: name })
const synth = name => Object.freeze({ synth: name })
export const ATTACK_THEMES = Object.freeze({
  bloodEclipse: theme('spell', 'eclipse', '#ed788b', synth('spellCast'), sample('p1Energy')),
  spectralBlade: theme('blade', 'ghost', '#a6e8ee', sample('p1ArcaneSlash'), sample('bladeHit')),
  twilightBlade: theme('blade', 'moon', '#dcbaed', sample('bladeSlash'), sample('directArcane')),
  holySpear: theme('projectile', 'spear', '#ffe4a1', synth('swing'), sample('p1ArrowHit')),
  flamethrower: theme('flame', 'fire', '#ffb862', sample('p1Flame'), sample('directImpact')),
  bow: theme('projectile', 'arrow', '#e5d1a2', sample('p1Bow'), sample('p1ArrowHit')),
  acid: theme('projectile', 'vial', '#bde88b', synth('swing'), sample('p1Acid')),
  flare: theme('projectile', 'flare', '#fff3bb', synth('swing'), sample('p1Flare')),
  hound: theme('beast', 'dog', '#e6ba8f', synth('swing'), sample('directBite')),
  spectralHound: theme('beast', 'ghostHound', '#a5e9db', synth('spellCast'), sample('directBite')),
  harpoon: theme('projectile', 'harpoon', '#aad6d7', synth('swing'), sample('p1ArrowHit')),
  garrote: theme('bind', 'cord', '#d6c0a7', sample('p1Cord'), sample('directBite')),
  bottle: theme('projectile', 'bottle', '#b1d8aa', synth('swing'), sample('directGlass')),
  deathSong: theme('wave', 'song', '#b8a4e7', sample('p1Resonance'), synth('spellHit')),
  ancientBlade: theme('blade', 'seal', '#e9d49d', sample('bladeSlash'), sample('p1Energy')),
  voidSpell: theme('spell', 'rift', '#c8a5ec', synth('spellCast'), sample('p1Void')),
  enchantedBlade: theme('blade', 'charge', '#98dded', sample('p1ArcaneSlash'), sample('p1Energy')),
  bloodBlade: theme('blade', 'drain', '#dc667f', sample('bladeSlash'), sample('directBite')),
  holyStrike: theme('spell', 'pillar', '#fff0ba', synth('spellCast'), sample('p1Energy')),
  abyssalTome: theme('spell', 'book', '#9ed6c6', sample('p1Book'), sample('p1Void')),
  transformation: theme('beast', 'claws', '#df8b92', synth('stormRise'), sample('directImpact')),
})
