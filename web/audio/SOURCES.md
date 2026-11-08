# Sound effect sources

All sound effects listed below are distributed under
[Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

- `card-slide.ogg` — `cardSlide2.ogg` from
  [Casino Audio](https://kenney.nl/assets/casino-audio) by Kenney.
- `encounter-reveal.ogg` — `horror-reveal-shock` by Lavacoal123,
  downloaded from [Freesound](https://freesound.org/people/Lavacoal123/sounds/424423/).
- `blade-slash.ogg` / `blade-hit.ogg` — `knifeSlice.ogg` / `chop.ogg` from
  [50 RPG sound effects](https://opengameart.org/content/50-rpg-sound-effects) by Kenney.
- `firearm-shot.wav` — `1911/A_42P.wav` (M1911 .45, near distance) from
  [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library),
  recorded by Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney. First shot
  only: 0.6 s from the onset, downmixed to mono 48 kHz, normalized, 0.2 s fade-out.
- `dynamite-blast.ogg` — `lowFrequency_explosion_000.ogg` from
  [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) by Kenney.
- `lightning-zap.wav` — mix of
  [ELECTRIC_ZAP_001](https://freesound.org/people/JoelAudio/sounds/136542/) by JoelAudio
  and [Long Crackle 04](https://freesound.org/people/ironcross32/sounds/582631/) by
  ironcross32 (both Freesound, CC0): the zap at full level with the crackle under it at
  55 %, rendered to 0.72 s mono 44.1 kHz, normalized, 0.08 s fade-out.

The remaining interface effects come from Kenney's Interface Sounds pack; its
bundled license is preserved in `License.txt`.

## Direct-damage feedback (P0, 2026-11-07)

Downloaded from the official [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)
pack through its download interface. The author explicitly publishes the pack as
CC0; the archive's original license is preserved in `LICENSE-Kenney-impact.txt`.
These files are unmodified copies (renamed only), suitable for redistribution:

| Shipped file | Original archive path | Use |
|---|---|---|
| `direct-impact.ogg` | `Audio/impactPunch_heavy_000.ogg` | Direct hits and ally damage |
| `direct-bite.ogg` | `Audio/impactSoft_heavy_000.ogg` | Dog/cat impact |
| `direct-glass.ogg` | `Audio/impactGlass_heavy_000.ogg` | Thrown lantern impact |
| `direct-arcane.ogg` | `Audio/impactPlate_light_000.ogg` | Arcane, curse, flash and redirected impact |

Shooting, blade and explosion branches reuse the CC0 samples documented above.
Magic cast synthesis remains the existing original Web Audio implementation;
the new impact layer uses the downloaded CC0 sample. No runtime network download.

## Themed attacks (P1, 2026-11-07)

Eleven additional samples are sourced from Kenney's official
[Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds),
[RPG Audio](https://kenney.nl/assets/rpg-audio) and
[Impact Sounds](https://kenney.nl/assets/impact-sounds) packs, all CC0 1.0.
The original archive licenses are preserved as `LICENSE-Kenney-scifi.txt`,
`LICENSE-Kenney-rpg.txt` and `LICENSE-Kenney-impact.txt`.
`themed-attack-sources.json` records each file's exact original name, author,
pack URL, modification status, bytes and SHA-256. Fire jets, acid, arrow hits,
bow/cord motion, turning pages and arcane impacts use these bundled samples.
Ten files are renamed only. `p1-flame.ogg` uses the first 0.85 seconds of
`thrusterFire_000.ogg`, converted to mono 44.1 kHz Vorbis q4 with a 0.02-second
fade-in and 0.18-second fade-out, so the jet stops with its visual beat.

## Enemy attacks (2026-11-07)

Seven additional clips use Ogrebane's [Monster Sound Pack, Volume 1](https://opengameart.org/content/monster-sound-pack-volume-1)
(the page downloads `monster-sounds-volume-2.zip`) and Kenney's
[Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), both CC0 1.0.
`enemy-attack-sources.json` records the original filenames, authors, processing,
actual durations and original/output SHA-256 checksums. Creature attacks, heavy
roars, spectral voices, fear, swarms and flight use short mono 44.1 kHz Vorbis
clips with fades and conservative gain. The license records are
`LICENSE-Ogrebane-monster.txt` and the existing `LICENSE-Kenney-scifi.txt`.
