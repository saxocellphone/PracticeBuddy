/** Merge two CSS module objects, concatenating class names for keys that exist in both. */
export function mergeStyles(base: Record<string, string>, overrides: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = { ...base }
  for (const key in overrides) {
    merged[key] = merged[key] ? `${merged[key]} ${overrides[key]}` : overrides[key]
  }
  return merged
}
