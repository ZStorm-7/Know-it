# Bay Valley Hacks Project

Deadline: 8:30 pm PST (11:30 pm ET)
Theme: **Elevate the Ordinary**

## Judging criteria
- Creativity and Originality
- Technical Difficulty
- Functionality
- UI/UX
- Theme Relevance
- Presentation and Pitch

## Idea
_TBD_

## Setup
```bash
cd app
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```
Claude API route: `POST /api/claude` with `{prompt, system?}` -> `{text}`.
