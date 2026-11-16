# Know it

**Learn something extraordinary about the ordinary.** Swap your next scroll for a snap. Point your webcam at (or upload a photo of) any everyday object and Nimbus the cloud tells you its secrets.

Bay Valley Hacks · Theme: *Elevate the Ordinary*

**Know it is a desktop web app.** It runs in any modern desktop browser (Chrome, Edge, Firefox, Safari) with a webcam or a folder of photos. It is built for mouse and keyboard, and has no phone layout.

Live: https://knowitapp.vercel.app

## Features
- **Facts:** snap with your webcam or upload a photo. The AI outlines the object (click the right one if it is unsure), shows 5–10 fresh facts (never repeating facts you have already seen), then a quick A/B/C quiz. Photos of people get fun, respectful facts about the clothing and surroundings. A "Wrong object?" button lets you correct the AI.
- **Bulletin Board:** every object becomes a handwritten sticky note with an AI nickname, pinned to a cork board. Scroll to zoom, drag the cork to pan, drag notes to move them, drag to the trash to unpin (with undo), double-click a note to open its photo and facts, rename notes, and share a note as an image card.
- **Hunt:** a timed scavenger game. Find the object before the timer runs out; each find is harder and faster (60 s shrinking 8% per round, 15 s floor). 3 lives. Tiers: Ordinary, Remarkable, Legendary, Mythic. Timer pauses while the AI checks your photo.
- **Leaderboard:** username and password accounts (usernames are checked by Gemini for anything inappropriate), Hunt scores ranked with gold, silver and bronze icons.
- **Progress:** XP and brain levels with a level-up animation, daily streaks (click the flame for details), collection badges by category, a welcome-back card.
- **Nimbus:** the cloud mascot gives AI compliments, runs the tutorial and reacts to what you do.
- **Cloud sync:** sign in with Google to keep notes, photos, XP, streak and settings safe and share them between computers.
- **Settings:** light, dark or auto theme; music volume; sound effects; reduce motion; text size; language for facts, Hunt and compliments; high contrast; fact style (kid, normal, nerdy); Hunt starting difficulty; backup and restore; replay tutorial; reset progress.
- Looping music per screen (Home: Via Portugal, Facts: Joyful Ride, Hunt: Courage, Board: Fresh Story) with crossfades. Only one open tab plays music at a time. Music starts on your first click or key press.
- Installable from the browser as a desktop app, works offline for screens you have already opened, and updates itself with a "new version" banner.

## What changed in the desktop-only version
- Removed the "Phone or Computer" start menu and the Device setting. The app is always the desktop layout.
- Removed every phone-only feature: vibration (and its setting), flip camera, "Open phone camera", the iPhone volume note, the phone audio player, the portrait lock, iOS home-screen metadata and all phone-only CSS.
- Home buttons are always three tall tiles in a row; the app sits in a centered column up to 900 px wide with full-window backgrounds.
- Webcam and file upload only. Copy now says click, scroll and computer instead of tap, pinch and phone.
- Hunt music changed to Courage.
- Fixed Nimbus: highlights no longer spill over the outline, and it scales to fit its column.

## Run it
```bash
cp .env.example .env.local   # put your Gemini API key in GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```
In a Claude Code cloud session the key is injected by the network proxy: set `GEMINI_API_KEY=proxy-injected` in `.env.local` and run `npm run dev:cloud` (Node's fetch needs `NODE_USE_ENV_PROXY=1` to use the proxy).

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## Environment variables
| Name | Needed | What for |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | All AI features |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | for a shared leaderboard | Accounts and scores. Vercel adds them when you connect Upstash |
| `NEXT_PUBLIC_FIREBASE_*` | optional | Use your own Firebase project for cloud sync |

## Leaderboard setup (Vercel)
Accounts and the Hunt leaderboard need a small database so every player sees the same scores.
1. In Vercel, open your project, then **Storage**, then **Create Database**, then **Upstash** (Redis, free plan).
2. Connect it to this project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. **Redeploy.** Without this step the leaderboard still runs, but only in a temporary test mode that is not shared or kept.

Passwords are hashed with scrypt, sign-in sessions are stored as SHA-256 hashes (6 per account), and an account is locked for 10 minutes after 6 wrong passwords. Accounts made before passwords existed can add one in Settings, Account.

## Cloud sync (Firebase)
Sign in with Google in Settings, then Cloud sync. Notes (with photos), XP, streak, settings and the leaderboard account are saved to Firestore (`users/{uid}` and `users/{uid}/notes/{id}`). Firebase web config is public by design; the Firestore security rules (each user can only read and write their own `users/{uid}` data) are what protect it. Progress only ever merges forward, so signing in on a second computer never loses anything.

## Deploy (Vercel)
1. Import the repo (the app is at the repo root, so leave **Root Directory** empty).
2. Add `GEMINI_API_KEY` with your real key, and connect Upstash (see above).
3. Deploy and open the HTTPS link on your computer (the webcam needs HTTPS). Pushes to `main` deploy automatically.

## Tech
Next.js 16, React 19, Tailwind 4, GSAP, Firebase (Auth and Firestore, loaded on demand), Upstash Redis. Gemini (`gemini-3.5-flash` for facts, `gemini-3.5-flash-lite` for detection, Hunt, moderation and compliments) via the OpenAI-compatible endpoint. Photos and notes are stored on the computer (IndexedDB and localStorage) and optionally synced.

## Credits
Built with Claude Code · AI by Gemini. Music via Storyblocks (Via Portugal, Joyful Ride, Courage, Fresh Story). Fonts: Shrikhand, Sour Gummy, Caveat (SIL OFL). Sound effects are synthesized in code.

## Judging criteria
Creativity and Originality · Technical Difficulty · Functionality · UI/UX · Theme Relevance · Presentation and Pitch
