export type SampleProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  image: string;
};

// These are illustrative home-page items used only when Supabase has no active
// products. The admin page can import them as unavailable drafts for review.
export const homePageSampleProducts: SampleProduct[] = [
  { id: "demo-1", name: "Unisex Wear", category: "Adult Office Wear", price: 100000, stock: 12, color: "Navy", image: "/products/mens-boxer-shorts.jpeg" },
  { id: "demo-2", name: "Women's Everyday Briefs", category: "Adult Office Wear", price: 6500, stock: 10, color: "Black", image: "/products/womens-everyday-briefs.jpeg" },
  { id: "demo-3", name: "Unisex Comfort Outing Wear", category: "Adult Outing Wear", price: 12000, stock: 8, color: "Nude", image: "/products/womens-comfort-bra.jpeg" },
  { id: "demo-4", name: "Women's Office Dress", category: "Adult Office Wear", price: 25000, stock: 5, color: "Wine", image: "/products/womens-office-dress.jpg" },
  { id: "demo-5", name: "Men's Office Shirt and Trousers", category: "Adult Office Wear", price: 28000, stock: 6, color: "Navy", image: "" },
  { id: "demo-6", name: "Kids' Two-Piece Set", category: "Kids' Ready-to-Wear", price: 18000, stock: 5, color: "Multicolor", image: "/products/kids-two-piece-set.jpeg" },
];
