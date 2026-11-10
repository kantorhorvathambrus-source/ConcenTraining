"use strict";

// The translation system. Loaded in <head> of index.html, history.html and avatar.html, right after
// js/i18n/languages.js (the list of languages) and js/i18n/en.js (the English texts, the source and
// the fallback for every missing text). See "Languages" in the README.
//
// What it does, in order:
//   1. Picks the language: the one saved in ct_prefs_v1 (language) if the user picked one in the
//      language sheet, otherwise the first of the browser's languages the app has (exact code first,
//      then the base language: hu-HU -> hu, pt-PT -> pt-BR), otherwise English. Never saved here.
//   2. Sets <html lang> and, for a language other than English, writes its file into the page as a
//      parser-blocking script (document.write), so its texts are there before the body is parsed.
//      If that file can't load (offline and not cached, blocked), the page simply stays English.
//   3. Translates the page's own text while the browser builds it: every element with
//      data-i18n="key" gets that text, every data-i18n-attr="aria-label:key;title:key2" those
//      attributes. A MutationObserver (a browser feature that runs code whenever elements are added)
//      does it as the elements arrive, and its code always runs before the browser paints them, so
//      the English in the HTML never shows. One more pass at DOMContentLoaded, then it stops.
//      Everything the scripts build later asks t() itself, at the moment it's built.
//
// Data files (characters, motivations, categories, avatar options) keep their English text next to
// their data and hand it over with localize(): the text field becomes a getter (a property that's
// worked out each time it's read), so it always gives the current language. See "Languages" in
// the README for what that means for code that copies those objects.

// Every language's texts by code; en.js creates it, the other files add themselves to it.
// eslint-disable-next-line no-var
var I18N_TEXTS = I18N_TEXTS || {};
if (!I18N_TEXTS.en) I18N_TEXTS.en = {}; // en.js didn't load: every text shows its key

const I18N = (() => {
  const PREFS_KEY = "ct_prefs_v1"; // the app's prefs (app.js): the language is one field in it
  const byCode = new Map(LANGUAGES.map((language) => [language.code, language]));

  function savedLanguage() {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
      const code = prefs && prefs.language;
      return typeof code === "string" && byCode.has(code) ? code : null;
    } catch {
      return null; // storage blocked or broken: as on a first visit
    }
  }

  function browserLanguages() {
    try {
      if (Array.isArray(navigator.languages) && navigator.languages.length) return navigator.languages;
      return navigator.language ? [navigator.language] : [];
    } catch {
      return [];
    }
  }

  // The first browser language the app has: per browser language, the exact code first, then its
  // base language. Exported for the checks (see the README).
  function detect(tags) {
    const base = (code) => code.toLowerCase().split("-")[0];
    for (const tag of tags) {
      if (typeof tag !== "string" || !tag) continue;
      const exact = LANGUAGES.find((language) => language.code.toLowerCase() === tag.toLowerCase());
      if (exact) return exact.code;
      const sameBase = LANGUAGES.find((language) => base(language.code) === base(tag));
      if (sameBase) return sameBase.code;
    }
    return SOURCE_LANGUAGE;
  }

  // The language asked for (saved or detected), and the one actually shown: the same, unless its
  // file couldn't load, then English.
  let wanted = savedLanguage() || detect(browserLanguages());
  const loaded = (code) => Boolean(I18N_TEXTS[code]);
  const current = () => (loaded(wanted) ? wanted : SOURCE_LANGUAGE);
  const language = () => byCode.get(current());

  // ---------- texts ----------

  const pluralRules = new Map();
  function pluralCategory(code, count) {
    if (!pluralRules.has(code)) pluralRules.set(code, new Intl.PluralRules(byCode.get(code).intlLocale));
    return pluralRules.get(code).select(count);
  }

  function lookup(code, key) {
    const texts = I18N_TEXTS[code];
    return texts && Object.hasOwn(texts, key) ? texts[key] : undefined;
  }

  const fill = (text, values) =>
    values ? text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(values, name) ? String(values[name]) : match)) : text;

  // The text for key in the current language, English if it has none, the key itself if neither has
  // it (and the dev check lists it). values fill {placeholders}; a text with plural forms
  // ({ one, other, ... }) picks its form by values.count with Intl.PluralRules.
  function t(key, values) {
    let code = current();
    let text = lookup(code, key);
    if (text === undefined) {
      code = SOURCE_LANGUAGE;
      text = lookup(code, key);
    }
    if (text === undefined) return key;
    if (typeof text === "object") {
      const count = values && Number(values.count);
      text = text[pluralCategory(code, count)] ?? text.other;
    }
    return fill(text, values);
  }

  const has = (key) => lookup(current(), key) !== undefined || lookup(SOURCE_LANGUAGE, key) !== undefined;

  // A data file's English text field becomes a getter for key (see the top). Called once per field,
  // while the file loads. A field that's already a getter is left alone, so its text is never read
  // in another language and saved as English.
  function localize(object, field, key) {
    const descriptor = Object.getOwnPropertyDescriptor(object, field);
    if (!descriptor || descriptor.get) return object;
    if (typeof descriptor.value === "string" && !Object.hasOwn(I18N_TEXTS.en, key)) I18N_TEXTS.en[key] = descriptor.value;
    Object.defineProperty(object, field, { get: () => t(key), enumerable: true, configurable: true });
    return object;
  }

  // English that a data file builds itself rather than keeping in a field (e.g. the funny faces'
  // names): registered under key, unless en.js already has it.
  function source(key, english) {
    if (!Object.hasOwn(I18N_TEXTS.en, key)) I18N_TEXTS.en[key] = english;
  }

  // ---------- dates, times, relative times ----------

  // Every date and time is built by Intl in the current locale, never glued together in English order.
  const formatters = new Map();
  function cached(kind, options, make) {
    const id = `${current()}|${kind}|${JSON.stringify(options)}`;
    if (!formatters.has(id)) formatters.set(id, make());
    return formatters.get(id);
  }

  function formatDate(date, options) {
    return cached("date", options, () => new Intl.DateTimeFormat(language().intlLocale, options)).format(date);
  }

  // "45 min ago" / "45 perce": value units ago, in the language's relativeTimeStyle.
  function formatAgo(value, unit) {
    const style = language().relativeTimeStyle;
    const unitStyle = typeof style === "string" ? style : style[unit] || "long";
    return cached(`ago-${unit}`, unitStyle, () =>
      new Intl.RelativeTimeFormat(language().intlLocale, { style: unitStyle, numeric: "always" })
    ).format(-value, unit);
  }

  // ---------- the page's own text ----------

  // data-i18n: the element's text (it must have no child elements). data-i18n-attr: attributes.
  // Only changed when different, so English pages aren't touched and nothing loops below.
  function translateElement(element) {
    const key = element.getAttribute("data-i18n");
    if (key) {
      const text = t(key);
      if (element.textContent !== text) element.textContent = text;
    }
    const attrs = element.getAttribute("data-i18n-attr");
    if (attrs) {
      for (const pair of attrs.split(";")) {
        const [name, attrKey] = pair.split(":").map((part) => part.trim());
        if (!name || !attrKey) continue;
        const text = t(attrKey);
        if (element.getAttribute(name) !== text) element.setAttribute(name, text);
      }
    }
  }

  const SELECTOR = "[data-i18n], [data-i18n-attr]";

  function translateTree(root) {
    if (root.matches && root.matches(SELECTOR)) translateElement(root);
    if (root.querySelectorAll) root.querySelectorAll(SELECTOR).forEach(translateElement);
  }

  function translatePage() {
    document.documentElement.lang = current();
    translateTree(document.documentElement);
  }

  // While the page is parsed: an element arrives first, its text a moment later (possibly in a later
  // piece of the download). So an added text node translates its element again.
  function startTranslatingWhileParsing() {
    if (typeof MutationObserver !== "function") return;
    const observer = new MutationObserver((records) => {
      document.documentElement.lang = current(); // English after all if the language file failed
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) translateTree(node);
          else if (node.parentElement && node.parentElement.hasAttribute("data-i18n")) translateElement(node.parentElement);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        observer.takeRecords();
        observer.disconnect();
        translatePage();
      },
      { once: true }
    );
  }

  // ---------- switching (the language sheet) ----------

  // Loads a language's file if it isn't loaded yet. Resolves true once its texts are there.
  function load(code) {
    const entry = byCode.get(code);
    if (!entry) return Promise.resolve(false);
    if (loaded(code)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = entry.file;
      script.onload = () => resolve(loaded(code));
      script.onerror = () => {
        script.remove();
        resolve(false);
      };
      document.head.append(script);
    });
  }

  // Only the language field, on top of what's saved now (the same way app.js saves its prefs).
  function saveLanguage(code) {
    try {
      let prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) prefs = {};
      prefs.language = code;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // not saved: this page still switches, the next one follows the browser again
    }
  }

  // A tap on a row of the language sheet: the only place a language is saved. The page's own text
  // changes here; then "ct:languagechange" tells the page's script to build its parts again.
  // Resolves false (nothing changed) if the file couldn't load.
  async function setLanguage(code) {
    if (!(await load(code))) return false;
    wanted = code;
    saveLanguage(code);
    translatePage();
    document.dispatchEvent(new CustomEvent("ct:languagechange", { detail: { code } }));
    return true;
  }

  // ---------- dev check ----------

  // On localhost, or with ?i18n-check in the address: once everything is loaded (the data files
  // hand over their English last), the console lists the texts the current language is missing.
  // They show in English meanwhile.
  function devCheck() {
    let on = false;
    try {
      on = ["localhost", "127.0.0.1"].includes(location.hostname) || new URLSearchParams(location.search).has("i18n-check");
    } catch {
      on = false;
    }
    if (!on) return;
    window.addEventListener("load", () => {
      const code = current();
      if (code === SOURCE_LANGUAGE) return;
      const missing = Object.keys(I18N_TEXTS.en).filter((key) => lookup(code, key) === undefined);
      if (missing.length) console.warn(`[i18n] ${missing.length} texts missing in "${code}" (shown in English):`, missing);
      else console.info(`[i18n] "${code}" has every text.`);
    });
  }

  // ---------- start ----------

  try {
    document.documentElement.lang = wanted;
    if (wanted !== SOURCE_LANGUAGE && !loaded(wanted) && document.readyState === "loading") {
      document.write(`<script src="${byCode.get(wanted).file}"><\/script>`);
    }
  } catch {
    // no document.write (should never happen in a page's <head>): English
  }
  startTranslatingWhileParsing();
  devCheck();

  return { t, has, localize, source, detect, current, language, formatDate, formatAgo, setLanguage, translateTree, pluralCategory };
})();

const t = I18N.t;
