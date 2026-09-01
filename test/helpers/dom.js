import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export function loadFixture(name) {
  const html = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return new JSDOM(html).window.document;
}

export function loadHtml(html) {
  return new JSDOM(html).window.document;
}
