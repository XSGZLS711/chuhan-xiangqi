import {
  hasMessage,
  t,
  type Locale,
  type MessageKey,
  type Params,
} from './i18n';

/** `err.<code>` entries of the dictionary. A code is stable: the server sends it with the
 * Chinese text, and the client shows the entry in the viewer's language.
 */
export type ErrorCode = MessageKey extends infer K
  ? K extends `err.${infer C}`
    ? C
    : never
  : never;

/** An error a person can see. `message` stays Chinese: that is what API responses carry in
 * `error` for readers that predate the codes.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params?: Params,
  ) {
    super(t('zh', `err.${code}` as MessageKey, params));
  }
}

/** The JSON an API answers an error with: the Chinese text readers already know, and the code. */
export const errorBody = (code: ErrorCode, params?: Params) => ({
  error: t('zh', `err.${code}` as MessageKey, params),
  code,
});

/** What state and props hold about a failure: the code to render, the text to fall back on. */
export type ErrorInfo = { code?: string; params?: Params; message: string };

/** Any thrown value as an `ErrorInfo`. A value that is not an `Error` uses `fallback`. */
export function errorInfo(error: unknown, fallback: ErrorCode): ErrorInfo {
  if (error instanceof Error && error.message) {
    const { code, params } = error as Error & {
      code?: unknown;
      params?: Params;
    };
    return typeof code === 'string'
      ? { code, params, message: error.message }
      : { message: error.message };
  }
  return { code: fallback, message: t('zh', `err.${fallback}` as MessageKey) };
}

/** The code in the viewer's language; a code this version does not know shows the server's text. */
export function errorText(locale: Locale, info: ErrorInfo): string {
  const key = `err.${info.code}`;
  return info.code && hasMessage(key)
    ? t(locale, key, info.params)
    : info.message;
}
