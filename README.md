# Curio

**Learn something extraordinary about the ordinary.** Swap your next scroll for a snap. Snap any everyday object and Nimbus the cloud tells you its secrets.

Bay Valley Hacks · Theme: *Elevate the Ordinary* · Deadline 8:30 pm PST

## Features
- **Facts:** take a photo, the AI outlines the object (you tap which one if it's unsure), then 5–10 fresh facts pop in (never repeats facts you've already seen), plus a quick quiz.
- **Bulletin Board:** every object becomes a sticky note with an AI nickname in handwriting. Tap a note to see its photo and facts; hold and drag to move; drag to the trash zone to unpin (with undo); pinch to zoom; rename notes.
- **Hunt Mode:** find the object before the timer runs out. Each find makes the next challenge harder and faster (60 s shrinking 8% per level, 15 s floor). 3 lives, high score.
- AI compliment from Nimbus, brain levels and XP, cloud transitions, sound effects, looping music per screen, light/dark mode, settings.
- Installable mobile PWA.

## Run it
```bash
cp .env.example .env.local   # put your Gemini API key in GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```
In a Claude Code cloud session, the key is injected by the network proxy: set `GEMINI_API_KEY=proxy-injected` in `.env.local` and run `npm run dev:cloud` (Node's fetch needs `NODE_USE_ENV_PROXY=1` to use the proxy).

## Deploy (Vercel)
1. Import the repo (the app is at the repo root, so leave **Root Directory** empty).
2. Add the environment variable `GEMINI_API_KEY` with your real key.
3. Deploy, then open the HTTPS link on your phone (the camera needs HTTPS) and use "Add to Home Screen".

## Tech
Next.js 16, React 19, Tailwind 4, GSAP, Gemini (`gemini-3.5-flash` for facts, `gemini-3.5-flash-lite` for detection, Hunt and compliments) via the OpenAI-compatible endpoint. Photos and notes are stored on the device (IndexedDB + localStorage).

## Credits
Built with Claude Code · AI by Gemini. Music via Storyblocks (Via Portugal, Joyful Ride, Comedy Background Detective, Fresh Story). Fonts: Shrikhand, Sour Gummy, Caveat (SIL OFL). Sound effects are synthesized in code.

## Judging criteria
Creativity and Originality · Technical Difficulty · Functionality · UI/UX · Theme Relevance · Presentation and Pitch
