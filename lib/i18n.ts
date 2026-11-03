import { en } from './locales/en';
import { vi } from './locales/vi';
import { zh, type MessageKey } from './locales/zh';
import type { NotationStyle } from './notation';
import { NAME, REASON } from './tokens';
import type { Piece, Side } from './xiangqi';

/** Pure locale core: no DOM, no React, no current-language global. Every function takes
 * the locale it should speak. To add a language, add `lib/locales/<code>.ts` (typed against
 * `MessageKey`, so a missing string fails `typecheck`), then list it in `LOCALES`
 * and `BUNDLES` below.
 */
export type Locale = 'zh' | 'en' | 'vi';
export type { MessageKey };
export type Params = Record<string, string | number>;
export type LocaleMeta = {
  /** The language's own name, shown in the language menu. */
  name: string;
  /** `<html lang>` and the tag handed to `Intl`. */
  htmlLang: string;
  intl: string;
  dateOptions?: Intl.DateTimeFormatOptions;
  /** How moves are written when this language is chosen. */
  notation: NotationStyle;
};
export type LocaleBundle = {
  meta: LocaleMeta;
  messages: Record<MessageKey, string>;
};
const BUNDLES: Record<Locale, LocaleBundle> = { zh, en, vi };
export const LOCALES: readonly Locale[] = ['zh', 'en', 'vi'];
export const DEFAULT_LOCALE: Locale = 'zh';
export const LOCALE_STORAGE_KEY = 'chuhan-locale';

export const localeMeta = (locale: Locale): LocaleMeta => BUNDLES[locale].meta;
export const notationFor = (locale: Locale): NotationStyle =>
  BUNDLES[locale].meta.notation;

/** `{name}` placeholders are replaced; one that has no parameter stays visible. */
export function t(locale: Locale, key: MessageKey, params?: Params): string {
  const template = BUNDLES[locale].messages[key];
  return params
    ? template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in params ? String(params[name]) : whole,
      )
    : template;
}
/** Keys that come in `<base>.one` / `<base>.other` pairs, picked by the locale's plural rules. */
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer Base}.other`
    ? Base
    : never
  : never;
export function tn(
  locale: Locale,
  key: PluralKey,
  count: number,
  params?: Params,
): string {
  const category =
    new Intl.PluralRules(localeMeta(locale).intl).select(count) === 'one'
      ? 'one'
      : 'other';
  return t(locale, `${key}.${category}` as MessageKey, { n: count, ...params });
}
export const hasMessage = (key: string): key is MessageKey =>
  Object.hasOwn(zh.messages, key);

/** What `navigator.languages` says: the first choice's language when we speak it (any
 * Chinese reads Chinese, `vi-VN` reads Vietnamese), everyone else English. */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  const first = languages?.find(Boolean);
  return parseLocale(first?.split('-')[0].toLowerCase()) ?? 'en';
}
export const parseLocale = (value: unknown): Locale | null =>
  LOCALES.find((locale) => locale === value) ?? null;
/** The saved choice, else the browser's language. Storage may be missing or throw. */
export function loadLocale(
  storage: Pick<Storage, 'getItem'> | null,
  languages: readonly string[] | undefined,
): Locale {
  try {
    const saved = parseLocale(storage?.getItem(LOCALE_STORAGE_KEY));
    if (saved) return saved;
  } catch {}
  return detectLocale(languages);
}
export function saveLocale(
  storage: Pick<Storage, 'setItem'> | null,
  locale: Locale,
): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
}

export const sideName = (locale: Locale, side: Side) =>
  t(locale, side === 'red' ? 'side.red' : 'side.black');
/** Red / 红 where the Chinese drops the 方 (红胜, 红车). */
export const sideShort = (locale: Locale, side: Side) =>
  t(locale, side === 'red' ? 'side.red.short' : 'side.black.short');

/** The piece alone: Chariot, or the glyph the Chinese side calls it. */
export const pieceName = (locale: Locale, piece: Piece) =>
  t(locale, `piece.${piece.side}.${piece.kind}` as MessageKey);
/** With its side: Red Chariot, 红車. */
export const sidePieceName = (locale: Locale, piece: Piece) =>
  t(locale, 'piece.named', {
    side: sideShort(locale, piece.side),
    piece: pieceName(locale, piece),
  });

const REASON_KEYS: Record<string, MessageKey> = {
  [REASON.mate]: 'reason.mate',
  [REASON.stalemate]: 'reason.stalemate',
  [REASON.timeout]: 'reason.timeout',
  [REASON.perpetual]: 'reason.perpetual',
  [REASON.agreed]: 'reason.agreed',
  [REASON.repetition]: 'reason.repetition',
  [REASON.quiet]: 'reason.quiet',
  [REASON.resigned.red]: 'reason.resigned.red',
  [REASON.resigned.black]: 'reason.resigned.black',
};
/** A stored `Result.reason` in the viewer's language; one this version does not know stays as stored. */
export function reasonText(locale: Locale, reason: string): string {
  return Object.hasOwn(REASON_KEYS, reason)
    ? t(locale, REASON_KEYS[reason])
    : reason;
}

const NAME_KEYS: Record<string, MessageKey> = {
  [NAME.player]: 'name.player',
  [NAME.me]: 'name.me',
  [NAME.ai]: 'name.ai',
};
/** Default names are stored as Chinese tokens; a name someone typed is never touched. */
export function playerName(locale: Locale, name: string): string {
  return Object.hasOwn(NAME_KEYS, name) ? t(locale, NAME_KEYS[name]) : name;
}

export function formatDateTime(locale: Locale, iso: string | number): string {
  const { intl, dateOptions } = localeMeta(locale);
  return new Date(iso).toLocaleString(intl, dateOptions);
}
