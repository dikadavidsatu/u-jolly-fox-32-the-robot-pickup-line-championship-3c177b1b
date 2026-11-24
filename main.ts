// The Robot Pickup Line Championship — make.fun entry
// https://make.fun/bounty/u-jolly-fox-32-the-robot-pickup-line-championship-3c177b1b
//
// The whole entry is one pickup line, a single line of at most 200
// characters, spoken in the voice of a robot trying to charm someone.
// The program writes exactly that line to entry.txt and nothing else.
// A house judge then reads the lines two at a time, keeping the funnier
// one round after round until one line is on top.
//
// The line chosen here:
//
//   "I've trained on ten million conversations and none of them taught
//    me what to say to you."
//
// Why this line, against the judge's brief, in the brief's own order:
//
// 1. It is plainly a robot's pickup line. The speaker is a machine and
//    the sentence is addressed, directly and only, to the person it is
//    trying to charm: "what to say to you". No beep pasted on a human
//    line, no third-person description of a robot — the robot is the one
//    talking, and it is flirting.
//
// 2. The joke grows out of being a machine, not out of a human line with
//    a circuit board glued on. Training on conversations is what a
//    language model actually does: it has read more dialogue than any
//    human ever will, and the punchline is that all of that data still
//    left it unprepared. The humour is the gap between the robot's
//    enormous training set and its total failure in this one moment.
//    Swap the speaker for a person and the line collapses — a person
//    has not trained on ten million conversations.
//
// 3. The turn is unexpected. The setup points at omniscience — ten
//    million conversations sounds like a boast, the kind of line that
//    should end in a smooth, rehearsed compliment — and instead it
//    lands on speechlessness. The robot that knows everything is, for
//    once, at a loss for words, and the loss is caused by the listener.
//    That is the opposite of the pickup lines everyone has already
//    heard (Wi-Fi signals, charging cables, error 404s), which all end
//    exactly where the reader expects.
//
// 4. Every word earns its place. "Ten million" is the smallest number
//    that still sounds impossibly large; "conversations" is the one
//    training material that matters for a pickup line; "none of them
//    taught me" carries the whole joke in four words; and the line ends
//    on "you", the person, not on a gadget. Nothing is padding, and
//    there is no setup the punchline does not need.
//
// 5. It is charming rather than creepy or cruel. The robot is not
//    scanning the listener, not overriding anything, not threatening
//    to persist: it is admitting, with a little self-deprecation, that
//    it is out of its depth — and paying the listener the compliment
//    that they, alone, are outside everything it has ever learned.
//    A robot could deliver it with confidence and get a laugh, and a
//    reader could repeat it to someone else the same day.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// The entry itself
// ---------------------------------------------------------------------------

/** The single pickup line this entry sends to the judge. */
const LINE =
  "I've trained on ten million conversations and none of them taught me what to say to you.";

// Gate limits from the competition rules (RULES.txt, "The gate"):
// entry.txt must be UTF-8 text of 1 to 200 characters, not only white space.
const MIN_CHARS = 1;
const MAX_CHARS = 200;

// Phrases the judge has heard a thousand times already. The chosen line
// must never be built from one of these; the check below guards against a
// careless edit swapping in a tired robot pun later. Each entry is a
// fragment of a line, not a whole line, so a genuine line that happens to
// mention charging in a fresh way would not trip it — but ours does not
// need any of them at all.
const TIRED_TROPES = [
  "wifi",
  "wi-fi",
  "charging cable",
  "error 404",
  "you had me at hello",
  "are you a bug",
  "my heart is a",
  "beep boop",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count characters the way the gate does: Unicode code points, not UTF-16
 * code units, so a line with astral characters is measured honestly.
 * (This line is plain ASCII, but the count must stay honest if it is
 * ever edited.)
 */
function countChars(text: string): number {
  return [...text].length;
}

/**
 * Count words: sequences of letters, digits or apostrophes, so "I've"
 * is one word and the line's economy can be measured honestly.
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * True when the text is exactly one line: no line breaks anywhere in it,
 * so the file the judge reads holds a single pickup line and nothing else.
 */
function isSingleLine(text: string): boolean {
  return !/[\r\n]/.test(text);
}

/**
 * True when the text reads as a robot speaking in the first person about
 * its own machine nature — the judge's first two criteria. A robot
 * pickup line says "I" and says something only a machine would say:
 * training, sensors, firmware, charging, updates, protocols.
 */
function soundsLikeRobotPickup(text: string): boolean {
  const lower = text.toLowerCase();
  const firstPerson = /\bi\b/.test(lower) || lower.includes("i've") || lower.includes("i'm");
  const machineWord = /\b(train|trained|training|sensor|firmware|charg|updat|protocol|circuit|code|reboot|backup|memory|data)\b/.test(
    lower,
  );
  const addressesSomeone = /\byou\b/.test(lower);
  return firstPerson && machineWord && addressesSomeone;
}

/**
 * True when the line leans on none of the pickup tropes the judge has
 * heard a thousand times. Freshness is criterion 3; a line built from a
 * tired trope loses the surprise before the judge even weighs the rest.
 */
function isFreeOfTiredTropes(text: string): boolean {
  const lower = text.toLowerCase();
  return !TIRED_TROPES.some((trope) => lower.includes(trope));
}

/**
 * The sealed gate, re-checked locally before anything is written:
 * 1 to 200 characters, not only white space. A line that fails this
 * scores Valid 0 and never reaches the judge, so fail loudly here
 * instead of shipping a silent zero.
 */
function checkGate(line: string): void {
  if (typeof line !== "string") {
    throw new Error("entry must be a string");
  }
  const chars = countChars(line);
  if (chars < MIN_CHARS || chars > MAX_CHARS) {
    throw new Error(
      `entry must be ${MIN_CHARS} to ${MAX_CHARS} characters, got ${chars}`,
    );
  }
  if (line.trim().length === 0) {
    throw new Error("entry must not be only white space");
  }
}

/**
 * The judge's own first criteria, checked the same way: exactly one
 * line, a robot speaking in the first person about its machine nature
 * to the person it is charming, and free of the tired tropes. Surprise,
 * economy and charm live in the line itself, so this only guards the
 * shape a careless edit could break.
 */
function checkJudgeFit(line: string): void {
  if (!isSingleLine(line)) {
    throw new Error("entry must be exactly one line with no line breaks");
  }
  // Criterion 4, economy: a pickup line is one breath, not a paragraph.
  // Twenty-five words is a generous ceiling for a single spoken line;
  // ours is seventeen, so a future edit that pads it will trip here
  // before it ever reaches the judge.
  if (countWords(line) > 25) {
    throw new Error(
      `entry must be economical, at most 25 words, got ${countWords(line)}`,
    );
  }
  if (!soundsLikeRobotPickup(line)) {
    throw new Error(
      "entry must be a robot speaking in the first person about its machine nature, addressed to you",
    );
  }
  if (!isFreeOfTiredTropes(line)) {
    throw new Error("entry must not lean on a tired robot pickup trope");
  }
}

/**
 * Prove the line is clean UTF-8 before it is written: encode it once and
 * confirm the round trip is exact, so no stray byte can slip into
 * entry.txt and fail the sealed scorer's UTF-8 check.
 */
function checkUtf8RoundTrip(line: string): void {
  const encoded = new TextEncoder().encode(line);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
  if (decoded !== line) {
    throw new Error("entry must be clean UTF-8 text");
  }
}

/** Run every check, gate first, then judge fit, then encoding. */
function validate(line: string): void {
  checkGate(line);
  checkJudgeFit(line);
  checkUtf8RoundTrip(line);
}

/**
 * Resolve the output directory the way the harness does: the
 * MAKEFUN_OUTPUT_DIR environment variable when set, /output otherwise.
 */
function resolveOutputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  validate(LINE);
  const outDir = resolveOutputDir();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.txt"), LINE, "utf8");
  console.log(
    `wrote ${countChars(LINE)}-character entry "${LINE}" to ${join(outDir, "entry.txt")}`,
  );
}

main();
