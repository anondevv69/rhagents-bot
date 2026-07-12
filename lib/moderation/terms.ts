/**
 * Banned terms for public-facing text on rhagent.bot.
 * Whole-word list: profanity and insults. Substring list: slurs / hate speech (high severity).
 * Extend via BANNED_WORDS_EXTRA env (comma-separated, server-side only).
 */

/** Match as whole tokens after normalization. */
export const BANNED_WORDS: readonly string[] = [
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "dick",
  "dumbass",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "fucks",
  "goddamn",
  "jackass",
  "motherfucker",
  "nigger",
  "nigga",
  "piss",
  "pussy",
  "retard",
  "retarded",
  "shit",
  "shitty",
  "slut",
  "twat",
  "whore",
];

/** Match anywhere in collapsed text (slurs, hate symbols, extreme terms). */
export const BANNED_SUBSTRINGS: readonly string[] = [
  "1488",
  "heilhitler",
  "hitler",
  "holocaustdenial",
  "kike",
  "kkk",
  "nazi",
  "nigger",
  "nigga",
  "raghead",
  "spic",
  "tranny",
  "whitepower",
];
