// The languages the app can show, without their texts (each language's texts are in its own file,
// loaded only when needed). Loaded first in <head> by index.html, history.html and avatar.html,
// before js/i18n/en.js and js/i18n.js. See "Languages" in the README.
//
// Every entry:
//   code          what's saved in ct_prefs_v1 (language) and matched against the browser's languages
//   nativeName    the name in the language itself, as shown in the language sheet ("Magyar")
//   englishName   shown in muted text under the native name (not for English itself), and the A-Z tie-break
//   nativeSpeakers  L1 speakers in millions (the sheet's order, see sortLanguages). null for English,
//                 which is always first.
//   beta          true until a native speaker has reviewed it: a "BETA" pill in the sheet, and it's
//                 listed after every reviewed language
//   file          the texts, relative to the page
//   intlLocale    the locale every Intl format uses (dates, times, plurals)
//   relativeTimeStyle  Intl.RelativeTimeFormat's style for "ended 3 hours ago": one style, or one per
//                 unit (minute, hour, day). English mixes them to keep its wording: "45 min ago",
//                 "3 hours ago", "2 days ago".
//
// nativeSpeakers sources (do not change these numbers without a new source):
//   Spanish 487, Portuguese 252, Indonesian 78, German 76, French 76, Italian 60: Ethnologue, as
//   listed in Wikipedia "List of languages by number of native speakers", accessed 2026-11-09.
//   Polish 40: Ethnologue 2022, via Wikipedia "List of languages by total number of speakers".
//   Hungarian 13: approximate.
const LANGUAGES = [
  {
    code: "en", nativeName: "English", englishName: "English", nativeSpeakers: null, beta: false,
    file: "js/i18n/en.js", intlLocale: "en-GB", relativeTimeStyle: { minute: "short", hour: "long", day: "long" },
  },
  {
    code: "hu", nativeName: "Magyar", englishName: "Hungarian", nativeSpeakers: 13, beta: false,
    file: "js/i18n/hu.js", intlLocale: "hu-HU", relativeTimeStyle: "narrow",
  },
];

const SOURCE_LANGUAGE = "en";

// The language sheet's order, worked out from the data, never sorted by hand:
//   1. English, always first.
//   2. The reviewed languages (beta false), most native speakers first.
//   3. The beta languages, most native speakers first.
// Equal numbers: by English name, A-Z. So removing a language's beta flag moves it up by itself.
function sortLanguages(languages) {
  return [...languages].sort((a, b) => {
    const rank = (language) => (language.code === SOURCE_LANGUAGE ? 0 : language.beta ? 2 : 1);
    return (
      rank(a) - rank(b) ||
      (b.nativeSpeakers || 0) - (a.nativeSpeakers || 0) ||
      a.englishName.localeCompare(b.englishName, "en")
    );
  });
}
