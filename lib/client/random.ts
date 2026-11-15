export function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles quiz options so the right answer lands on A, B or C at random. */
export function shuffleQuiz(q: { question: string; options: string[]; answer: number }) {
  const order = shuffle(q.options.map((_, i) => i));
  return { question: q.question, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

// What Nimbus says while a photo is being analyzed. Shown in a random order every time.
export const ANALYZE_LINES = [
  "Asking the clouds...", "Flipping through the sky library...", "Polishing my fact goggles...", "Whispering to the object...",
  "Counting fun facts...", "Fluffing up my brain...", "Tickling the thinking cap...", "Consulting the cloud council...",
  "Zooming in with my sky eyes...", "Shaking the idea tree...", "Warming up my wow engine...", "Sniffing out secrets...",
  "Raining down knowledge...", "Checking under the hood...", "Borrowing a magnifying glass...", "Waking up the fact fairies...",
  "Untangling a tricky thought...", "Doing a little cloud math...", "Asking a very old encyclopedia...", "Spinning the trivia wheel...",
  "Peeking behind the ordinary...", "Giving this a closer look...", "Mixing up something amazing...", "Reading the tiny print on reality...",
  "Chasing a rainbow of facts...", "Putting on my detective hat...", "Searching every cloud corner...", "Stirring the knowledge soup...",
  "Dusting off ancient secrets...", "Turning ordinary into extraordinary...",
];

export const CHECK_LINES = [
  "Checking your find...", "Is this the one? Let me look...", "Squinting very hard...", "Comparing it to the challenge...",
  "Consulting my cloud judges...", "Measuring the wow...", "Looking closely...", "Hmm, interesting...", "Running the official cloud check...",
];
