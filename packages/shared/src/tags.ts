export const TAG_REGEX = /^[0289PYLQGRJCUV]{3,14}$/;

export function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^%23/i, '')
    .replace(/^#/, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/O/g, '0');
}

export function isValidTag(tag: string): boolean {
  return TAG_REGEX.test(tag);
}

export function parseTag(input: string): string | null {
  const tag = normalizeTag(input);
  return isValidTag(tag) ? tag : null;
}
