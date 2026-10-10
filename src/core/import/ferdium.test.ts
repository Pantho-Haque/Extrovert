import { describe, expect, it } from 'vitest';
import { parseFerdiumExport } from './ferdium';

describe('parseFerdiumExport', () => {
  it('maps known recipes and keeps custom names as labels', () => {
    const json = JSON.stringify({
      services: [
        { recipeId: 'whatsapp', name: 'WhatsApp' },
        { recipeId: 'whatsapp', name: 'Business' },
        { recipeId: 'gmail', name: 'Gmail' },
        { recipeId: 'hangoutschat', name: 'Chat' },
        { recipeId: 'custom-website', name: 'Telegram', customUrl: 'https://web.telegram.org/k/' },
        { recipeId: 'some-unknown-thing', name: 'Mystery' },
      ],
    });
    expect(parseFerdiumExport(json)).toEqual({
      services: [
        { type: 'whatsapp' },
        { type: 'whatsapp', label: 'Business' },
        { type: 'gmail' },
        { type: 'chat' },
        { type: 'custom', url: 'https://web.telegram.org/k/', label: 'Telegram' },
      ],
      skipped: ['Mystery'],
    });
  });

  it('explains files that are not Ferdium exports', () => {
    expect(() => parseFerdiumExport('not json')).toThrow('valid JSON');
    expect(() => parseFerdiumExport('{"foo":1}')).toThrow('no services list');
  });
});
