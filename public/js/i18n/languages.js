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
//   weekday       how a date in the history names its day: Intl's "short" ("Mon 20 Oct") or "long"
//                 ("okt. 20., hétfő": Hungarian's short form is a single letter)
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
    file: "js/i18n/en.js", intlLocale: "en-GB", weekday: "short", relativeTimeStyle: { minute: "short", hour: "long", day: "long" },
  },
  {
    code: "hu", nativeName: "Magyar", englishName: "Hungarian", nativeSpeakers: 13, beta: false,
    file: "js/i18n/hu.js", intlLocale: "hu-HU", weekday: "long", relativeTimeStyle: "narrow",
  },
  // es: plain "es" (not tied to Spain; es-419 would give "02:05 p.m."). "hace 45 min", "hace 3 horas".
  {
    code: "es", nativeName: "Español", englishName: "Spanish", nativeSpeakers: 487, beta: true,
    file: "js/i18n/es.js", intlLocale: "es", weekday: "short", relativeTimeStyle: { minute: "short", hour: "long", day: "long" },
  },
  // pt-BR: long throughout ("há 45 minutos"); short gives "há 45 min." with a stray full stop.
  {
    code: "pt-BR", nativeName: "Português (Brasil)", englishName: "Portuguese (Brazil)", nativeSpeakers: 252, beta: true,
    file: "js/i18n/pt-BR.js", intlLocale: "pt-BR", weekday: "short", relativeTimeStyle: "long",
  },
  // id: long ("45 menit yang lalu"); short gives "45 mnt lalu" and "2 h lalu".
  {
    code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", nativeSpeakers: 78, beta: true,
    file: "js/i18n/id.js", intlLocale: "id-ID", weekday: "short", relativeTimeStyle: "long",
  },
  // fr: "il y a 45 min", "il y a 3 heures"; narrow would give "-45 min".
  {
    code: "fr", nativeName: "Français", englishName: "French", nativeSpeakers: 76, beta: true,
    file: "js/i18n/fr.js", intlLocale: "fr-FR", weekday: "short", relativeTimeStyle: { minute: "short", hour: "long", day: "long" },
  },
  // de: long ("vor 45 Minuten"); short gives "vor 45 Min." with a stray full stop.
  {
    code: "de", nativeName: "Deutsch", englishName: "German", nativeSpeakers: 76, beta: true,
    file: "js/i18n/de.js", intlLocale: "de-DE", weekday: "short", relativeTimeStyle: "long",
  },
  // it: "45 min fa", "3 ore fa", "2 giorni fa"; short days would give "2 gg fa".
  {
    code: "it", nativeName: "Italiano", englishName: "Italian", nativeSpeakers: 60, beta: true,
    file: "js/i18n/it.js", intlLocale: "it-IT", weekday: "short", relativeTimeStyle: { minute: "short", hour: "long", day: "long" },
  },
  // pl: "45 min temu", "3 godziny temu", "2 dni temu"; narrow would give "3 g. temu".
  {
    code: "pl", nativeName: "Polski", englishName: "Polish", nativeSpeakers: 40, beta: true,
    file: "js/i18n/pl.js", intlLocale: "pl-PL", weekday: "short", relativeTimeStyle: { minute: "short", hour: "long", day: "long" },
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
