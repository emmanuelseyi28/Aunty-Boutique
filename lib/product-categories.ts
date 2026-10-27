export function normalizeProductCategoryForMatch(category: string) {
  return category
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeProductCategory(category: string) {
  const normalized = normalizeProductCategoryForMatch(category);

  if (/^kids?'?\s+ready\s+to\s+wear$/.test(normalized)) {
    return "Kids' Ready-to-Wear";
  }

  return category.trim();
}
