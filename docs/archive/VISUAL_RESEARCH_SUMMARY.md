# VISUAL_RESEARCH_SUMMARY

Pakistan — The Story We Inherited · visual archive v1 · 3 October 2026

## What is here
- **267 catalogued images** across the 56 storyboard beats (storyline unchanged), each with source page, creator, date, licence, licence status, authenticity class, quality and recommended use.
- Licence status: 198 clear · 39 likely clear (stated public domain by age — fine for a Pakistani competition, verify before wider publication) · 30 VERIFY BEFORE PUBLIC USE.
- By type: A — HERO: 45, B — ARCHIVE: 112, C — NEWSPAPER: 5, D — DOCUMENT: 11, E — CONTEXT: 71, F — MAP: 21, G — TEXTURE: 2
- Contact sheets: `research/contact_sheets/*.jpg` (captioned) and `*.html` (open in a browser; click a thumbnail for its source page).

## What the ZIP contains — read this first
- **27 full-resolution image files** (files that were already in the project: Internet Archive/Photo Division, NASA, DVIDS, White House, Truman Library).
- **240 low-resolution PREVIEWS** (~190 px screen captures from the browser) in each folder's `previews/` subfolder, named `*__PREVIEW_lowres.jpg`. They are for selecting images only — NOT publication files.
- The full-resolution originals of those 240 could not be downloaded in this session: the organisation's network allowlist blocks Wikimedia and the other image archives (cloud workspace and the computer's Claude sandbox). Nothing was bypassed. Each manifest row has `download_url` (direct link to a web-safe size) and `source_url` (file page with licence) — open either in any browser and save the file under the given `filename` into the given `folder`.
- Column `zip_contents` in MASTER_IMAGE_MANIFEST.csv says exactly which you have for each asset.

## Hero coverage
- Beats with a hero candidate: 44 of 56.
- Beats without a clear hero: E12 Mangla Dam Construction (1965), E15 Tarbela Dam Construction (1968), E18 East Pakistan Becomes Bangladesh (1971), E24 Hockey World Cup Champions (1978), E26 Pakistan Steel Mills (1981), E27 Hockey World Cup Champions (1982), E28 Olympic Hockey Gold (1984), E34 Hockey World Cup + Champions Trophy (1994), E42 CPEC Begins (2013), E46 M-4 Faisalabad–Khanewal Motorway (2017), E48 CPEC Optical-Fiber Link (2018), E54 New Gwadar International Airport (2024)
- Beats with no free image at all: E24 Hockey World Cup Champions (1978), E27 Hockey World Cup Champions (1982), E28 Olympic Hockey Gold (1984), E48 CPEC Optical-Fiber Link (2018)

## Strongest material (quick picks)
- 1947: Jinnah addressing the Constituent Assembly 14 Aug 1947; Dawn 15 Aug 1947 ('MAY PAKISTAN PROSPER ALWAYS'); IWM Mountbatten–Jinnah; CIA 1947 Muslim-distribution map.
- Migration: Punjab refugee trains; Photo Division refugee-camp series (India side — caption as two-way migration); Kahuta aftermath (no people).
- 1948: official Jinnah portrait; family at the funeral; Jakarta prayers for Jinnah (international mourning).
- 1950s–60s: NARA Truman–Liaquat (3000 px); 1956 Constitution cover; JFK Library Ayub Khan series; NASA 1963 orbital Indus.
- 1971 hockey: Anefo CC0, 31 Oct 1971 — the World Cup trophy in Amsterdam (hero).
- 1980s–90s: Reagan Library Zia / Junejo; USAF Benazir Bhutto 1989; Imran Khan & Nawaz Sharif with the 1992 trophy (VERIFY).
- 2005 / 2010 / 2022: US Navy & DFID documentary images — aftermath, relief and rebuilding, no casualties.
- 2024: Arshad Nadeem on the Paris podium (CC BY 4.0).
- 2026: Mehr News Agency photos of the Islamabad Talks venue and PM Shehbaz Sharif with Speaker Ghalibaf (11 Apr 2026, CC BY 4.0, watermarked); White House photo of the MoU signing (17 Jun 2026); VP Vance with PM Shehbaz Sharif and FM Asim Munir (22 Jun 2026).

## Reconstructions, stand-ins and artwork (labelled in the manifest)
- `1947_army_museum_migrant_train_diorama.jpg` — RECONSTRUCTION — NOT AN ORIGINAL HISTORICAL PHOTOGRAPH (museum diorama)
- `1947_couple_migrating_with_cattle.jpg` — RECONSTRUCTION — NOT AN ORIGINAL HISTORICAL PHOTOGRAPH (museum diorama)
- `1961_nike_cajun_rocket_wallops_1959.jpg` — STAND-IN (same rocket type, not the Rehbar-I launch)
- `1961_nike_cajun_rocket_wallops_1959_b.jpg` — STAND-IN (same rocket type, not the Rehbar-I launch)
- `1971_refugees_sculpture_liberation_war_museum.jpg` — ARTWORK / RECONSTRUCTION — NOT AN ORIGINAL HISTORICAL PHOTOGRAPH
- `1988_c130_hercules_museum.jpg` — STAND-IN (same aircraft type, not the crashed aircraft)
- `2017_m3_faisalabad_pindi_bhattian_bridge.jpg` — STAND-IN (Faisalabad motorway link, NOT M-4)

## Sensitive imagery decisions
- No corpses, injuries or gore were collected. One Commons file of the 1947 Rawalpindi massacres (skeletal remains) and the 1946 Calcutta 'vultures and corpses' photo were deliberately excluded; DVIDS 1729604 (injured child) stays excluded.
- APS 2014: school exterior, vigils and remembrance only. Benazir Bhutto 2007: memorials and mausoleum. 1971: documents plus images from both sides with neutral captions.
- Red-heavy false-colour satellite images and red COVID maps are marked for regrading or small use.

## Palette fit
- Black-and-white archive (1947–1975) sits well on Warm Ivory / Antique Paper; give it a slight warm tone rather than pure grey.
- Modern colour photos flagged: flag-heavy candle shot (Indep-pak, not 1947), red mural at Liaquat Bagh, Copernicus false colour — avoid as heroes.
- Mehr News photos carry a watermark bottom-left; crop or keep small.

## Before publishing — checklist
- Clear every `VERIFY BEFORE PUBLIC USE` item or swap it (filter the CSV on `license_status`). The two Margaret Bourke-White photos and the AFP-credited Edhi photo should not be published without permission.
- Keep attribution lines for every CC BY / CC BY-SA / FAL / GFDL / OGL / GODL item (column `attribution_required`).
- Use the `historical_authenticity` column in captions: never caption a diorama, stand-in or modern photo as a period photograph.
- Date and place of the 2026 items: Mehr photos 11 Apr 2026; MoU signature 17 Jun 2026 (White House); Lucerne meeting 22 Jun 2026.
