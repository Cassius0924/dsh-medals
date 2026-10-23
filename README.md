# DSH Medals

Personal 3D collectible medals for DeepSeek Harness Web. Open **奖牌馆 / Medals** in the native sidebar footer. The collection fills the main content panel, alongside the same navigation as Plugins and Scheduled Tasks. When entered from a conversation, a fixed lower-left button returns to that exact conversation.

The gallery includes **22 progressive challenges**: 10 enamel medallions with raised serif numerals for everyday and consistency achievements, and 12 sculptural challenge editions, each with its own metal/enamel motif. These include 恒星轨道 (weekly 50M), 月面漫游 (monthly 200M), 向上生长 (weekly growth), 破晓之势 (monthly growth), 里程初章 (100M lifetime), and 无尽远行 (500M lifetime). Lifetime consistency uses an evergreen tree and compass; a perfect month uses a layered gold and pearl-white enamel rosette with a central faceted crystal; 1B/5B/10B milestones use a prism, constellation and spiral galaxy. Unlocked medals support true 360° rotation, front/back views, keyboard/touch controls and reduced motion. Locked medals show a non-rotatable line drawing of the case and the motif’s recognizable internal structure. Static earned previews are available without WebGL.

## Challenges

| Series | Tiers |
| --- | --- |
| Daily | 5M, 10M, 20M tokens |
| Weekly consistency | 3, 5, 7 qualified days |
| Monthly consistency | 10, 20, every calendar day |
| Lifetime qualified days | 7, 30, 100, 365 days; not consecutive |
| Lifetime tokens | 100M, 500M, 1B, 5B, 10B |
| Period volume | Weekly 50M, monthly 200M |
| Growth | Weekly +100%, previous ≥5M; monthly +200%, previous ≥20M |

Every user has the same thresholds. A day with at least **5M tokens** is qualified; the three daily medals require **5M / 10M / 20M**. Consistency tracking starts when challenges are enabled. Historical absolute usage and complete growth periods are quietly backfilled.

Daily medals count repeat awards on the same design. Weekly/monthly medals retain dated records; lifetime tiers are earned once. Perfect week/month challenges require a fully observed period, every day qualified, and settle after the period closes. Other day-count thresholds need not be consecutive. Growth also settles only after closure and requires the stated previous-period minimum. Weeks start Monday; the first-install server timezone remains fixed and visible.

All challenges and their earned records appear in one collection. The featured object favors an earned sculptural medal; with none yet earned, it shows the latest earned number-led medal or a locked line drawing.

The **Debug 预览** button opens a read-only style preview. Choose **全部已获得** or **全部未获得** to inspect every medal, including detail views. **退出 Debug** restores real collection state; reloading the page also exits preview. Preview records are explicitly labeled and never saved. Award acknowledgement is unavailable during preview.

## Accounting and storage

Uses the supported `sessionPersistence` service, covering all locally readable DSH sessions, providers and models. This is not an account-wide or cross-device total. Counts provider-reported uncached input, output and cache read/write usage without price weighting. Reasoning is an output subset, not additional usage. Reported exact totals take precedence when consistent; missing optional buckets otherwise contribute zero. Invalid or overflowing usage blocks new awards for that scan.

Attempt/final-message replacements, retry boundaries and fork-inherited prefixes are deduplicated. Per-session daily totals are cached by in-memory opaque revision; every process restart validates the sessions again. Sessions deleted after a successful sync retain their last observed daily totals. Earned medals never disappear. Transient read failures preserve existing medals and pause new awards. Sessions explicitly refused as unsupported by DSH are excluded with a visible notice; previously synced aggregates are retained. No private raw-log bypass is used.

The first complete scan quietly backfills historical awards. Later awards show a sidebar dot and an optional reveal button; opening a conversation never triggers a blocking celebration.

Background polls retain the current collection and focus targets when only the synchronization timestamp changes. Award, usage and challenge changes still update the gallery.

Only session IDs, daily aggregates and award records are persisted, never conversation text. No analytics or external image/CDN requests are made.

Ledger: `$DSH_HOME/storages/dsh-medals/ledger.json`, or `~/.dsh/storages/dsh-medals/ledger.json`. Writes use an exclusive cross-process lock, atomic rename and fsync. Back up this ledger to retain personal collections across reinstallations. A corrupted ledger fails closed and is never automatically replaced. After an unclean shutdown, if a `.lock` remains, check its PID is no longer alive before removing **only that lock file**; do not delete the ledger. A healthy shutdown removes the lock.

## Language and layout

The gallery follows DSH’s Chinese/English language preference, including live
changes while the panel is open. Standalone gallery URLs accept `?lang=zh` or
`?lang=en`; otherwise the browser language is used, with English fallback.
Names, challenge requirements, progress, records, dialogs, sync notices and
accessibility labels are localized. Dates remain calendar dates in the ledger’s
fixed timezone. Language changes do not modify awards or thresholds.

Challenge rows use compact thumbnails, grouped title/progress values and 8px
gaps. Requirements remain fully readable; mobile detail controls retain a 44px
touch target.

## Build / install

```sh
npm ci --ignore-scripts
npm run build
npm test
dsh plugin --profile web add @cassius0924/dsh-medals
# Or install a local checkout:
# dsh plugin --profile web add /absolute/path/to/dsh-medals
```

DSH's HMR applies the new bundle when enabled. Otherwise reload/restart DSH after active work completes. The plugin serves its own UI/API under `/api/dsh-medals/`; its gallery and API use DSH’s authenticated `connection.admit` boundary in addition to same-origin checks. It registers one native sidebar entry and does not modify other plugins. Uninstall with `dsh plugin --profile web remove @cassius0924/dsh-medals`; the ledger remains.

Development-only browser and real-history checks (local Playwright and DSH paths in these scripts match the deployment host):

```sh
node test/gallery.browser.mjs
node test/debug-preview.browser.mjs
node test/real-history.mjs
DSH_TEST_ORIGIN=https://dsh.cassdev.com node test/live-dsh.browser.mjs
```

MIT. Three.js is vendored under its MIT license, included in `lib/THREE-LICENSE`.

The numeric medallions use bundled Baskervville numeral outlines under the SIL Open Font License (see `vendor/numerals/LICENSE`). Their matching earned front/back renderings are shipped for static preview.

## Releases

[GitHub repository](https://github.com/Cassius0924/dsh-medals) ·
[npm package](https://www.npmjs.com/package/@cassius0924/dsh-medals)

GitHub Releases trigger the npm OIDC publishing workflow. See [RELEASING.md](RELEASING.md)
for initial npm registration and Trusted Publisher setup.
