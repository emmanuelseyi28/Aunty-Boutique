"use client";

import { useEffect, useMemo, useState } from "react";
import { getProductImage } from "@/lib/product-images";
import { normalizeProductCategory, normalizeProductCategoryForMatch } from "@/lib/product-categories";
import { supabase } from "@/lib/supabase/client";

type CollectionKey = "adult" | "kids" | "corporate";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  isExclusive: boolean;
};

const collectionDetails: Record<CollectionKey, { title: string; dataCategory: string; eyebrow: string; description: string }> = {
  adult: {
    title: "Adult Office Wear",
    dataCategory: "Adult Office Wear",
    eyebrow: "POLISHED FOR THE WORKDAY",
    description: "Explore ready-to-wear office styles for a confident, comfortable workday.",
  },
  kids: {
    title: "Kids’ Ready-to-Wear",
    dataCategory: "Kid Ready-to-Wear",
    eyebrow: "LITTLE LOOKS, LOVINGLY MADE",
    description: "Discover children’s ready-to-wear styles for play, parties, and family occasions.",
  },
  corporate: {
    title: "Corporate Wear for All Ages",
    dataCategory: "Adult Outing Wear",
    eyebrow: "TOGETHER IN STYLE",
    description: "Explore adult outing styles for relaxed days, special occasions, and family events.",
  },
};

function matchesCollection(product: { name: string; category: string }, key: CollectionKey) {
  const category = normalizeProductCategoryForMatch(product.category);
  const name = product.name.trim().toLowerCase();
  const isKidsProduct = /^(kids?\b|children\b|child's\b)/.test(name);
  if (key === "adult") return category === "adult office wear" && !isKidsProduct;
  if (key === "kids") return normalizeProductCategory(product.category) === "Kids' Ready-to-Wear";
  return category === "adult outing wear";
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export default function CollectionPage({ collection }: { collection: CollectionKey }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [bag, setBag] = useState<Record<string, number>>({});
  const [bagMessage, setBagMessage] = useState("");
  const details = collectionDetails[collection];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("phunvict-fashion-bag");
      if (stored) setBag(JSON.parse(stored) as Record<string, number>);
    } catch {
      window.localStorage.removeItem("phunvict-fashion-bag");
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setProducts([]);
      setStatus("error");
      return;
    }
    let active = true;
    async function loadProducts() {
      const { data, error } = await supabase!
        .from("products")
        .select("name, description, category, price_ngn, stock_quantity, image_url, is_active, is_exclusive")
        .eq("is_active", true)
        .order("name");
      if (!active) return;
      if (error) {
        setProducts([]);
        setStatus("error");
        return;
      }
      if (!data?.length) {
        setProducts([]);
        setStatus("live");
        return;
      }
      setProducts(data.filter((product) => matchesCollection(product, collection)).map((product) => ({
        id: `${product.name}:${product.category}:${product.image_url}`,
        name: product.name,
        category: normalizeProductCategory(product.category),
        description: product.description ?? "",
        price: Number(product.price_ngn),
        stock: Number(product.stock_quantity),
        image: getProductImage(product.name, product.image_url),
        isExclusive: Boolean(product.is_exclusive),
      })));
      setStatus("live");
    }
    void loadProducts();
    return () => { active = false; };
  }, [collection]);

  const bagCount = useMemo(() => Object.values(bag).reduce((count, quantity) => count + quantity, 0), [bag]);

  function addToBag(product: Product) {
    if (product.stock < 1) return;
    const updated = { ...bag, [product.id]: Math.min((bag[product.id] ?? 0) + 1, product.stock) };
    setBag(updated);
    window.localStorage.setItem("phunvict-fashion-bag", JSON.stringify(updated));
    setBagMessage(`${product.name} added to your bag.`);
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] text-[#30241f]">
      <header className="border-b border-orange-100 bg-white/90 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a href="/" className="text-xl font-bold tracking-tight"><span className="text-[#a35d45]">Phunvict</span> Fashion</a>
          <div className="flex items-center gap-3">
            <a href="/" className="hidden text-sm font-semibold text-[#75453b] sm:block">Back to home</a>
            <a href="/#shop" className="rounded-full bg-[#552d27] px-4 py-2 text-sm font-semibold text-white">Bag ({bagCount})</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <a href="/#shop" className="text-sm font-semibold text-[#75453b]">← Back to Phunvict Fashion</a>
        <div className="mt-7 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a35d45]">{details.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">{details.title}</h1>
          <p className="mt-4 leading-7 text-stone-600">{details.description}</p>
          <p className="mt-3 text-sm text-stone-500" role="status">
            {status === "loading" && "Loading styles…"}
            {status === "live" && "Prices and availability are from the current product collection."}
            {status === "error" && "The live collection could not be loaded. Please try again later."}
          </p>
        </div>

        {bagMessage && <p role="status" className="mt-6 rounded-xl bg-[#f1e0d2] px-4 py-3 text-sm text-[#552d27]">{bagMessage} <a href="/#shop" className="ml-2 font-semibold underline underline-offset-4">View bag</a></p>}

        {products.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
                {product.image ? <img src={product.image} alt={product.name} className="h-48 w-full bg-stone-100 object-cover md:h-72" /> : <div className="flex h-48 items-center justify-center bg-[#f4e9e1] px-4 text-center text-sm text-stone-600 md:h-72">Product photo coming soon</div>}
                <div className="p-3 md:p-5">
                  <p className="text-xs text-stone-500">{product.category}</p>
                  <h2 className="mt-1 font-semibold">{product.name}</h2>
                  {product.description && <p className="mt-2 text-sm leading-5 text-stone-600">{product.description}</p>}
                  {product.isExclusive && <span className="mt-2 inline-block rounded-full bg-[#fff0d7] px-2 py-1 text-xs font-semibold text-[#75453b]">Members only</span>}
                  <p className="mt-3 font-bold">{formatMoney(product.price)}</p>
                  <p className={`mt-1 text-xs ${product.stock > 0 ? "text-green-700" : "text-red-600"}`}>{product.stock > 0 ? `${product.stock} available` : "Currently unavailable"}</p>
                  <button type="button" disabled={product.stock < 1} onClick={() => addToBag(product)} className="mt-4 w-full rounded-xl bg-[#552d27] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300">{product.stock > 0 ? "Add to bag" : "Sold out"}</button>
                </div>
              </article>
            ))}
          </div>
        ) : status !== "loading" && (
          <div className="mt-8 rounded-3xl border border-orange-100 bg-white p-8 text-center">
            <h2 className="text-2xl font-bold">This collection is being prepared</h2>
            <p className="mx-auto mt-3 max-w-xl leading-6 text-stone-600">There aren’t any active products in the <strong>{details.dataCategory}</strong> category yet. Add or update products with this category in Supabase, then they’ll appear here with their prices.</p>
            <a href="/" className="mt-6 inline-block rounded-full bg-[#552d27] px-6 py-3 font-semibold text-white">Return to the shop</a>
          </div>
        )}
      </section>

      <footer className="bg-[#552d27] px-5 py-7 text-center text-sm text-orange-100">
        <p className="font-semibold text-white">Phunvict Fashion</p>
        <p className="mt-2">Beautifully made, thoughtfully worn.</p>
      </footer>
    </main>
  );
}
