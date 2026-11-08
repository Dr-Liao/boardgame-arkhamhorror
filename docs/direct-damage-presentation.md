# Direct-damage presentation

P0 direct-damage feedback is separate from attack resolution: it never starts a
test, spends an action, changes a target, or changes damage attribution.

- `content/presentation/direct-damage-styles.js` selects reusable feedback styles
  for the 30 P0 card implementations. Printed reprints reuse the canonical style
  through `duplicateOfCode`, retaining their printed source code in the cue.
- `src/integration/direct-damage.js` reads the current provenance frame and source
  instance. Legacy flows can pass an optional final presentation hint
  `{ code, assetId, style }` to engine `damageEnemy` (style is optional and must
  name an allowlisted theme). This hint is not its rules `source`
  argument and must not change immunity or attribution decisions.
- `src/engine/enemies.js` publishes `directDamage` only after positive damage has
  passed protection and amount adjustment. Its table snapshot precedes placement
  and lethal removal. Investigator/asset area damage records actual assigned
  placement, including damage redirected to a diving suit.
- Ordinary outgoing attacks keep their existing cues. The existing zero-standard-
  damage grenade attack omits its successful empty strike, while misses remain
  visible. Actual area damage supplies the blast targets.
- `web/table-presentation.js` groups adjacent blast placements from the same
  source, actor and location, ending at checkpoints/other scenes. It preserves
  the first pre-damage snapshot; it does not mutate source events. A choice can
  split a blast into separate newly committed portions without replaying targets.
- `web/direct-damage-fx.js` reuses strike templates and adds source highlighting,
  impact and amount. Captions stay visible with reduced motion. Fast mode, mute,
  reset, scene cancellation and sequence deduplication share the existing player.
- Missing source assets (discarded costs) use previous source bounds and the
  named caption. Missing enemy anchors fall back to the target location.

New sampled impacts are downloaded Kenney CC0 files. Original filenames, hashes,
license and author are in `web/audio/direct-damage-sources.json`,
`web/audio/LICENSE-Kenney-impact.txt` and `web/audio/SOURCES.md`. Runtime playback
uses local bundled files and makes no external audio requests.

Validation: `tests/direct-damage-presentation.test.mjs` covers all 30 source styles,
actual card descriptors, legacy draw/evade paths, optional and skipped branches,
lethal damage, privacy and area assignment. `tests/attack-animation.browser.mjs`
covers desktop/mobile playback, samples, reduced motion, mute, fast mode and reset.
