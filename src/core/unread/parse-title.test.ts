import { describe, expect, it } from 'vitest';
import { parseUnread } from './parse-title';
import { catalog } from '../services/catalog';

const gmail = catalog.find((s) => s.id === 'gmail')!.unreadPattern;

describe('parseUnread', () => {
  it.each([
    ['(3) Facebook', 3],
    ['(12) WhatsApp', 12],
    ['(5) Feed | LinkedIn', 5],
    ['(99+) Messenger', 99],
    ['(1,204) Facebook', 1204],
    ['  (2) Instagram  ', 2],
    ['Facebook', 0],
    ['WhatsApp', 0],
    ['', 0],
  ])('default rule: %j → %i', (title, expected) => {
    expect(parseUnread(title)).toBe(expected);
  });

  it('default rule ignores numbers that are not a leading count', () => {
    expect(parseUnread('Weekend Hike (2026) | Facebook')).toBe(0);
  });

  it.each([
    ['Inbox (4) - you@gmail.com - Gmail', 4],
    ['Inbox (1,032) - you@gmail.com - Gmail', 1032],
    ['Inbox - you@gmail.com - Gmail', 0],
  ])('gmail rule: %j → %i', (title, expected) => {
    expect(parseUnread(title, gmail)).toBe(expected);
  });
});
