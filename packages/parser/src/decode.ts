/**
 * Turn raw GEDCOM bytes into text. A BOM wins; otherwise valid UTF-8 is taken
 * as UTF-8 whatever HEAD.CHAR claims (exporters mislabel it often), and only
 * bytes that are not UTF-8 fall back to the declared ANSEL or ANSI/CP1252.
 */
export function decodeGedcom(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const [b0, b1, b2] = bytes;
  if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  // UTF-16 with a BOM, or without one: every file starts with an ASCII "0".
  if ((b0 === 0xff && b1 === 0xfe) || (b0 === 0x30 && b1 === 0)) return new TextDecoder('utf-16le').decode(bytes);
  if ((b0 === 0xfe && b1 === 0xff) || (b0 === 0 && b1 === 0x30)) return new TextDecoder('utf-16be').decode(bytes);

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
    const char = head.match(/^\s*1\s+CHAR\s+(\S+)/m)?.[1]?.toUpperCase();
    return char === 'ANSEL' ? decodeAnsel(bytes) : new TextDecoder('windows-1252').decode(bytes);
  }
}

// ANSEL (Z39.47) spacing characters, plus the GEDCOM 5.5.1 additions.
const ANSEL_SPACING: Record<number, string> = {
  0xa1: 'Ł', 0xa2: 'Ø', 0xa3: 'Đ', 0xa4: 'Þ', 0xa5: 'Æ', 0xa6: 'Œ', 0xa7: 'ʹ', 0xa8: '·',
  0xa9: '♭', 0xaa: '®', 0xab: '±', 0xac: 'Ơ', 0xad: 'Ư', 0xae: 'ʼ', 0xb0: 'ʻ', 0xb1: 'ł',
  0xb2: 'ø', 0xb3: 'đ', 0xb4: 'þ', 0xb5: 'æ', 0xb6: 'œ', 0xb7: 'ʺ', 0xb8: 'ı', 0xb9: '£',
  0xba: 'ð', 0xbc: 'ơ', 0xbd: 'ư', 0xbe: '□', 0xbf: '■', 0xc0: '°', 0xc1: 'ℓ', 0xc2: '℗',
  0xc3: '©', 0xc4: '♯', 0xc5: '¿', 0xc6: '¡', 0xc7: 'ß', 0xc8: '€', 0xcf: 'ß',
};

// ANSEL combining marks come before their base letter; Unicode wants them after.
const ANSEL_COMBINING: Record<number, number> = {
  0xe0: 0x309, 0xe1: 0x300, 0xe2: 0x301, 0xe3: 0x302, 0xe4: 0x303, 0xe5: 0x304, 0xe6: 0x306,
  0xe7: 0x307, 0xe8: 0x308, 0xe9: 0x30c, 0xea: 0x30a, 0xeb: 0xfe20, 0xec: 0xfe21, 0xed: 0x315,
  0xee: 0x30b, 0xef: 0x310, 0xf0: 0x327, 0xf1: 0x328, 0xf2: 0x323, 0xf3: 0x324, 0xf4: 0x325,
  0xf5: 0x333, 0xf6: 0x332, 0xf7: 0x326, 0xf8: 0x31c, 0xf9: 0x32e, 0xfa: 0xfe22, 0xfb: 0xfe23,
  0xfe: 0x313,
};

function decodeAnsel(bytes: Uint8Array): string {
  let out = '';
  let marks = '';
  for (const b of bytes) {
    const mark = ANSEL_COMBINING[b];
    if (mark) {
      marks += String.fromCharCode(mark);
      continue;
    }
    out += (b < 0x80 ? String.fromCharCode(b) : ANSEL_SPACING[b] ?? '�') + marks;
    marks = '';
  }
  return (out + marks).normalize('NFC');
}
