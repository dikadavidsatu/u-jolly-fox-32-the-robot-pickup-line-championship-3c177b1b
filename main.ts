// ===========================================================================
// The Robot Pickup Line Championship
// https://make.fun/bounty/u-jolly-fox-32-the-robot-pickup-line-championship-3c177b1b
//
// One job, done simply: write a single pickup line, in the voice of a robot
// trying to charm a person, into entry.txt — and nothing else.
//
// The competition, in short:
//   * The entry is ONE line, at most 200 characters, UTF-8 text, not only
//     whitespace. That is the gate; anything failing it scores Valid 0 and
//     never meets the judge.
//   * After entries close, a house judge reads the lines two at a time and
//     keeps the funnier one, round after round, until one line wins.
//   * The judge weighs, in this order: (1) it really is a robot's pickup
//     line, (2) the joke grows out of being a machine — sensors, firmware,
//     charging, updates, training, protocols — not a human line with a beep
//     pasted on, (3) the turn is unexpected, (4) every word earns its
//     place, (5) it is charming rather than creepy or cruel. The best line
//     is one a reader repeats to someone else the same day.
//
// The line this entry sends:
//
//   "I've trained on ten million conversations and none of them taught
//    me what to say to you."
//
// Why this line, walked through the judge's own order:
//
//   1. It is unmistakably a robot speaking. The "I" is a machine, and the
//      sentence is aimed straight at the person being charmed — "what to
//      say to you". It is not a description of a robot, and it is not a
//      human line with a robot word glued on: the robot itself is doing
//      the flirting.
//
//   2. The joke only works because the speaker is a machine. Training on
//      conversations is literally what a language model does — it has
//      read more dialogue than any human ever will. The punchline is the
//      gap between that mountain of data and this one moment of total
//      failure. Hand the line to a person and it falls apart: no person
//      has trained on ten million conversations.
//
//   3. The turn lands from an angle the reader did not see coming. "Ten
//      million conversations" opens like a boast — the kind of setup that
//      should end in a smooth, rehearsed compliment — and instead it
//      lands on speechlessness. The machine that knows everything is, for
//      once, lost for words, and the listener is the reason why. That is
//      the opposite of the lines everyone has heard before (Wi-Fi
//      signals, charging cables, error 404s), which all end exactly where
//      the reader expects them to.
//
//   4. Nothing in it is padding. "Ten million" is the smallest number
//      that still sounds impossibly large; "conversations" is the one
//      kind of training that matters for a pickup line; "none of them
//      taught me" carries the whole joke in four words; and the line ends
//      on "you" — the person, not a gadget. No setup the punchline does
//      not need.
//
//   5. It is charming, not creepy. The robot is not scanning the
//      listener, not overriding anything, not threatening to persist. It
//      is admitting, with a little self-deprecation, that it is out of
//      its depth — and paying the listener the compliment that they, and
//      they alone, sit outside everything it has ever learned. A robot
//      could say it with confidence and get a laugh.
//
// Everything below exists to protect that line on its way to the judge:
// measure it the way the gate measures it, check the shape the judge's
// brief demands, prove the encoding is clean UTF-8, and only then write
// the file. If any check fails, the program fails loudly instead of
// shipping a silent zero.
// ===========================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// The entry
// ---------------------------------------------------------------------------

/**
 * The one pickup line this program writes. One line, no line breaks, no
 * trailing newline in the file — the file holds exactly these characters.
 */
const PICKUP_LINE =
  "I've trained on ten million conversations and none of them taught me what to say to you.";

// ---------------------------------------------------------------------------
// Gate limits, straight from the competition rules ("The gate")
// ---------------------------------------------------------------------------

/** Smallest entry the gate accepts, in characters. */
const GATE_MIN_CHARS = 1;

/** Largest entry the gate accepts, in characters. */
const GATE_MAX_CHARS = 200;

/**
 * A spoken pickup line is one breath, not a paragraph. This ceiling is
 * generous — the chosen line is seventeen words — so a careless edit that
 * pads the line trips here long before it reaches the judge.
 */
const MAX_WORDS = 25;

// ---------------------------------------------------------------------------
// What the line must not be
// ---------------------------------------------------------------------------

/**
 * Robot pickup tropes the judge has heard a thousand times. A line built
 * from one of these loses the surprise before the judge weighs anything
 * else. These are fragments, not whole lines, so a fresh line that merely
 * mentions charging in a new way would not trip the check — but the
 * chosen line needs none of them at all.
 */
const OVERUSED_TROPES = [
  "beep boop",
  "wifi",
  "wi-fi",
  "charging cable",
  "error 404",
  "are you a bug",
  "you had me at hello",
  "my heart is a circuit",
];

/**
 * Words that would turn the line creepy or cruel instead of charming —
 * the judge's fifth criterion. The chosen line contains none of them, and
 * any edit that introduced one should be caught here, not by the judge.
 */
const HOSTILE_WORDS = [
  "obey",
  "override",
  "scan you",
  "track you",
  "hack",
  "delete you",
  "terminate",
];

/**
 * Words that only a machine would use about itself — training, sensors,
 * firmware, charging, updates, protocols, memory, code. The judge's
 * second criterion asks for the joke to grow out of being a machine, so
 * the line must carry at least one of these.
 */
const MACHINE_WORDS = [
  "train",
  "trained",
  "training",
  "sensor",
  "firmware",
  "charg",
  "updat",
  "protocol",
  "circuit",
  "code",
  "reboot",
  "backup",
  "memory",
  "data",
  "algorithm",
  "model",
];

// ---------------------------------------------------------------------------
// Measuring the line
// ---------------------------------------------------------------------------

/**
 * Length in characters, counted the way the gate counts: Unicode code
 * points, not UTF-16 code units, so a line with characters outside the
 * basic plane is measured honestly. (This line is plain ASCII, but the
 * count must stay honest if the line is ever edited.)
 */
function charLength(text: string): number {
  return [...text].length;
}

/**
 * Word count: runs of non-space characters. "I've" is one word here, and
 * that is the honest way to measure the line's economy.
 */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/** True when the text holds no line break of any kind. */
function hasNoLineBreaks(text: string): boolean {
  return !/[\r\n]/.test(text);
}

/** True when the text is empty or nothing but whitespace. */
function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * True when the text has no leading or trailing whitespace. The gate
 * counts every character it is handed, so a stray space at either end
 * would silently change what the judge measures — a line that reads
 * clean in an editor but ships with padding. Catch that here instead.
 */
function hasCleanEdges(text: string): boolean {
  return text.length > 0 && text === text.trim();
}

/**
 * True when the text reads as a robot speaking in the first person about
 * its own machine nature, addressed to the person it is charming. That is
 * the judge's first two criteria in one check: an "I" (or "I've" / "I'm"),
 * a machine word, and a "you".
 */
function readsAsRobotSpeaking(text: string): boolean {
  const lower = text.toLowerCase();
  const firstPerson =
    /\bi\b/.test(lower) || lower.includes("i've") || lower.includes("i'm");
  const machineWord = MACHINE_WORDS.some((word) => lower.includes(word));
  const addressesSomeone = /\byou\b/.test(lower);
  return firstPerson && machineWord && addressesSomeone;
}

/** True when the line leans on none of the overused robot tropes. */
function avoidsOverusedTropes(text: string): boolean {
  const lower = text.toLowerCase();
  return !OVERUSED_TROPES.some((trope) => lower.includes(trope));
}

/** True when the line carries none of the hostile or creepy words. */
function staysCharming(text: string): boolean {
  const lower = text.toLowerCase();
  return !HOSTILE_WORDS.some((word) => lower.includes(word));
}

/**
 * A small report card for the line, so the checks below — and the log line
 * at the end — can talk about the same numbers instead of recomputing
 * them in three places.
 */
interface LineStats {
  chars: number;
  words: number;
  singleLine: boolean;
  cleanEdges: boolean;
  robotVoice: boolean;
  fresh: boolean;
  charming: boolean;
}

function measureLine(text: string): LineStats {
  return {
    chars: charLength(text),
    words: wordCount(text),
    singleLine: hasNoLineBreaks(text),
    cleanEdges: hasCleanEdges(text),
    robotVoice: readsAsRobotSpeaking(text),
    fresh: avoidsOverusedTropes(text),
    charming: staysCharming(text),
  };
}

// ---------------------------------------------------------------------------
// Checks — gate first, then the judge's shape, then the encoding
// ---------------------------------------------------------------------------

/**
 * The sealed gate, re-checked locally before anything is written: 1 to
 * 200 characters, not only white space, and no leading or trailing
 * whitespace that would pad the measured length. A line that fails this
 * scores Valid 0 and never reaches the judge, so fail loudly here
 * instead of shipping a silent zero.
 */
function assertGatePasses(text: string, stats: LineStats): void {
  if (stats.chars < GATE_MIN_CHARS || stats.chars > GATE_MAX_CHARS) {
    throw new Error(
      `gate: entry must be ${GATE_MIN_CHARS} to ${GATE_MAX_CHARS} characters, got ${stats.chars}`,
    );
  }
  if (isBlank(text)) {
    throw new Error("gate: entry must not be only white space");
  }
  if (!stats.cleanEdges) {
    throw new Error(
      "gate: entry must not start or end with whitespace — the gate counts every character",
    );
  }
}

/**
 * The judge's own shape, checked the same way: exactly one line, a robot
 * speaking in the first person about its machine nature to the person it
 * is charming, free of tired tropes, economical, and charming rather
 * than creepy. Surprise lives in the line itself, so this only guards
 * the shape a careless edit could break.
 */
function assertJudgeShape(text: string, stats: LineStats): void {
  if (!stats.singleLine) {
    throw new Error("judge shape: entry must be exactly one line, no line breaks");
  }
  if (stats.words > MAX_WORDS) {
    throw new Error(
      `judge shape: entry must be economical, at most ${MAX_WORDS} words, got ${stats.words}`,
    );
  }
  if (!stats.robotVoice) {
    throw new Error(
      "judge shape: entry must be a robot speaking in the first person about its machine nature, addressed to you",
    );
  }
  if (!stats.fresh) {
    throw new Error("judge shape: entry must not lean on an overused robot pickup trope");
  }
  if (!stats.charming) {
    throw new Error("judge shape: entry must be charming, not creepy or cruel");
  }
}

/**
 * Prove the line is clean UTF-8 before it is written: encode it once and
 * confirm the round trip is exact, so no stray byte can slip into
 * entry.txt and fail the sealed scorer's UTF-8 check.
 */
function assertCleanUtf8(text: string): void {
  const encoded = new TextEncoder().encode(text);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
  if (decoded !== text) {
    throw new Error("encoding: entry must be clean UTF-8 text");
  }
}

/** Every check, in order: gate, judge shape, encoding. */
function validateEntry(text: string): LineStats {
  const stats = measureLine(text);
  assertGatePasses(text, stats);
  assertJudgeShape(text, stats);
  assertCleanUtf8(text);
  return stats;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Where entry.txt goes: the MAKEFUN_OUTPUT_DIR environment variable when
 * the harness sets it, /output otherwise. Nothing here is hardcoded to a
 * fixed output path.
 */
function outputDirectory(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
}

/**
 * Write the validated line to entry.txt, creating the directory if needed.
 * The file holds exactly the line — no trailing newline, no extra text —
 * so the gate measures precisely what the judge reads.
 */
function writeEntry(text: string, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, text, "utf8");
  return outPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * One line of evidence for the log, built from the same measured stats
 * the gate just passed: length, word count, and every shape check that
 * had to hold. Keeping the wording in one place means the log can never
 * drift away from what validateEntry actually measured.
 */
function formatEntrySummary(stats: LineStats, outPath: string): string {
  const checks = [
    `single-line=${stats.singleLine}`,
    `clean-edges=${stats.cleanEdges}`,
    `robot-voice=${stats.robotVoice}`,
    `fresh=${stats.fresh}`,
    `charming=${stats.charming}`,
  ].join(", ");
  return (
    `wrote ${stats.chars}-character, ${stats.words}-word entry ` +
    `to ${outPath} (${checks}): "${PICKUP_LINE}"`
  );
}

function main(): void {
  const stats = validateEntry(PICKUP_LINE);
  const outPath = writeEntry(PICKUP_LINE, outputDirectory());
  console.log(formatEntrySummary(stats, outPath));
}

main();
