# Know it: agreed spec

Theme: Elevate the Ordinary. Mobile-only installable PWA (Next.js). Motto: "Learn something real instead of scrolling."

## AI
- Gemini via the OpenAI-compatible endpoint `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (Bearer auth).
- In cloud sessions the key is injected by the network proxy; code reads `GEMINI_API_KEY` (use `proxy-injected` as a placeholder). On Vercel, set the real key as an env var. Never commit the key.
- Models: `gemini-3.5-flash` for Facts (~4 s), `gemini-3.5-flash-lite` for Hunt checks and compliments (~1 s). Bounding boxes come back as `box_2d: [ymin, xmin, ymax, xmax]` normalized 0–1000.
- Refuse photos of people. Rate-limit the API route. Resize images in the browser before upload.

## Look and feel
- Reference: Akash Jha Dribbble cloud loader (cloud outline fills with wavy white liquid on a pulsing cyan-to-violet radial gradient).
- Fonts: Shrikhand (logo, titles, big numbers), Sour Gummy (UI/body), Caveat (sticky-note handwriting).
- No emojis: custom SVG assets (Nimbus the cloud mascot, pushpin, brain, sticky notes, cork) plus one rounded icon set.
- GSAP + React Bits style micro-animations everywhere. Light (day sky) and dark (night sky with stars) themes.
- Sizes adapt to screen height (clamp/dvh) and respect safe areas.
- Badge: "Built with Claude Code · AI by Gemini".

## Screens
1. Splash: cloud loader animation, "Know it" pops in, "Tap to start" (unlocks audio).
2. Cloud transition between every screen: clouds rise to cover, screen swaps, clouds keep rising to reveal.
3. Home: logo, chat bubble from Nimbus with an AI compliment (fallback list if slow), brain level bar, motto, buttons Facts / Hunt Mode / Bulletin Board, settings gear, badge.
4. Facts: first-visit tutorial in a fun text box (Next/Skip, replayable). Camera-permission explainer, styled live viewfinder, shutter + flash, retake/use, upload fallback.
   - Loading: cloud-fill animation over blurred photo, rotating funny lines, Cancel.
   - If unsure, AI outlines 2–3 candidates and the user taps one.
   - Result: outline draws around the object, name, 5–10 unique facts (never repeats facts already seen for that object). Reveal pacing slow→fast→slow with rising-pitch pops and bounce. XP count-up, one quiz question. Small "AI confidence ~N%" and "This is AI and some facts may be incorrect."
   - Then a sticky note with the AI nickname (handwriting) is pinned to the Bulletin Board (pin-drop placing animation). Tapping a note shows its photo and facts.
   - Buttons: Main Menu / Take Another Picture.
5. Hunt Mode: 3 lives, timer pauses while the AI checks. `time = max(15, round(60 * 0.92^(round-1)))`. Difficulty: broad traits → materials/categories → specific objects → combinations. Game over shows score, best score, what the AI saw. Hunt photos do NOT go on the board.
6. Bulletin Board (Milanote-style): pinch zoom, pan, tap to lift + toolbar (Rename, View facts, Unpin), double-tap note to open facts, long-press drag to move, drag-to-trash zone, Undo toast, fit-all button, double-tap cork to toggle zoom. Positions saved on device.
7. Settings: theme, music volume, SFX toggle, vibration, reduce motion, text size, fact style (kid/normal/nerdy), Hunt starting difficulty, replay tutorial, reset progress, credits. No mute button elsewhere.

## Music (Storyblocks, loop per place, crossfade)
- Home: Upbeat Cheerful Optimistic Jazz
- Facts: Bitsy Spider – Children's Story Background
- Hunt: Comedy Background Detective Cartoon
- Bulletin Board: Jolly Stomping Rhythm
(Check the Storyblocks license allows embedding in a public app.)
