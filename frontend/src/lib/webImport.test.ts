import { expect, test } from 'vitest';
import {
  recipeLink,
  readyIngredient,
  reviewIngredients,
  webImportError,
} from './webImport';
import { webDraft } from '../test/webDraft';

test.each([
  'https://instagram.com/p/x',
  'https://www.facebook.com/share/x',
  'https://fb.watch/x',
])('link społecznościowy %s', (url) =>
  expect(recipeLink(url)?.kind).toBe('social'),
);
test.each([
  'https://recipes.example/zupa',
  'http://recipes.example',
  'https://instagram.com.evil.example/x',
])('strona %s', (url) => expect(recipeLink(url)?.kind).toBe('web'));
test.each([
  'tekst',
  'javascript:alert(1)',
  'ftp://example.com',
  'https://user:pass@example.com',
  'https://example.com:444/x',
  'http://instagram.com/x',
  'https://exam ple.com',
  'https:example.com',
])('błędny adres %s', (url) => expect(recipeLink(url)).toBeNull());
test('gotowość składników wymaga zatwierdzenia, jednostki i dodatniej ilości', () => {
  const rows = reviewIngredients(webDraft);
  expect(readyIngredient(rows[0])).toBe(true);
  expect(readyIngredient(rows[1])).toBe(false);
  expect(
    readyIngredient({ ...rows[0], match: 'fuzzy', confirmed: false }),
  ).toBe(false);
  expect(readyIngredient({ ...rows[0], unit_ok: false })).toBe(false);
  expect(readyIngredient({ ...rows[0], qty: null })).toBe(false);
  expect(readyIngredient({ ...rows[0], unit: 'do smaku', qty: null })).toBe(
    true,
  );
});
test.each([
  'unsupported_url',
  'blocked_host',
  'fetch_failed',
  'timeout',
  'too_large',
  'no_recipe',
])('polski komunikat %s', (code) =>
  expect(webImportError(code)).not.toBe(code),
);
