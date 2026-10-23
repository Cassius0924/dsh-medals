---
name: DSH Medals
description: A quiet gallery for collectible metal-and-enamel achievements.
colors:
  gallery: "#ffffff"
  ink: "#111111"
  action: "#1677ff"
  surface: "#f7f8fa"
  muted: "#6b7280"
  line: "#d9dee7"
  chamber: "#14191e"
  chamber-inset: "#1c232a"
  chamber-text: "#f4f3ee"
  chamber-muted: "#a8b0b8"
  gold: "#e4c88d"
  enamel-raspberry: "#a21649"
  enamel-teal: "#075b5d"
  enamel-plum: "#482340"
  enamel-consistency-blue: "#214e7d"
  enamel-evergreen: "#164b3c"
  jade-leaf: "#65a889"
  medal-silver: "#bdc5ce"
  medal-silver-polished: "#edf0f5"
  medal-gold: "#c6a05b"
  medal-gold-polished: "#f3d18c"
  sculptural-gold: "#deb976"
  sculptural-gold-polished: "#ffe8b5"
  pearl-enamel: "#eee6d4"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-1px"
  object-title:
    fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  medal-numeral:
    fontFamily: "Baskervville, serif"
    fontWeight: 500
  body:
    fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
  metadata:
    fontFamily: "system-ui, -apple-system, Inter, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
rounded:
  tag: "4px"
  surface: "8px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "16px"
  s4: "24px"
  s5: "32px"
  s6: "48px"
  s7: "64px"
components:
  button-outline:
    backgroundColor: "{colors.gallery}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "8px 16px"
  filter-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "4px 12px"
  medal-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
  viewing-chamber:
    backgroundColor: "{colors.chamber}"
    textColor: "{colors.chamber-text}"
    rounded: "{rounded.surface}"
---

# Design System: DSH Medals

## Overview

**Creative North Star: "The Personal Collection"**

White gallery space makes the objects, not the interface, the subject. Dark viewing chambers isolate reflective metal and enamel so a medal reads as a collectible physical object.

Ordinary achievements use the 珐琅圆章 family: complete raised serif numerals on shallow convex enamel fields, with distinct perimeter shapes and metal finishes for each series. Rarer achievements gain layered silhouettes, intricate metalwork and richer material effects. The perfect-month piece is an eight-petal gold and pearl rosette with individually framed petals, a ridged gold inner starburst and a central crystal setting.

Usage, growth and lifetime achievements also use named sculptural motifs: orbital structures, moon relief, ascending folds, radiating dawn, stepped milestones and a three-dimensional infinity loop. Each sculptural challenge uses its own motif, silhouette and internal linework. These are collection objects rather than numerical discs. When available, an earned sculptural piece leads the featured stage.

**Key Characteristics:**

- Quiet white collection space; concentrated dark object viewing.
- Real reflective depth and front/back exploration after unlocking.
- Sparse controls, fine borders and gently curved surfaces.
- Complexity grows with achievement difficulty.

## Colors

Neutral interface colors frame saturated enamel instead of competing with it.

### Primary

- **Action Blue:** focus outlines and challenge progress, not a decorative gallery wash.

### Secondary

- **Collection Gold:** reveal emphasis and small collection accents in dark chambers.
- **Raspberry / Teal / Plum / Consistency Blue enamel:** daily circular medals, weekly hexagons, monthly scalloped medals and lifetime consistency octagons respectively. These are object-material base colors; lighting, reflections and the guilloche texture modulate their rendered appearance.
- **Medal Silver / Medal Silver Polished:** the shared satin and highlight material colors for daily silver and weekly platinum finishes.
- **Medal Gold / Medal Gold Polished:** the satin and highlight material colors for monthly and lifetime consistency numeric medals.
- **Sculptural Gold / Sculptural Gold Polished / Pearl Enamel:** layered rosette settings and pearl-white petals; the sculptural gold pair is also shared by other handcrafted motifs. The petal settings and ray bases use darker gold channels derived from the sculptural metal color by a linear-color multiplier of (.58). The central crystal uses a separate pale reflective material.

Object materials and interface colors have separate roles. Collection Gold is a flat UI accent; the medal golds belong to illuminated geometry. The numeric material palette is defined by the renderer; pearl petals use a dedicated iridescent, clearcoated material.

### Neutral

- **Gallery White / Ink:** collection background, headings and selected tabs.
- **Quiet Surface / Muted / Line:** display trays, secondary information and separators.
- **Chamber / Chamber Inset / Chamber Text / Chamber Muted:** object stages, recessed requirements, bright titles and supporting details.

**The Object Owns Color Rule.** Keep interface surfaces neutral; numeric series identity belongs to raspberry daily, teal weekly, plum monthly and blue lifetime consistency enamel. Preserve each sculptural motif’s own material palette.

## Typography

The interface uses the platform UI sans stack. Readable Chinese labels and tabular numerical progress take priority over expressive display typography. Medal lettering uses Baskervville lining numeral outlines at weight (500), built into physical relief geometry; this type role belongs to the collectible.

### Hierarchy

- **Headline:** the page title uses the frontmatter headline role; it steps down to (28px) on narrow screens.
- **Object title:** latest-object titles use the object-title role, stepping to (32px) and then (28px) as space narrows. Detail titles use (32px), weight (500), line-height (1.3), then (28px) on mobile.
- **Title:** collection sections use (18px), weight (600); challenge names use (18px), weight (600), then (16px) on smaller screens.
- **Body:** the base role is (16px); descriptions use (13–14px), with relaxed (1.8) line-height in chambers and rules.
- **Label / metadata:** ordinary controls use (14px); contextual information uses (11–12px). Progress values use tabular numerals; record identifiers use monospace.
- **Medal numeral:** complete Baskervville lining glyphs keep their serif forms and counters. One- and multiple-digit numbers are fitted proportionally to the field. Daily amounts place a separate, smaller M below the number.

**The Complete Lettering Rule.** Keep each numeral a complete independent raised form, preserving its counters and its separation from the perimeter. Use the same glyph outlines in the locked drawing.

## Layout

The DSH shell owns global navigation. The gallery fills its panel; do not recreate a second application sidebar from unused stylesheet selectors.

The content container caps at (1600px). Default padding is (32px 40px 24px), widening to (32px 48px) from (1440px), reducing to (24px) at (1100px), and to (24px 16px 16px) at (479px). Repeated spacing follows the frontmatter scale.

Collection trays use six equal columns with (16px) gaps, three columns at (1100px), and two at (479px). Filters wrap instead of forcing horizontal overflow. The latest-object chamber splits text and art in a (.9 / 1.1) proportion; narrow phones place the object above centered copy. Detail viewing splits art and records (1.2 / 1), becoming one column at (767px). Challenge rows use a (72px) art column, (12px 16px) padding and (8px) inter-row gaps. Titles and progress values share a heading row. On narrow screens, artwork shrinks to (56px), then (40px); the icon-only detail action retains a (44px) touch target. Text wraps without clipping. Period controls wrap and fill the available row on narrow phones.

**The Host Owns Navigation Rule.** Local tabs switch collection and challenges; DSH navigation stays outside the plugin.

## Elevation & Depth

Gallery structure is mostly flat: fine borders, pale trays and whitespace. Depth belongs to the collectible and its isolated chamber. Radial stage lighting, actual beveled geometry, environment reflections and soft cast shadows communicate material; the interface does not imitate that richness on every control.

The studio uses a lifted neutral reflection floor, a broad frontal softbox, directional front fill and hemispheric bounce. Narrow warm/cool softboxes retain directional highlights. Shared satin/polished metals include a small diffuse component so sculptural relief stays readable across viewing angles; lighting changes apply to the rendered fallback assets too. Reverse engraving uses a rougher, partially metallic finish with reduced environment response, preserving the dark cut lettering under the brighter studio. A diffuse cut-lettering layer follows the curved reverse surface, so the engraved glyphs retain contrast while the surrounding gold reflects the studio.

The 100-day evergreen edition uses a rounded gold shield, forest-green enamel, a beveled trunk, branching gold stems and individually faceted jade leaves. Its botanical front and engraved reverse use words and motifs; achievement counts and record identifiers remain in the gallery metadata. Locked artwork shares the branch, leaf, trunk and case contours.

Numeric enamel is a shallow convex mesh with computed normals, a series-specific guilloche color map, engine-turned bump detail and clearcoat. The physical field rises beneath separately extruded, beveled metal lettering. Satin cases, polished rims and darker recesses define the edge. Weekly corner studs are raised faceted metal diamonds. These finishes respond to actual 3D lighting.

The rosette builds depth through offset gold under-petals, eight narrow pearl-white raised petal faces and separately extruded gold settings. Darker gold channels separate each pearl face from its polished frame. Sixteen individually beveled gold rays carry raised polished ridges around the central setting. Its faceted central crystal sits in a ring with eight gold bead settings. Locked numeral and rosette linework erase occluded strokes beneath the foreground forms, retaining transparent interiors against both pale trays and dark chambers.

- **Object tray shadow:** `drop-shadow(0 8px 6px #11111114)` beneath unlocked card art.
- **Stage object shadow:** `drop-shadow(0 24px 16px #00000066)` in the latest-object chamber.
- **Dialog lift:** `0 24px 80px #00000055`, with a dark translucent backdrop and (8px) blur.
- **Feedback lift:** `0 8px 32px #11111112` for transient toast feedback.

**The Earned Depth Rule.** Locked objects remain line-only drawings: no material disclosure, 3D context, reverse view or rotation. Full depth and finish begin at unlock.

## Shapes

The recurring surface radius is the frontmatter surface radius; badges, segmented selections and filters use the smaller tag radius. Borders are usually (1px). Standard action targets are at least (44px) high, with a few compact mobile controls at (40px).

Numeric silhouettes identify the series: daily circles, weekly gently rounded hexagons with six diamond studs, monthly ten-lobed scalloped medallions and lifetime consistency octagons. Each has a beveled metal case, nested perimeter rims and a complete raised numeral above the enamel field.

The perfect-month rosette has eight narrow, individually framed pearl petals over eight offset gold under-petals. Extruded petal settings, a raised sixteen-ray starburst with a ridge on every ray, and the central crystal/bead setting remain visually distinct tiers. Other sculptural challenges keep their individual silhouettes, including triangular, star-shaped, cushion and twelve-sided cases.

## Components

### Buttons

Quiet outline actions use a thin separator border and the outline component tokens. On hover, white-surface controls take the pale surface color. Chamber controls are transparent with muted light borders and brighten on hover. The reveal’s first action uses collection gold. Keyboard focus uses an action-blue (3px) outline with (4px) offset. Disabled buttons reduce opacity to (.55).

### Tabs and filters

The two local tabs sit above a thin divider; the active tab has darker text, weight (600) and a (2px) underline. Series filters are compact, wrapping labels with pale selected backgrounds. Period selection uses an inset segmented track and a white selected segment with subtle lift.

### Collection trays

Each card places a border-framed pale art surface above its name, series metadata and optional progress. Cards lift by (4px) on hover-capable devices over (200ms ease-out); locked art loses its shadow and uses an outer rim plus the motif’s primary internal strokes. Collection records and progress remain visible without requiring rotation.

### Navigation

The native sidebar selects the gallery’s main-panel registration. The gallery fills the host content box. Entering from a conversation reveals a fixed lower-left return action inside the gallery viewport; its target is captured at entry.

### Viewing chamber

A dark modal pairs a large object with requirement and collection records. The stage provides horizontal drag, keyboard arrow rotation, Home reset and explicit front/back/reset controls for unlocked objects. Full 3D rendering is primary. All 22 earned medal designs have rendered front/back PNG fallback, and static fallback preserves explicit front/back selection. A locked object retains its recognizable motif as a flat line drawing. It does not receive rotation or reverse-view controls.

The Debug style-preview toolbar is a pale, bordered control group below the heading. Its earned/unearned controls switch the full collection’s visual state; pressed controls use white on ink. The heading, card labels and detail copy identify preview state. Exiting preview restores real records.

### Reveal

The reveal uses the same chamber material language, centered object and two actions. Object entrance uses (400ms ease-out), title entrance (300ms ease-out), with opacity and (16px) vertical translation. Reduced-motion preference removes animations, transitions and card lift.

## Do's and Don'ts

### Do:

- **Do** keep the gallery neutral and reserve concentrated color and reflection for the collectible.
- **Do** use complete raised Baskervville lining numerals over convex guilloche enamel for number-led medals.
- **Do** make locked and earned states visibly and interactively distinct.
- **Do** preserve the host’s navigation, responsive grids and keyboard access.
- **Do** respect reduced motion and retain front/back fallback for every earned medal.

### Don't:

- **Don't** expose a locked medal’s finish, back or rotation.
- **Don't** give ordinary numeric achievements the same construction complexity as rare high-tier objects.
- **Don't** turn chamber lighting into a universal background treatment for ordinary forms and lists.
- **Don't** treat unused legacy-sidebar CSS or tiny decorative uppercase captions as new component standards.

## Localization

The gallery follows DSH’s Chinese/English locale, including live panel updates
through a same-origin, source-checked iframe message. Standalone links support
`?lang=zh` and `?lang=en`, with browser-language selection and English fallback.
Challenge conditions wrap naturally; localized dates refer to the same fixed-zone
calendar day and never change earned records.
