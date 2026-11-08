# Themed attack presentation

The P1 presentation layer gives existing attack implementations distinct geometry
and sound without changing costs, skill tests, targets, damage, or card behavior.

`content/presentation/attack-styles.js` maps card identities to public styles.
`src/integration/attack-style.js` resolves explicit overrides before traits and
the default; printed reprints can reuse their canonical override. The style
allowlist includes the pure profiles in `web/attack-themes.js`.

`combat.js` resolves presentation identity from the source asset, explicit attack
options, then the current effect provenance. The final fallback fixes hand-written
event attacks and assets discarded as a cost, without changing the rules' source
argument. A missing browser style still falls back to the default strike.

`web/themed-attack-fx.js` builds flame jets, projectile trajectories, animal lunges,
constricting cords, sound waves, arcane blade layers and spell motifs. Profiles
select geometry and audio, with no card-number checks in the browser. Shapes are
native CSS/DOM; the existing renderer owns phase timing, mute, fast mode, reduced
motion, cancellation, cleanup and sequence deduplication. Captions remain readable
when motion is reduced. Misses use off-target geometry and retain miss captions.

Flamethrower allocation is special because damage choices can pause/resume:

- Successful focus damage publishes its ordinary attack cue after the focus
  choice, using the final damage amount and a pre-placement snapshot.
- Spread damage publishes themed `directDamage` only for positive accepted
  placements. It does not show a speculative attack against the initial target.
- Adjacent placements from the same source/actor/location combine per enemy in
  the client. Checkpoints and other scenes end the group. A stopped allocation
  has no extra hit, and already presented targets are not replayed on resume.

For accepted placement feedback, the optional engine `damageEnemy` presentation
hint supports `{code, assetId, style}`. Styles are allowlisted by the pure theme
profiles. The hint does not affect rule provenance or immunity checks.

New sampled audio comes from Kenney CC0 packs. Exact originals, SHA-256 hashes,
local license files and any processing are recorded in
`web/audio/themed-attack-sources.json` and `web/audio/SOURCES.md`. The fire sample
is trimmed and faded to match a short jet; audio never downloads at runtime.

Tests: `themed-attacks.test.mjs` executes every P1 source's attack descriptor for
success/failure, normal event/bottle paths, non-attack alternatives and actual fire
allocation. `attack-animation.browser.mjs` checks all public themes at desktop and
mobile sizes, misses, sampled audio, reduced motion and mute.
`combat-presentation.browser.mjs` checks real-table target anchors and captions.
