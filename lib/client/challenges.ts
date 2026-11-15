// Hunt challenges. Tier 0 = broad traits, 1 = materials and categories, 2 = specific objects,
// 3 = combinations. THEME challenges lean into "Elevate the Ordinary": everyday things with a job or a story.

const T0 = [
  "Find something round", "Find something red", "Find something blue", "Find something green", "Find something yellow",
  "Find something white", "Find something black", "Find something orange", "Find something purple", "Find something pink",
  "Find something brown", "Find something grey", "Find something square", "Find something rectangular", "Find something long and thin",
  "Find something tiny", "Find something soft", "Find something shiny", "Find something rough", "Find something smooth",
  "Find something that has a pattern", "Find something striped", "Find something with dots", "Find something transparent",
  "Find something with a handle", "Find something with a button", "Find something with a lid", "Find something with a hole in it",
  "Find something you can hold in one hand", "Find something that has numbers on it", "Find something that has letters on it",
  "Find something heavy", "Find something light", "Find something that rolls", "Find something that bends",
];

const T1 = [
  "Find something made of wood", "Find something made of metal", "Find something made of glass", "Find something made of plastic",
  "Find something made of paper", "Find something made of cloth", "Find something made of rubber", "Find something made of leather",
  "Find something made of ceramic", "Find something made of cardboard", "Find something from the kitchen", "Find something from the bathroom",
  "Find something from the bedroom", "Find something you wear", "Find something you write with", "Find something you read",
  "Find something you eat or drink from", "Find something that plugs in", "Find something that runs on batteries", "Find something that opens and closes",
  "Find a plant or something from nature", "Find a tool", "Find a toy or game", "Find something for school or work",
  "Find something that makes a sound", "Find something that gives light", "Find something that keeps things cold or hot", "Find something you carry things in",
  "Find something used for cleaning", "Find something that helps you tell time", "Find a piece of furniture", "Find something that has a screen",
  "Find something that holds liquid", "Find something that hangs", "Find something that stacks",
];

const T2 = [
  "Find a spoon", "Find a fork", "Find a cup", "Find a mug", "Find a plate", "Find a bowl", "Find a bottle", "Find a pencil", "Find a pen",
  "Find a book", "Find a notebook", "Find a key", "Find a sock", "Find a shoe", "Find a hat", "Find a backpack", "Find a remote control",
  "Find a phone", "Find a charger", "Find headphones", "Find a pair of glasses", "Find a clock", "Find a watch", "Find a lamp", "Find a pillow",
  "Find a blanket", "Find a chair", "Find a towel", "Find a toothbrush", "Find a comb or brush", "Find a mirror", "Find scissors", "Find a ruler",
  "Find a stapler", "Find a paper clip", "Find a coin", "Find a wallet", "Find a calculator", "Find a banana or any fruit", "Find a water bottle",
  "Find a door handle", "Find a light switch", "Find a coaster", "Find a spoon rest or ladle", "Find a power strip",
];

const T3 = [
  "Find something soft and white", "Find something round and red", "Find something small and shiny", "Find a metal object smaller than your hand",
  "Find a plastic thing with a lid", "Find a wooden thing you can hold", "Find something striped and soft", "Find something blue and made of cloth",
  "Find something long, thin and made of metal", "Find something round and made of glass", "Find a paper thing with writing on it",
  "Find something square and made of plastic", "Find something green and alive", "Find something heavy and made of metal",
  "Find something light that you can write on", "Find something warm and soft", "Find something red that you can wear",
  "Find something that is both useful and pretty", "Find something with a button and a screen", "Find something with a handle and a lid",
];

// Elevate the Ordinary: everyday objects with a surprising job or story.
const THEME = [
  "Find something invented to fix a tiny problem", "Find something you use every single day", "Find something that helps you tell time",
  "Find something that protects you", "Find something that helps you see better", "Find something that was once a luxury",
  "Find something that hides a clever mechanism", "Find something that connects two things together", "Find something that stores energy",
  "Find something that makes your day easier", "Find something that keeps secrets", "Find something that carries a message",
  "Find something that took a genius to invent", "Find something that turns one thing into another", "Find something that keeps you comfortable",
  "Find something that makes noise on purpose", "Find something that holds a memory", "Find something that helps you stay organised",
  "Find something that you would miss if it disappeared", "Find something older than the internet in its design",
];

// Mythic (level 15+): three constraints at once.
const T4 = [
  "Find a red metal object smaller than your hand", "Find something round, made of glass and see-through", "Find a soft blue thing with a pattern",
  "Find a small plastic thing with a button and a screen", "Find something long, thin and made of wood", "Find a white ceramic thing with a handle",
  "Find a shiny metal thing that is not a coin", "Find a paper thing with numbers and letters on it", "Find something green that is not a plant",
  "Find a rubber thing smaller than your fist", "Find something with a lid, made of metal, that holds liquid", "Find a black plastic thing with a cable",
  "Find a striped fabric thing you could wear", "Find something square, flat and made of cardboard", "Find a clear plastic thing that holds something",
  "Find a heavy object smaller than your hand", "Find a wooden thing with something written on it", "Find something round, red and not food",
  "Find a yellow object made of plastic or metal", "Find something with three or more colours on it", "Find a tiny thing with a clever mechanism",
  "Find a glass thing that is not a window or a cup", "Find something soft, grey and made of cloth", "Find a metal thing with a hole and a handle",
  "Find something that is both round and flat",
];

const BANK = [T0, T1, T2, T3, T4];

function tierIndex(level: number) {
  return level <= 3 ? 0 : level <= 6 ? 1 : level <= 10 ? 2 : level <= 14 ? 3 : 4;
}

/** A challenge for this level that has not been used in this run. Higher tiers mix in theme challenges. */
export function pickChallenge(level: number, used: string[]): string {
  const t = tierIndex(level);
  const themeChance = t === 0 ? 0 : t === 1 ? 0.3 : t === 4 ? 0.2 : 0.4;
  const pools = Math.random() < themeChance ? [THEME, BANK[t]] : [BANK[t], THEME];
  for (const pool of pools) {
    const fresh = pool.filter((c) => !used.includes(c));
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  }
  return BANK[t][Math.floor(Math.random() * BANK[t].length)];
}

export const CHALLENGE_COUNT = BANK.reduce((n, p) => n + p.length, 0) + THEME.length;
