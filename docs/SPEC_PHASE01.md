# PAKISTAN — THE STORY WE INHERITED

## FRONTEND PRODUCTION SPECIFICATION

### PHASE 01 — 1947 CINEMATIC VERTICAL SLICE

You are now implementing the first production prototype of an interactive historical documentary website.

This specification is based on the approved 1947 cinematic storyboard.

DO NOT redesign the concept.

DO NOT reinterpret the story.

DO NOT turn this into a conventional website.

Your responsibility is to translate the approved cinematic direction into a technically excellent frontend experience.

The backend/data layer will be handled by another developer.

============================================================
01. CORE EXPERIENCE
===================

The website is an interactive cinematic documentary about Pakistan's history.

The primary interaction is scrolling.

The visitor does not navigate from webpage section to webpage section.

Instead:

SCROLL
→ CAMERA MOVES
→ ENVIRONMENT TRANSFORMS
→ HISTORICAL MATERIAL APPEARS
→ TIME ADVANCES
→ STORY PROGRESSES

The first prototype covers:

1947
↓
PARTITION
↓
MIGRATION
↓
PROTAGONIST
↓
TRAIN
↓
DEPARTURE
↓
PAKISTAN IS BORN
↓
1947 → 1948

This is a vertical slice.

Do NOT build the complete 1947–2026 timeline yet.

============================================================
02. DESIGN PRINCIPLE
====================

The central visual metaphor is:

PAPER → MAP → MEMORY → WORLD → JOURNEY → TIME

The approved creative principle is:

"Paper becomes the world.
The world becomes paper.
Scrolling becomes time."

The technology must remain subordinate to the story.

This must NOT look like:

* a Three.js experiment
* a WebGL demo
* a history textbook
* a slideshow
* a timeline dashboard
* a SaaS website
* a generic interactive landing page

It should feel like an interactive documentary.

============================================================
03. VISUAL SYSTEM
=================

Primary palette:

PORCELAIN IVORY
#F5F1E8

AGED PARCHMENT
#E8DDCA

SANDSTONE
#D4C5AD

ANTIQUE TAUPE
#B8A88F

HERITAGE OLIVE
#3E604F

FADED SAGE
#8FA294

SOFT WHITE
#FCFAF5

WARM CHARCOAL
#3C3B36

AGED BRASS
#A88B57

The opening should be predominantly warm ivory/parchment.

Olive and brass are accents.

Do NOT introduce:

* neon
* purple
* cyberpunk colors
* bright red as a major visual
* pure black as the dominant background
* glassmorphism

The visual world should feel tactile and physical.

Think:

paper
ink
dust
photographs
maps
railway
aged documents
sunlight
metal
fabric
wood

============================================================
04. TYPOGRAPHY
==============

DISPLAY:

Cormorant Garamond

BODY/UI:

Inter

TECHNICAL METADATA:

JetBrains Mono

Typography must feel editorial.

The year is the dominant typographic element.

Avoid excessive text.

The main cinematic layer should generally contain:

YEAR
EVENT TITLE
ONE SHORT CONTEXTUAL LINE

Detailed historical information belongs in the archive layer.

============================================================
05. GLOBAL PAGE ARCHITECTURE
============================

Build the experience around a centralized cinematic controller.

Conceptually:

APP
│
├── CinematicController
│
├── SceneManager
│
├── CameraController
│
├── TimelineController
│
├── YearIndicator
│
├── ArchiveController
│
├── AudioController
│
└── AssetManager

The exact component architecture is your implementation decision, but maintain clear separation of responsibilities.

Do not create one enormous React component.

============================================================
06. CINEMATIC PROGRESS
======================

Create ONE normalized cinematic progress value:

0.0 → 1.0

This value controls the entire opening.

Approximate progression:

0.00–0.10
Opening / paper

0.10–0.22
Map emergence

0.22–0.38
Partition

0.38–0.52
Migration

0.52–0.65
Protagonist

0.65–0.78
Train

0.78–0.90
Departure

0.90–0.97
Pakistan is born

0.97–1.00
Transition toward 1948

These values are guidelines, not rigid timestamps.

The user should be able to scroll backward naturally.

Do not create separate scroll systems for every scene.

============================================================
07. SCENE 01 — THE PAPER
========================

STATE:

The screen begins almost empty.

Visual:

warm ivory/paper field.

Subtle paper grain.

Extremely subtle imperfections.

No navbar.

No cards.

No conventional hero.

No large explanatory paragraph.

The first visual event is the year:

1947

The year should feel physically embedded into the material.

Use:

* subtle embossing
* directional light
* soft shadow
* extremely restrained texture

As scrolling begins, light moves across the surface.

The paper should begin feeling dimensional.

PURPOSE:

Establish:

TIME
MATERIAL
QUIET
ANTICIPATION

============================================================
08. SCENE 02 — PAPER BECOMES MAP
================================

The camera begins pulling away.

The paper surface gradually becomes a historical map.

The transformation must feel continuous.

Do NOT simply crossfade:

paper opacity 0
map opacity 1

Instead create a visual transformation.

Potential techniques:

* texture displacement
* masked transition
* shader reveal
* layered planes
* SVG/map geometry
* subtle camera movement

Use the real historical map asset if available.

The map must be historically appropriate.

The camera should establish geographical scale without feeling like Google Maps.

============================================================
09. SCENE 03 — PARTITION
========================

Partition boundaries gradually emerge.

The boundary should appear as ink/linework rather than a modern UI line.

As the boundary develops:

* paper texture changes
* ink spreads
* map fragments shift
* archival material begins appearing

Introduce historical photographs and documents only if authentic assets are available.

Each archival asset must retain metadata for:

source
date
title
type
license/usage information where available

Do not fabricate historical photographs.

============================================================
10. SCENE 04 — MIGRATION
========================

The map begins transitioning into the human-scale world.

The atmosphere becomes more active.

Potential visual elements:

* railway station
* crowds
* luggage
* paper documents
* train
* dust
* smoke
* photographs
* newspaper fragments

Do NOT show graphic violence.

Do NOT create sensationalized tragedy.

The emotion should come from:

scale
movement
uncertainty
departure
silence
human detail

============================================================
11. SCENE 05 — PROTAGONIST
==========================

Introduce the fictional/composite civilian.

This person represents ordinary people experiencing Partition.

The person is NOT a documented historical figure.

Do not make the protagonist appear to be a famous person.

Preferred visual language:

* hands
* luggage
* silhouette
* back
* reflection
* POV
* over-the-shoulder

Avoid a detailed hero character model unless technically justified.

The audience should be able to project themselves onto this person.

The protagonist should feel human, not like a game character.

============================================================
12. SCENE 06 — TRAIN
====================

The protagonist reaches a train.

This is the major physical transition.

The camera follows the protagonist.

The train should feel grounded and historically plausible.

Use:

* platform
* train exterior
* door
* luggage
* interior
* window
* passengers as non-specific silhouettes

The camera enters the train.

The window becomes the primary visual frame.

This creates the bridge between:

PHYSICAL JOURNEY
and
HISTORICAL JOURNEY

============================================================
13. SCENE 07 — DEPARTURE
========================

The train begins moving.

The environment passes outside.

The camera should remain controlled and smooth.

The train movement is tied to cinematic progress.

The user scrolls.

The train moves.

The world changes.

This is the first explicit demonstration that:

SCROLL = TIME

Do NOT make the scroll feel like a video player.

The user is controlling progression.

============================================================
14. SCENE 08 — PAKISTAN IS BORN
===============================

The visual intensity decreases.

The environment settles.

Introduce:

14 AUGUST 1947

PAKISTAN IS BORN

Typography remains restrained.

Do not use giant patriotic graphics.

Do not use excessive flags.

Do not turn the scene into a poster.

The historical significance should come from:

composition
silence
light
scale
timing

============================================================
15. SCENE 09 — YEAR SYSTEM
==========================

Create the permanent year indicator.

Initially:

1947

As the user progresses toward the next event:

1947
→
1948

The transition should be elegant.

Possible implementation:

mechanical type-wheel / rolling number transition.

The year should feel like an object in the world, not a normal navbar element.

The system must later support arbitrary years.

============================================================
16. SCENE 10 — TRANSITION
=========================

The final portion of the vertical slice should prepare the visitor for 1948.

Do not suddenly end the scene.

Create a visual transition using one of the established motifs:

* train window
* paper
* map
* photograph
* passing landscape
* light
* archival material

The visitor should feel:

"We are continuing."

NOT:

"The landing page ended."

============================================================
17. ARCHIVAL ASSET SYSTEM
=========================

Create a reusable asset structure.

Example:

{
id,
type,
title,
year,
source,
url,
license,
description,
localPath
}

Supported types:

photograph
newspaper
document
map
letter
ticket
stamp

The backend developer will later replace mock/local data with API data.

Therefore:

KEEP THE CINEMATIC ENGINE INDEPENDENT FROM THE DATA SOURCE.

============================================================
18. ARCHIVE UI
==============

Create a minimal archive trigger.

Example:

EXPLORE ARCHIVE

When activated, open a sophisticated overlay/drawer.

Categories:

PHOTOGRAPHS
NEWSPAPERS
DOCUMENTS
MAPS
SOURCES

The archive should feel like part of the documentary.

It should NOT look like a generic modal.

The main cinematic scene should remain the dominant experience.

============================================================
19. UI
======

Keep interface extremely minimal.

Potential persistent controls:

YEAR
TIMELINE
ARCHIVE
SOUND

Do not build a traditional navigation bar.

Do not put:

HOME
ABOUT
SERVICES
CONTACT

across the top.

This is an experience, not a corporate website.

============================================================
20. CAMERA SYSTEM
=================

Create a reusable camera controller.

Required capabilities:

* position interpolation
* rotation interpolation
* focal target
* scene transitions
* smooth progress response
* reverse scrolling

Avoid abrupt movement.

Avoid constant camera rotation.

Avoid camera shake.

Every camera movement should have narrative purpose.

============================================================
21. TRANSITION SYSTEM
=====================

Create reusable transition primitives.

Examples:

paperReveal
inkSpread
mapToWorld
imageReveal
cameraPush
cameraPull
fadeToPaper
yearRoll
environmentMorph

Do not implement every transition as a completely separate custom system.

The rest of the documentary will reuse these.

============================================================
22. PERFORMANCE
===============

Performance is a competition requirement.

Target smooth interaction.

Implement:

* lazy asset loading
* compressed textures
* optimized image sizes
* texture disposal
* GPU-friendly materials
* limited particles
* instancing where appropriate
* centralized animation loop
* efficient scroll listener
* no unnecessary React re-renders

Do not create thousands of DOM nodes.

Do not render huge images at full resolution when unnecessary.

Do not preload the entire future documentary.

Only load assets necessary for the current experience.

============================================================
23. RESPONSIVE BEHAVIOR
=======================

Desktop is the primary competition environment.

For mobile:

* reduce particle counts
* reduce 3D complexity
* reduce texture resolution
* simplify environmental geometry
* preserve the narrative
* preserve the year indicator

Do not create a completely separate experience unless required.

============================================================
24. BACKEND BOUNDARY
====================

Another developer owns:

* database
* API
* event records
* historical metadata
* sources
* asset metadata
* content management

You own:

* frontend
* cinematic engine
* visual system
* UI
* animation
* scene architecture
* camera
* scroll system
* archive presentation

Create interfaces/types/mock data so both systems can connect later.

============================================================
25. DEVELOPMENT RULE
====================

DO NOT build 1947–2026.

DO NOT build dozens of historical scenes.

Complete this vertical slice first.

The final result should be:

OPENING
→ MAP
→ PARTITION
→ MIGRATION
→ PROTAGONIST
→ TRAIN
→ DEPARTURE
→ PAKISTAN IS BORN
→ 1947 → 1948

Only after this slice is tested and approved should the project expand.

============================================================
26. QUALITY BAR
===============

The finished prototype must NOT feel like:

"student made a website about Pakistan."

It should feel like:

"someone built an interactive documentary about Pakistan."

Prioritize:

STORY
then
VISUAL QUALITY
then
INTERACTION
then
TECHNICAL COMPLEXITY

Never reverse those priorities.

A simple transition executed beautifully is better than an advanced effect executed poorly.

============================================================
27. FINAL EXECUTION REQUIREMENT
===============================

Start by inspecting the existing repository.

Do not overwrite useful existing work.

Then implement the 1947 vertical slice.

After implementation:

1. run the application
2. inspect the result
3. test scrolling from beginning to end
4. test reverse scrolling
5. check console errors
6. check WebGL errors
7. check asset loading
8. check performance
9. fix visual issues
10. fix interaction issues
11. ensure the prototype can later connect to the backend

Do not stop after creating static components.

The result must actually be interactive.

The goal is a working cinematic prototype that we can physically show to the team and judge whether the experience is strong enough before scaling it to the complete historical journey.
