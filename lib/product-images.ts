const productImageOverrides: Record<string, string> = {
  "men's boxer shorts": "/products/mens-boxer-shorts.jpeg",
  "women's comfort bra": "/products/womens-comfort-bra.jpeg",
  "women's everyday briefs": "/products/womens-everyday-briefs.jpeg",
  "women's office dress": "/products/womens-office-dress.jpg",
  "kids' smart two-piece set": "/products/kids-two-piece-set.jpeg",
  "kids' two-piece set": "/products/kids-two-piece-set.jpeg",
};

export function getProductImage(name: string, imageUrl?: string | null) {
  return productImageOverrides[name.trim().toLowerCase()] ?? imageUrl ?? "";
}
