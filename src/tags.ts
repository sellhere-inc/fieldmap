export function tagKey(tag: string): string {
  return tag.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Selecting several tags shows pins with any of them. No selection shows all. */
export function matchesTags(tags: string[], selected: string[]): boolean {
  const keys = new Set(selected.map(tagKey));
  return keys.size === 0 || tags.some((tag) => keys.has(tagKey(tag)));
}

export function cleanTags(tags: string[], existing: string[] = []): string[] {
  const known = new Map(existing.map((tag) => [tagKey(tag), tag]));
  const result = new Map<string, string>();
  for (const input of tags) {
    const label = input.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!label) continue;
    if (label.length > 64) throw new Error('Keep each tag to 64 characters or fewer.');
    const key = tagKey(label);
    if (!result.has(key)) result.set(key, known.get(key) ?? label);
  }
  return [...result.values()];
}
