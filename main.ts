// ===========================================================================
// The Robot Pickup Line Championship — revised entry program
// https://make.fun/bounty/u-jolly-fox-32-the-robot-pickup-line-championship-3c177b1b
//
// Revision notes:
//   The original file kept the winning line in a single constant and ran
//   one long chain of checks over it. This revision reorganises the same
//   file into small, named sections that mirror how the entry is actually
//   produced:
//
//     1. constants   — the gate limits, in one frozen object;
//     2. line bank   — the champion line plus the drafts it beat, kept
//                      together so the choice is visible in the source;
//     3. measurement — pure helpers that describe a line without judging it;
//     4. validation  — gate, judge shape, and UTF-8 checks, plus a
//                      self-check that tests the helpers on synthetic
//                      samples before the real line is trusted to them;
//     5. selection   — a deterministic scoring pass over the bank, with
//                      an explanation for the winner;
//     6. output      — the writer and the one-line log summary.
//
//   Nothing about the shipped line changes: the file written to
//   entry.txt is byte-for-byte the line the original program wrote.
// ===========================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// 1. Constants — the gate, as one frozen record
// ---------------------------------------------------------------------------

/**
 * The sealed gate's limits, grouped so validation code reads them from a
 * single place instead of scattering magic numbers through the file.
 * Frozen: a stray assignment must not quietly widen the gate.
 */
const GATE = Object.freeze({
  /** Smallest entry the gate accepts, in characters. */
  minChars: 1,
  /** Largest entry the gate accepts, in characters. */
  maxChars: 200,
  /**
   * House economy ceiling. A pickup line is one breath; the champion is
   * seventeen words, so this only trips on a padded rewrite.
   */
  maxWords: 25,
});

// ---------------------------------------------------------------------------
// 2. Line bank — the champion and the drafts it replaced
// ---------------------------------------------------------------------------

/**
 * The line this entry ships. A robot trained on more dialogue than any
 * human will ever read, left speechless by exactly one person: the setup
 * sounds like a boast and lands on a confession, and the joke only works
 * because the speaker is a machine.
 */
const CHAMPION_LINE =
  "I've trained on ten million conversations and none of them taught me what to say to you.";

/**
 * Earlier drafts, kept for the record. Both lean on a stock robot trope,
 * which is exactly why they lost: the judge has heard the Wi-Fi line and
 * the error-404 line a thousand times. They stay in the bank so the
 * selection step (added later in this revision) has something real to
 * reject, and so a future edit can see what "too familiar" looks like.
 */
const DRAFT_LINES: readonly string[] = [
  "Beep boop — are you Wi-Fi? Because I am really feeling a connection.",
  "Error 404: my heart was not found until you walked into the room.",
];

/** Every candidate line, champion first. Order matters: it is the tie-break. */
const LINE_BANK: readonly string[] = [CHAMPION_LINE, ...DRAFT_LINES];

// ---------------------------------------------------------------------------
// 3. Measurement — describe a line, do not judge it yet
// ---------------------------------------------------------------------------

/**
 * Length the way the gate counts it: Unicode code points, not UTF-16
 * code units. The champion is plain ASCII, but the count stays honest
 * for any future edit.
 */
function codePointLength(text: string): number {
  return [...text].length;
}

/** Word count: runs of non-whitespace. "I've" counts as one word. */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/** True when the text contains no line break of any kind. */
function isSingleLine(text: string): boolean {
  return !/[\r\n]/.test(text);
}

/** True when the text is empty or nothing but whitespace. */
function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * True when there is no leading or trailing whitespace. The gate counts
 * every character it is handed, so padding at either end would change
 * the measured line without changing how it reads in an editor.
 */
function hasCleanEdges(text: string): boolean {
  return text.length > 0 && text === text.trim();
}

/** True when `haystack` contains any of the given fragments (already lowercase). */
function containsAny(haystack: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => haystack.includes(fragment));
}

/**
 * Stock robot tropes. A line built from one of these loses the surprise
 * before the judge weighs anything else, so freshness is measured
 * against this list.
 */
const OVERUSED_TROPES: readonly string[] = [
  "beep boop",
  "wifi",
  "wi-fi",
  "charging cable",
  "error 404",
  "are you a bug",
  "you had me at hello",
  "my heart is a circuit",
];

/** Words that would make the line creepy or cruel instead of charming. */
const HOSTILE_WORDS: readonly string[] = [
  "obey",
  "override",
  "scan you",
  "track you",
  "hack",
  "delete you",
  "terminate",
];

/**
 * Machine self-reference markers. The judge's second criterion asks for
 * a joke that grows out of being a machine, so a valid line must carry
 * at least one of these stems.
 */
const MACHINE_MARKERS: readonly string[] = [
  "train",
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

/**
 * True when the text reads as a robot speaking in the first person
 * about its own machine nature, addressed to the person it is charming:
 * an "I" / "I've" / "I'm", a machine marker, and a "you".
 */
function readsAsRobotSpeaking(text: string): boolean {
  const lower = text.toLowerCase();
  const firstPerson =
    /\bi\b/.test(lower) || lower.includes("i've") || lower.includes("i'm");
  return firstPerson && containsAny(lower, MACHINE_MARKERS) && /\byou\b/.test(lower);
}

/** True when the line leans on none of the overused robot tropes. */
function avoidsOverusedTropes(text: string): boolean {
  return !containsAny(text.toLowerCase(), OVERUSED_TROPES);
}

/** True when the line carries none of the hostile or creepy words. */
function staysCharming(text: string): boolean {
  return !containsAny(text.toLowerCase(), HOSTILE_WORDS);
}

/** Snapshot of everything later steps need to know about a line. */
interface LineProfile {
  chars: number;
  words: number;
  singleLine: boolean;
  cleanEdges: boolean;
  blank: boolean;
  robotVoice: boolean;
  fresh: boolean;
  charming: boolean;
}

/** Measure a line once and pass the profile around. */
function profileLine(text: string): LineProfile {
  return {
    chars: codePointLength(text),
    words: countWords(text),
    singleLine: isSingleLine(text),
    cleanEdges: hasCleanEdges(text),
    blank: isBlank(text),
    robotVoice: readsAsRobotSpeaking(text),
    fresh: avoidsOverusedTropes(text),
    charming: staysCharming(text),
  };
}

// ---------------------------------------------------------------------------
// 3b. Gate validation — fail loudly before anything is written
// ---------------------------------------------------------------------------

/**
 * The sealed gate, re-checked locally: 1–200 characters, not only white
 * space, no padding at the edges. A line that fails here scores Valid 0
 * and never meets the judge, so this throws instead of shipping it.
 */
function assertGatePasses(text: string, profile: LineProfile): void {
  if (profile.chars < GATE.minChars || profile.chars > GATE.maxChars) {
    throw new Error(
      `gate: entry must be ${GATE.minChars} to ${GATE.maxChars} characters, got ${profile.chars}`,
    );
  }
  if (profile.blank) {
    throw new Error("gate: entry must not be only white space");
  }
  if (!profile.cleanEdges) {
    throw new Error("gate: entry must not start or end with whitespace");
  }
  if (!profile.singleLine) {
    throw new Error("gate: entry must be exactly one line, no line breaks");
  }
}

/**
 * The judge's shape, checked the same way the brief describes it:
 * economical, a robot speaking for itself to the person it is charming,
 * free of tired tropes, and charming rather than creepy.
 */
function assertJudgeShape(profile: LineProfile): void {
  if (profile.words > GATE.maxWords) {
    throw new Error(
      `judge shape: entry must be at most ${GATE.maxWords} words, got ${profile.words}`,
    );
  }
  if (!profile.robotVoice) {
    throw new Error(
      "judge shape: entry must be a robot speaking in the first person about its machine nature, addressed to you",
    );
  }
  if (!profile.fresh) {
    throw new Error("judge shape: entry must not lean on an overused robot pickup trope");
  }
  if (!profile.charming) {
    throw new Error("judge shape: entry must be charming, not creepy or cruel");
  }
}

/**
 * Prove the line is clean UTF-8: encode it and confirm the round trip
 * is exact, so no stray byte can slip into entry.txt.
 */
function assertCleanUtf8(text: string): void {
  const roundTripped = new TextDecoder("utf-8", { fatal: true }).decode(
    new TextEncoder().encode(text),
  );
  if (roundTripped !== text) {
    throw new Error("encoding: entry must be clean UTF-8 text");
  }
}

/** Every validation, in order: gate, judge shape, encoding. */
function validateEntry(text: string): LineProfile {
  const profile = profileLine(text);
  assertGatePasses(text, profile);
  assertJudgeShape(profile);
  assertCleanUtf8(text);
  return profile;
}

/**
 * Self-check for the helpers themselves, run before the real line is
 * trusted to them. Each expectation uses a synthetic sample, so a broken
 * helper is caught here rather than mis-judging the entry.
 */
function runSelfCheck(): void {
  const expectations: ReadonlyArray<readonly [string, boolean]> = [
    ["codePointLength counts code points", codePointLength("a\u{1F600}b") === 3],
    ["countWords splits on whitespace", countWords("one  two\tthree") === 3],
    ["isSingleLine rejects a newline", !isSingleLine("two\nlines")],
    ["isBlank rejects real text", !isBlank(CHAMPION_LINE)],
    ["hasCleanEdges rejects padding", !hasCleanEdges(" padded ")],
    ["trope draft is flagged un-fresh", !avoidsOverusedTropes(DRAFT_LINES[0])],
    ["error-404 draft is flagged un-fresh", !avoidsOverusedTropes(DRAFT_LINES[1])],
    ["champion reads as a robot speaking", readsAsRobotSpeaking(CHAMPION_LINE)],
    ["champion stays charming", staysCharming(CHAMPION_LINE)],
  ];
  for (const [label, ok] of expectations) {
    if (!ok) {
      throw new Error(`self-check failed: ${label}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Output — write the line, then say what was written
// ---------------------------------------------------------------------------

/**
 * Output directory: MAKEFUN_OUTPUT_DIR when the harness sets it,
 * /output otherwise. Never a hardcoded fixed path.
 */
function outputDirectory(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
}

/**
 * Write the line to entry.txt. The file holds exactly the line — no
 * trailing newline, no extra text — so the gate measures precisely
 * what the judge will read.
 */
function writeEntry(text: string, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, text, "utf8");
  return outPath;
}

// ---------------------------------------------------------------------------
// 5. Selection — pick the bank's winner deterministically, and explain it
// ---------------------------------------------------------------------------

/**
 * Score a candidate line from its profile. Gate failures score
 * -Infinity so a disqualified line can never win on charm points; the
 * rest is additive, weighted in the judge's own order — robot voice
 * first, then freshness, then charm, then economy.
 */
function scoreLine(profile: LineProfile): number {
  if (
    profile.blank ||
    !profile.singleLine ||
    !profile.cleanEdges ||
    profile.chars < GATE.minChars ||
    profile.chars > GATE.maxChars
  ) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = 0;
  if (profile.robotVoice) score += 40;
  if (profile.fresh) score += 25;
  if (profile.charming) score += 25;
  if (profile.words <= GATE.maxWords) score += 10;
  return score;
}

/** A bank candidate together with everything the selection decided about it. */
interface ScoredLine {
  line: string;
  profile: LineProfile;
  score: number;
  /** Position in LINE_BANK; the deterministic tie-break. */
  bankIndex: number;
}

/**
 * Choose the winning line from the bank. Pure and deterministic: the
 * same bank always yields the same winner, because ties are broken by
 * bank order (earliest wins) rather than by any map or set ordering.
 */
function selectChampion(bank: readonly string[]): ScoredLine {
  let best: ScoredLine | null = null;
  bank.forEach((line, bankIndex) => {
    const profile = profileLine(line);
    const candidate: ScoredLine = { line, profile, score: scoreLine(profile), bankIndex };
    if (best === null || candidate.score > best.score) {
      best = candidate;
    }
  });
  if (best === null || !Number.isFinite((best as ScoredLine).score)) {
    throw new Error("selection: no line in the bank passes the gate");
  }
  return best as ScoredLine;
}

/**
 * Explain, in plain words, why the selected line won — one reason per
 * check that contributed to its score. The explanation is asserted in
 * main (a winner with no reasons is a bug), and it doubles as the
 * human-readable record of the choice the bank encodes.
 */
function explainSelection(winner: ScoredLine): string[] {
  const reasons: string[] = [];
  if (winner.profile.robotVoice) {
    reasons.push("a robot speaks in the first person about its own machine nature, to you");
  }
  if (winner.profile.fresh) {
    reasons.push("it leans on none of the overused robot tropes in the bank's drafts");
  }
  if (winner.profile.charming) {
    reasons.push("it is charming rather than creepy or cruel");
  }
  if (winner.profile.words <= GATE.maxWords) {
    reasons.push(`it is economical at ${winner.profile.words} words`);
  }
  reasons.push(`deterministic score ${winner.score}, bank position ${winner.bankIndex + 1}`);
  return reasons;
}

/**
 * The one-line log summary, built from the winner's measured profile.
 * The wording is kept stable across this revision: it is the program's
 * receipt that the gate passed, and downstream tooling reads it.
 */
function formatEntrySummary(profile: LineProfile, outPath: string, line: string): string {
  const checks = [
    `single-line=${profile.singleLine}`,
    `clean-edges=${profile.cleanEdges}`,
    `robot-voice=${profile.robotVoice}`,
    `fresh=${profile.fresh}`,
    `charming=${profile.charming}`,
  ].join(", ");
  return (
    `wrote ${profile.chars}-character, ${profile.words}-word entry ` +
    `to ${outPath} (${checks}): "${line}"`
  );
}

// ---------------------------------------------------------------------------
// Main — self-check, select, validate the winner, write it, log the receipt
// ---------------------------------------------------------------------------

function main(): void {
  runSelfCheck();
  const winner = selectChampion(LINE_BANK);
  const reasons = explainSelection(winner);
  if (reasons.length === 0) {
    throw new Error("selection: champion selected with no explanation");
  }
  const profile = validateEntry(winner.line);
  const outPath = writeEntry(winner.line, outputDirectory());
  console.log(formatEntrySummary(profile, outPath, winner.line));
}

main();
