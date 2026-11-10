import { enDictionary, enPatterns } from "./dictionary.js";
import { enContentDictionary, enContentPatterns } from "./contentDictionary.js";
const mergedDictionary = { ...enDictionary, ...enContentDictionary };
const mergedPatterns = [...enContentPatterns, ...enPatterns];
const STORAGE_KEY = "datsanbmt:language";
const TRANSLATED_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const textEntries = /* @__PURE__ */ new WeakMap();
const attributeEntries = /* @__PURE__ */ new WeakMap();
let currentLanguage = "vi";
let observer = null;
let frameId = 0;
let applying = false;
let titleSource = null;
let titleApplied = "";
const normalize = (value) => value.replace(/\s+/g, " ").trim();
const MONEY_PATTERN = /(\d{1,3}(?:\.\d{3})+|\d+)\s*đ/g;
const localizeDynamicText = (value) => {
  const withMoney = value.replace(MONEY_PATTERN, (match, digits) => {
    const amount = Number(digits.replace(/\./g, ""));
    if (!Number.isFinite(amount)) return match;
    return `${amount.toLocaleString("en-US")} VND`;
  });
  return withMoney.replace(/\/giờ/g, "/hour");
};
const translateValue = (source) => {
  const key = normalize(source);
  if (!key) return source;
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  const hit = mergedDictionary[key];
  if (hit) return `${leading}${localizeDynamicText(hit)}${trailing}`;
  for (let index = 0; index < mergedPatterns.length; index += 1) {
    const rule = mergedPatterns[index];
    if (rule.pattern.test(key)) {
      return `${leading}${localizeDynamicText(key.replace(rule.pattern, rule.replace))}${trailing}`;
    }
  }
  return localizeDynamicText(source);
};
const SKIP_TAGS = ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"];
const applyTextNode = (node, language) => {
  const value = node.nodeValue;
  if (value === null || !value.trim()) return;
  const parent = node.parentElement;
  if (parent && SKIP_TAGS.includes(parent.tagName)) return;
  let entry = textEntries.get(node);
  if (!entry || value !== entry.source && value !== entry.output) {
    entry = { source: value, output: translateValue(value) };
    textEntries.set(node, entry);
  }
  const target = language === "en" ? entry.output : entry.source;
  if (node.nodeValue !== target) {
    node.nodeValue = target;
  }
};
const applyAttribute = (element, attribute, language) => {
  const value = element.getAttribute(attribute);
  if (value === null || !value.trim()) return;
  let entries = attributeEntries.get(element);
  if (!entries) {
    entries = {};
    attributeEntries.set(element, entries);
  }
  let entry = entries[attribute];
  if (!entry || value !== entry.source && value !== entry.output) {
    entry = { source: value, output: translateValue(value) };
    entries[attribute] = entry;
  }
  const target = language === "en" ? entry.output : entry.source;
  if (value !== target) {
    element.setAttribute(attribute, target);
  }
};
const applyDocumentTitle = (language) => {
  const current = document.title;
  if (titleSource === null || current !== titleSource && current !== titleApplied) {
    titleSource = current;
  }
  const output = translateValue(titleSource);
  const target = language === "en" ? output : titleSource;
  titleApplied = target;
  if (document.title !== target) {
    document.title = target;
  }
};
const runPass = () => {
  if (typeof document === "undefined" || !document.body) return;
  applying = true;
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      applyTextNode(node, currentLanguage);
      node = walker.nextNode();
    }
    const elements = document.body.querySelectorAll("*");
    elements.forEach((element) => {
      TRANSLATED_ATTRIBUTES.forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          applyAttribute(element, attribute, currentLanguage);
        }
      });
    });
    applyDocumentTitle(currentLanguage);
  } finally {
    applying = false;
  }
};
const schedulePass = () => {
  if (frameId) return;
  frameId = window.requestAnimationFrame(() => {
    frameId = 0;
    runPass();
  });
};
const getStoredLanguage = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "vi") return saved;
  } catch {
  }
  return "vi";
};
const persistLanguage = (language) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
  }
};
const applyLanguage = (language) => {
  currentLanguage = language;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", language === "vi" ? "vi" : "en");
  }
  runPass();
};
const watchDomChanges = () => {
  if (observer || typeof document === "undefined" || !document.body) return;
  observer = new MutationObserver(() => {
    if (!applying) schedulePass();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
};
const initDomLanguage = () => {
  const language = getStoredLanguage();
  applyLanguage(language);
  watchDomChanges();
  return language;
};
export {
  applyLanguage,
  getStoredLanguage,
  initDomLanguage,
  persistLanguage,
  watchDomChanges
};
