"use client";

import { type FormEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { getProductImage } from "@/lib/product-images";
import { normalizeProductCategory } from "@/lib/product-categories";
import { homePageSampleProducts } from "@/lib/sample-products";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  image: string;
  isExclusive?: boolean;
};

const products: Product[] = homePageSampleProducts;

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

export default function Home() {
  const [catalog, setCatalog] = useState(products);
  const [catalogStatus, setCatalogStatus] = useState<"demo" | "loading" | "connected" | "empty" | "error">(
    isSupabaseConfigured ? "loading" : "demo"
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [addedMessage, setAddedMessage] = useState("");
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [memberDialog, setMemberDialog] = useState(false);
  const [memberMode, setMemberMode] = useState<"signup" | "login">("signup");
  const [accountView, setAccountView] = useState<"profile" | "edit" | "password">("profile");
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");
  const [membershipNotice, setMembershipNotice] = useState("");
  const [memberForm, setMemberForm] = useState({ fullName: "", phone: "", email: "", address: "", username: "", password: "", confirmPassword: "" });
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [memberProfile, setMemberProfile] = useState({ fullName: "", phone: "", email: "", address: "", username: "", avatarPath: "" });
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => {
    try {
      const savedCart = window.localStorage.getItem("phunvict-fashion-bag");
      if (savedCart) setCart(JSON.parse(savedCart) as Record<string, number>);
    } catch {
      window.localStorage.removeItem("phunvict-fashion-bag");
    } finally {
      setCartLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (cartLoaded) {
      window.localStorage.setItem("phunvict-fashion-bag", JSON.stringify(cart));
    }
  }, [cart, cartLoaded]);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSessionEmail(data.session?.user.email ?? null);
        setSessionUserId(data.session?.user.id ?? null);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setSessionUserId(session?.user.id ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !sessionUserId) return;
    let active = true;
    setProfileLoading(true);
    setMemberProfile({ fullName: "", phone: "", email: sessionEmail ?? "", address: "", username: "", avatarPath: "" });
    setProfileAvatarUrl("");
    async function loadProfile() {
      const { data, error } = await supabase!
        .from("profiles")
        .select("full_name, phone, home_address, username, avatar_path")
        .eq("id", sessionUserId)
        .single();
      if (!active) return;
      if (error) {
        setMemberMessage(`Could not load your profile: ${error.message}`);
        setProfileLoading(false);
        return;
      }
      const profile = {
        fullName: data.full_name ?? "",
        phone: data.phone ?? "",
        email: sessionEmail ?? "",
        address: data.home_address ?? "",
        username: data.username ?? "",
        avatarPath: data.avatar_path ?? "",
      };
      setMemberProfile(profile);
      setCustomer({
        name: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
      });
      setMemberMessage("");
      if (profile.avatarPath) {
        const { data: signedImage } = await supabase!.storage
          .from("member-avatars")
          .createSignedUrl(profile.avatarPath, 60 * 60);
        if (active) setProfileAvatarUrl(signedImage?.signedUrl ?? "");
      } else {
        setProfileAvatarUrl("");
      }
      if (active) setProfileLoading(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, [sessionUserId, sessionEmail]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    async function loadProducts() {
      let productQuery = supabase!
        .from("products")
        .select("name, category, price_ngn, stock_quantity, image_url, is_active, is_exclusive")
        .eq("is_active", true);

      // A visitor without a signed-in member session should never request
      // members-only catalog rows, even if a Supabase policy is misconfigured.
      if (!sessionEmail) productQuery = productQuery.eq("is_exclusive", false);
      const { data, error } = await productQuery.order("name");

      if (!active) return;
      if (error) {
        setCatalog(products);
        setCatalogStatus("error");
        return;
      }

      if (!data?.length) {
        setCatalog(products);
        setCatalogStatus("empty");
        return;
      }

      const savedProducts: Product[] = (data ?? []).map((product) => ({
          id: `${product.name}:${product.category}:${product.image_url}`,
          name: product.name,
          category: normalizeProductCategory(product.category),
          price: Number(product.price_ngn),
          stock: Number(product.stock_quantity),
          color: "Multicolor",
          image: getProductImage(product.name, product.image_url),
          isExclusive: Boolean(product.is_exclusive),
        }));

      // Keep the home-page examples in place while the store owner gradually
      // adds the real catalog. A saved product replaces its matching example;
      // other examples remain visible instead of disappearing when the first
      // Supabase product is activated.
      const savedNames = new Set(savedProducts.map((product) => product.name.trim().toLocaleLowerCase()));
      const remainingSamples = products.filter(
        (product) => !savedNames.has(product.name.trim().toLocaleLowerCase())
      );
      setCatalog([...savedProducts, ...remainingSamples]);
      setCatalogStatus("connected");
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, [sessionEmail]);

  async function submitMemberForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMemberMessage("Supabase is not connected yet. Add your Supabase settings first.");
      return;
    }
    setMemberBusy(true);
    setMemberMessage("");
    try {
      if (memberMode === "signup") {
        if (memberForm.password !== memberForm.confirmPassword) {
          setMemberMessage("The two passwords do not match. Please check and try again.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: memberForm.email.trim(),
          password: memberForm.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: memberForm.fullName.trim(),
              phone: memberForm.phone.trim(),
              home_address: memberForm.address.trim(),
              username: memberForm.username.trim(),
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          setSessionEmail(data.session.user.email ?? null);
          setSessionUserId(data.session.user.id);
          setMemberDialog(false);
        } else {
          setMemberMessage("Membership created. Please check your email and confirm your address, then sign in here.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: memberForm.email.trim(),
          password: memberForm.password,
        });
        if (error) throw error;
        setSessionEmail(data.user.email ?? null);
        setSessionUserId(data.user.id);
        setMemberForm((current) => ({ ...current, password: "", confirmPassword: "" }));
        setMemberDialog(false);
      }
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "We could not complete that request. Please try again.");
    } finally {
      setMemberBusy(false);
    }
  }

  async function saveMemberProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !sessionUserId) return;
    setMemberBusy(true);
    setMemberMessage("");
    const { error } = await supabase.from("profiles").update({
      full_name: memberProfile.fullName.trim(),
      phone: memberProfile.phone.trim(),
      home_address: memberProfile.address.trim(),
      username: memberProfile.username.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", sessionUserId);
    setMemberBusy(false);
    if (error) setMemberMessage(error.message);
    else {
      setCustomer({ name: memberProfile.fullName.trim(), phone: memberProfile.phone.trim(), email: sessionEmail ?? "", address: memberProfile.address.trim() });
      setAccountView("profile");
      setMemberMessage("Your profile details have been saved.");
    }
  }

  function exploreExclusiveStyles(event: MouseEvent<HTMLAnchorElement>) {
    if (!sessionEmail) {
      event.preventDefault();
      setMemberMode("signup");
      setMemberMessage("");
      setMembershipNotice("These styles are reserved for members. Become a member or sign in to view the exclusive collection.");
      setMemberDialog(true);
    }
  }

  async function changeMemberPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword !== confirmNewPassword) {
      setMemberMessage("The two passwords do not match. Please check and try again.");
      return;
    }
    setMemberBusy(true);
    setMemberMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMemberBusy(false);
    if (error) setMemberMessage(error.message);
    else {
      setNewPassword("");
      setConfirmNewPassword("");
      setAccountView("profile");
      setMemberMessage("Your password has been changed.");
    }
  }

  async function uploadMemberAvatar(file?: File) {
    if (!supabase || !sessionUserId || !file) return;
    setMemberMessage("");
    if (!file.type.startsWith("image/")) {
      setMemberMessage("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMemberMessage("Please choose an image smaller than 5 MB.");
      return;
    }
    setMemberBusy(true);
    const avatarPath = `${sessionUserId}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from("member-avatars")
      .upload(avatarPath, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (uploadError) {
      setMemberBusy(false);
      setMemberMessage(uploadError.message);
      return;
    }
    const { error: profileError } = await supabase.from("profiles")
      .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
      .eq("id", sessionUserId);
    if (profileError) {
      setMemberBusy(false);
      setMemberMessage(profileError.message);
      return;
    }
    const { data: signedImage } = await supabase.storage.from("member-avatars").createSignedUrl(avatarPath, 60 * 60);
    setProfileAvatarUrl(signedImage?.signedUrl ?? "");
    setMemberProfile((current) => ({ ...current, avatarPath }));
    setMemberBusy(false);
    setMemberMessage("Your profile photo has been updated.");
  }

  async function signOutMember() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMemberMessage(error.message);
    else {
      setSessionEmail(null);
      setSessionUserId(null);
      setMemberDialog(false);
      setMemberMessage("You are signed out.");
    }
  }

  const categories = [
    "All",
    ...Array.from(new Set(catalog.map((p) => normalizeProductCategory(p.category)))),
  ];

  const filtered = useMemo(
    () =>
      catalog.filter((p) => {
        const matchesSearch = p.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory =
          category === "All" || normalizeProductCategory(p.category) === category;
        return matchesSearch && matchesCategory;
      }),
    [catalog, search, category]
  );

  const cartItems = catalog.filter((p) => (cart[p.id] ?? 0) > 0);
  const itemCount = cartItems.reduce((count, p) => count + cart[p.id], 0);
  const total = cartItems.reduce(
    (sum, p) => sum + p.price * cart[p.id],
    0
  );
  const memberDeliveryReady = Boolean(
    memberProfile.fullName && memberProfile.phone && sessionEmail && memberProfile.address
  );

  function addToCart(product: Product) {
    if (product.stock < 1) return;

    setCart((current) => ({
      ...current,
      [product.id]: Math.min(
        (current[product.id] ?? 0) + 1,
        product.stock
      ),
    }));
    setAddedMessage(`${product.name} added to your bag.`);
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] text-[#30241f]">
      <div className="bg-[#552d27] px-4 py-2 text-center text-sm text-white">
        We sew and sell ready-to-wear and corporate wear for kids and adults.
      </div>

      <header className="sticky top-0 z-10 border-b border-orange-100 bg-[#fffaf5]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a href="#" className="text-xl font-bold tracking-tight">
            <span className="text-[#a35d45]">Phunvict</span> Fashion
          </a>
          <div className="flex items-center gap-2">
            {sessionEmail ? (
              <>
                <button type="button" onClick={() => { setAccountView("profile"); setMemberDialog(true); setMemberMessage(""); }} className="rounded-full border border-orange-200 px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm">My account</button>
                <button type="button" onClick={() => void signOutMember()} className="hidden text-sm text-stone-600 sm:block">Sign out</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setMemberMode("signup"); setMemberMessage(""); setMembershipNotice(""); setMemberDialog(true); }} className="rounded-full border border-[#552d27] px-3 py-2 text-xs font-semibold text-[#552d27] sm:px-4 sm:text-sm">Become a member</button>
                <button type="button" onClick={() => { setMemberMode("login"); setMemberMessage(""); setMembershipNotice(""); setMemberDialog(true); }} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#552d27] sm:block">Sign in</button>
              </>
            )}
            <button
              onClick={() => {
                setCheckoutOpen(false);
                setCartOpen(true);
              }}
              className="rounded-full bg-[#552d27] px-4 py-2 text-sm font-semibold text-white"
            >
              Bag ({itemCount})
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#a35d45]">
            Sewn with care. Styled for you.
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Ready to wear.
            <br />
            <span className="text-[#a35d45]">Made to fit.</span>
          </h1>
          <p className="mt-5 max-w-lg leading-7 text-stone-600">
            From polished office outfits to smart kids' styles, discover ready-to-wear
            pieces and custom corporate looks for the whole family.
          </p>
          <a
            href="#shop"
            className="mt-7 inline-block rounded-full bg-[#552d27] px-7 py-3 font-semibold text-white hover:bg-[#75453b]"
          >
            Shop the collection
          </a>
        </div>

        <div className="rounded-3xl bg-[#f1e0d2] p-4">
          <img
            src="/products/hero-black-office-set.jpeg"
            alt="Black office outfit from Phunvict Fashion"
            className="h-72 w-full rounded-2xl object-cover md:h-96"
          />
          <p className="px-2 pb-1 pt-4 text-center text-sm text-stone-600">
            We sew &amp; sell ready-to-wear.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a35d45]">
            MADE FOR EVERY DAY
          </p>
          <h2 className="mt-2 text-3xl font-bold">Find your kind of fit</h2>
          <p className="mt-3 leading-7 text-stone-600">
            Choose a ready-to-wear favorite or let us sew a coordinated look for work, events, and family occasions.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-[#552d27] p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-widest text-orange-200">01 · WORKWEAR</p>
            <h3 className="mt-8 text-2xl font-bold">Adult office wear</h3>
            <p className="mt-3 leading-6 text-orange-100">
              Smart shirts, trousers, skirts, and dresses for a polished workday.
            </p>
            <a href="/collections/adult-office-wear" onClick={exploreExclusiveStyles} className="mt-6 inline-block font-semibold underline underline-offset-4">Explore styles</a>
          </article>
          <article className="rounded-3xl bg-[#f1e0d2] p-6 text-[#30241f]">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#a35d45]">02 · LITTLE LOOKS</p>
            <h3 className="mt-8 text-2xl font-bold">Kids' ready-to-wear</h3>
            <p className="mt-3 leading-6 text-stone-700">
              Comfortable dresses and coordinated sets for play, parties, and family days.
            </p>
            <a href="/collections/kids-ready-to-wear" onClick={exploreExclusiveStyles} className="mt-6 inline-block font-semibold text-[#75453b] underline underline-offset-4">Explore styles</a>
          </article>
          <article className="rounded-3xl border border-orange-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#a35d45]">03 · MADE TOGETHER</p>
            <h3 className="mt-8 text-2xl font-bold">Corporate wear for all ages</h3>
            <p className="mt-3 leading-6 text-stone-600">
              Coordinated corporate outfits, custom-sewn for kids and adults.
            </p>
            <a href="/collections/corporate-wear" onClick={exploreExclusiveStyles} className="mt-6 inline-block font-semibold text-[#75453b] underline underline-offset-4">Explore styles</a>
          </article>
        </div>
      </section>

      <section id="shop" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#a35d45]">
              THE PHUNVICT COLLECTION
            </p>
            <h2 className="mt-2 text-3xl font-bold">Shop the collection</h2>
            <p className="mt-2 text-sm text-stone-500" role="status">
              {catalogStatus === "loading" && "Connecting to the live collection…"}
              {catalogStatus === "connected" && "Live collection from Supabase"}
              {catalogStatus === "demo" && "Sample items and prices shown. Add Supabase credentials to load your real collection."}
              {/* {catalogStatus === "empty" && "Your Supabase collection is empty. Sample items are shown while you add products."} */}
              {catalogStatus === "error" && "Could not load the live collection. Showing sample items; check your Supabase table and access policy."}
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ready-to-wear..."
            aria-label="Search products"
            className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 outline-none focus:border-[#a35d45] sm:max-w-xs"
          />
        </div>

        <div className="my-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-2 text-sm ${
                category === c
                  ? "bg-[#552d27] text-white"
                  : "border border-orange-200 bg-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {addedMessage && (
          <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f1e0d2] px-4 py-3 text-sm text-[#552d27]">
            <span>{addedMessage}</span>
            <button
              type="button"
              onClick={() => {
                setCheckoutOpen(false);
                setCartOpen(true);
              }}
              className="font-semibold underline underline-offset-4"
            >
              View bag ({itemCount})
            </button>
          </div>
        )}

        {catalog.some((product) => product.isExclusive) && (
          <div className="mb-5 rounded-2xl border border-[#d8b58c] bg-[#fff4df] p-4 text-sm text-[#552d27]">
            <span className="font-semibold">Member collection unlocked.</span> These special styles are available to signed-in members.
          </div>
        )}
        {!sessionEmail && (
          <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#d8b58c] bg-[#fff4df] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#552d27]">🔒 Members-only styles are locked</p>
              <p className="mt-1 text-sm leading-5 text-[#75453b]">Create a member account or sign in to unlock exclusive products.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMemberMode("signup");
                setMemberMessage("");
                setMembershipNotice("Create a member account or sign in to unlock exclusive products.");
                setMemberDialog(true);
              }}
              className="shrink-0 rounded-full bg-[#552d27] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Become a member / Sign in
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="overflow-hidden rounded-2xl border border-orange-100 bg-white"
            >
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  className="h-44 w-full bg-stone-100 object-cover md:h-60"
                />
              ) : (
                <div className="flex h-44 items-center justify-center bg-[#f4e9e1] px-3 text-center text-sm text-stone-600 md:h-60">
                  Product photo coming soon
                </div>
              )}
              <div className="p-3 md:p-4">
                <p className="text-xs text-stone-500">{p.category}</p>
                <h3 className="mt-1 font-semibold">{p.name}</h3>
                {p.isExclusive && <span className="mt-2 inline-block rounded-full bg-[#fff0d7] px-2 py-1 text-xs font-semibold text-[#75453b]">Members only</span>}
                <p className="mt-2 font-bold">{money(p.price)}</p>
                <p
                  className={`mt-2 text-xs ${
                    p.stock > 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {p.stock > 0
                    ? `${p.stock} available`
                    : "Currently unavailable"}
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    addToCart(p);
                  }}
                  disabled={p.stock === 0}
                  className="mt-4 w-full rounded-xl bg-[#552d27] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {p.stock === 0 ? "Sold out" : "Add to bag"}
                </button>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-stone-500">
            No products found. Try another search.
          </p>
        )}
      </section>

      {memberDialog && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setMemberDialog(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="member-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a35d45]">Phunvict Fashion</p>
                <h2 id="member-title" className="mt-1 text-2xl font-bold">{sessionEmail ? "My account" : memberMode === "signup" ? "Become a member" : "Welcome back"}</h2>
                <p className="mt-2 text-sm text-stone-600">{sessionEmail ? "Manage your Phunvict Fashion membership." : membershipNotice || (memberMode === "signup" ? "Create an account to see our exclusive collection." : "Sign in to unlock members-only styles.")}</p>
              </div>
              <button type="button" onClick={() => setMemberDialog(false)} aria-label="Close membership window" className="rounded-lg px-3 py-2 hover:bg-stone-100">✕</button>
            </div>
            {sessionEmail ? (
              <div className="mt-6 space-y-5">
                {profileLoading && <p role="status" className="rounded-xl bg-[#fff8f1] p-4 text-sm text-stone-600">Loading your profile…</p>}
                {!profileLoading && <>
                {accountView === "profile" && <>
                  <div className="flex items-center gap-4 rounded-2xl bg-[#fff8f1] p-4">
                    {profileAvatarUrl ? <img src={profileAvatarUrl} alt="Your profile" className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f1e0d2] text-2xl font-bold text-[#552d27]">{memberProfile.fullName.slice(0, 1).toUpperCase() || "P"}</div>}
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{memberProfile.fullName || "Phunvict member"}</p>
                      <p className="truncate text-sm text-stone-600">{sessionEmail}</p>
                      <label className="mt-2 inline-block cursor-pointer text-sm font-semibold text-[#75453b] underline underline-offset-4">{memberBusy ? "Uploading…" : profileAvatarUrl ? "Change profile photo" : "Add a profile photo"}<input type="file" accept="image/*" disabled={memberBusy} className="sr-only" onChange={(event) => { void uploadMemberAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
                    </div>
                  </div>
                  <dl className="space-y-3 rounded-2xl border border-orange-100 p-4 text-sm">
                    <div><dt className="text-stone-500">Email</dt><dd className="font-medium">{sessionEmail}</dd></div>
                    <div><dt className="text-stone-500">Username</dt><dd className="font-medium">{memberProfile.username || "Not set"}</dd></div>
                    <div><dt className="text-stone-500">Phone</dt><dd className="font-medium">{memberProfile.phone || "Not set"}</dd></div>
                    <div><dt className="text-stone-500">Home address</dt><dd className="font-medium">{memberProfile.address || "Not set"}</dd></div>
                  </dl>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => { setAccountView("edit"); setMemberMessage(""); }} className="rounded-xl border border-[#552d27] px-4 py-3 text-sm font-semibold text-[#552d27]">Edit details</button>
                    <button type="button" onClick={() => { setAccountView("password"); setMemberMessage(""); }} className="rounded-xl border border-[#552d27] px-4 py-3 text-sm font-semibold text-[#552d27]">Change password</button>
                  </div>
                  <button type="button" onClick={() => void signOutMember()} className="w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white">Sign out</button>
                </>}

                {accountView === "edit" && <form onSubmit={saveMemberProfile} className="space-y-4">
                  <button type="button" onClick={() => { setAccountView("profile"); setMemberMessage(""); }} className="text-sm font-semibold text-[#75453b]">← Back to profile</button>
                  <h3 className="text-lg font-semibold">Change name and edit details</h3>
                  <label className="block text-sm font-medium">Full name<input required autoComplete="name" value={memberProfile.fullName} onChange={(event) => setMemberProfile({ ...memberProfile, fullName: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" /></label>
                  <label className="block text-sm font-medium">Phone number<input required type="tel" autoComplete="tel" value={memberProfile.phone} onChange={(event) => setMemberProfile({ ...memberProfile, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" /></label>
                  <label className="block text-sm font-medium">Home address<textarea required autoComplete="street-address" value={memberProfile.address} onChange={(event) => setMemberProfile({ ...memberProfile, address: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" /></label>
                  <label className="block text-sm font-medium">Username<input required minLength={3} autoComplete="username" value={memberProfile.username} onChange={(event) => setMemberProfile({ ...memberProfile, username: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" /></label>
                  <button disabled={memberBusy} type="submit" className="w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white disabled:opacity-60">{memberBusy ? "Saving…" : "Save changes"}</button>
                </form>}

                {accountView === "password" && <form onSubmit={changeMemberPassword} className="space-y-4">
                  <button type="button" onClick={() => { setAccountView("profile"); setMemberMessage(""); }} className="text-sm font-semibold text-[#75453b]">← Back to profile</button>
                  <h3 className="text-lg font-semibold">Change password</h3>
                  <label className="block text-sm font-medium">New password<div className="mt-1 flex rounded-xl border border-orange-200 focus-within:border-[#a35d45]"><input required minLength={6} type={showNewPassword ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 outline-none" placeholder="At least 6 characters" /><button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="px-3 text-xs font-semibold text-[#75453b]">{showNewPassword ? "Hide" : "Show"}</button></div></label>
                  <label className="block text-sm font-medium">Confirm new password<div className="mt-1 flex rounded-xl border border-orange-200 focus-within:border-[#a35d45]"><input required minLength={6} type={showConfirmNewPassword ? "text" : "password"} autoComplete="new-password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 outline-none" placeholder="Type the new password again" /><button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="px-3 text-xs font-semibold text-[#75453b]">{showConfirmNewPassword ? "Hide" : "Show"}</button></div></label>
                  <button disabled={memberBusy} type="submit" className="w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white disabled:opacity-60">{memberBusy ? "Saving…" : "Update password"}</button>
                </form>}
                </>}
                {memberMessage && <p role="status" className="rounded-xl bg-[#f4e9e1] p-3 text-sm leading-5 text-[#552d27]">{memberMessage}</p>}
              </div>
            ) : <form onSubmit={submitMemberForm} className="mt-6 space-y-4">
              {memberMode === "signup" && <>
                <label className="block text-sm font-medium">Full name<input required autoComplete="name" value={memberForm.fullName} onChange={(event) => setMemberForm({ ...memberForm, fullName: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="Your full name" /></label>
                <label className="block text-sm font-medium">Phone number<input required type="tel" autoComplete="tel" value={memberForm.phone} onChange={(event) => setMemberForm({ ...memberForm, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="Your phone number" /></label>
              </>}
              <label className="block text-sm font-medium">Email address<input required type="email" autoComplete="email" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="you@example.com" /></label>
              {memberMode === "signup" && <>
                <label className="block text-sm font-medium">Home address<input required autoComplete="street-address" value={memberForm.address} onChange={(event) => setMemberForm({ ...memberForm, address: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="Your home address" /></label>
                <label className="block text-sm font-medium">Username<input required autoComplete="username" minLength={3} value={memberForm.username} onChange={(event) => setMemberForm({ ...memberForm, username: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="Choose a username" /></label>
              </>}
              <label className="block text-sm font-medium">Password<div className="mt-1 flex rounded-xl border border-orange-200 focus-within:border-[#a35d45]"><input required type={showMemberPassword ? "text" : "password"} autoComplete={memberMode === "signup" ? "new-password" : "current-password"} minLength={6} value={memberForm.password} onChange={(event) => setMemberForm({ ...memberForm, password: event.target.value })} className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 outline-none" placeholder={memberMode === "signup" ? "At least 6 characters" : "Your password"} /><button type="button" onClick={() => setShowMemberPassword(!showMemberPassword)} className="px-3 text-xs font-semibold text-[#75453b]">{showMemberPassword ? "Hide" : "Show"}</button></div></label>
              {memberMode === "signup" && <label className="block text-sm font-medium">Confirm password<div className="mt-1 flex rounded-xl border border-orange-200 focus-within:border-[#a35d45]"><input required type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={6} value={memberForm.confirmPassword} onChange={(event) => setMemberForm({ ...memberForm, confirmPassword: event.target.value })} className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 outline-none" placeholder="Type the password again" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="px-3 text-xs font-semibold text-[#75453b]">{showConfirmPassword ? "Hide" : "Show"}</button></div></label>}
              {memberMode === "signup" && <p className="text-xs leading-5 text-stone-500">Your username is saved with your account. For secure sign-in, use the email address and password you registered with.</p>}
              <button disabled={memberBusy} type="submit" className="w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white hover:bg-[#75453b] disabled:opacity-60">{memberBusy ? "Please wait…" : memberMode === "signup" ? "Create my membership" : "Sign in"}</button>
              {memberMessage && <p role="status" className="rounded-xl bg-[#f4e9e1] p-3 text-sm leading-5 text-[#552d27]">{memberMessage}</p>}
            </form>}
            {!sessionEmail && <p className="mt-5 text-center text-sm text-stone-600">{memberMode === "signup" ? "Already a member?" : "New to Phunvict Fashion?"}{" "}<button type="button" onClick={() => { setMemberMode(memberMode === "signup" ? "login" : "signup"); setMemberMessage(""); }} className="font-semibold text-[#75453b] underline underline-offset-4">{memberMode === "signup" ? "Sign in" : "Become a member"}</button></p>}
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/40">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={checkoutOpen ? "Checkout order review" : "Shopping bag"}
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                {checkoutOpen && (
                  <button
                    onClick={() => {
                      setCheckoutOpen(false);
                      setPaymentMessage("");
                    }}
                    className="mb-2 text-sm font-semibold text-[#75453b]"
                  >
                    ← Back to bag
                  </button>
                )}
                <h2 className="text-2xl font-bold">
                  {checkoutOpen ? "Review your order" : "Your shopping bag"}
                </h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping bag"
                className="rounded-lg px-3 py-2 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            {cartItems.length === 0 ? (
              <p className="mt-8 text-stone-500">
                Your bag is empty. Explore our collection!
              </p>
            ) : checkoutOpen ? (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="font-semibold">Items you selected</h3>
                  <div className="mt-3 space-y-3">
                    {cartItems.map((p) => (
                      <div key={p.id} className="flex justify-between gap-3 text-sm">
                        <span>{p.name} × {cart[p.id]}</span>
                        <span className="font-semibold">{money(p.price * cart[p.id])}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Subtotal</span>
                    <span>{money(total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">Delivery cost will be confirmed with you.</p>
                </div>

                <form
                  className="space-y-4 border-t pt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPaymentMessage("Your order summary is ready. Online payment has not been connected yet.");
                  }}
                >
                  <h3 className="font-semibold">Your delivery details</h3>
                  {sessionEmail ? (
                    <div className="rounded-xl bg-[#fff8f1] p-4 text-sm">
                      <p className="font-semibold text-[#552d27]">Using your saved member details</p>
                      {profileLoading ? <p className="mt-2 text-stone-600">Loading your saved delivery address…</p> : memberDeliveryReady ? (
                        <address className="mt-2 space-y-1 not-italic text-stone-700">
                          <p>{memberProfile.fullName}</p>
                          <p>{memberProfile.phone}</p>
                          <p>{sessionEmail}</p>
                          <p>{memberProfile.address}</p>
                        </address>
                      ) : <p className="mt-2 text-stone-600">Please add your name, phone number, and home address in My account before continuing.</p>}
                      <button type="button" onClick={() => { setAccountView("edit"); setMemberMessage(""); setMemberDialog(true); }} className="mt-3 font-semibold text-[#75453b] underline underline-offset-4">Edit my delivery details</button>
                    </div>
                  ) : <>
                  <label className="block text-sm font-medium">
                    Full name
                    <input
                      required
                      autoComplete="name"
                      value={customer.name}
                      onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2 outline-none focus:border-[#a35d45]"
                      placeholder="Name for the order"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Phone number
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2 outline-none focus:border-[#a35d45]"
                      placeholder="Phone number"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Email address
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={customer.email}
                      onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2 outline-none focus:border-[#a35d45]"
                      placeholder="Email for your order"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Delivery address
                    <textarea
                      required
                      autoComplete="street-address"
                      value={customer.address}
                      onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                      className="mt-1 min-h-24 w-full rounded-xl border border-orange-200 px-3 py-2 outline-none focus:border-[#a35d45]"
                      placeholder="Where should we deliver your order?"
                    />
                  </label>
                  </>}
                  <button
                    type="submit"
                    disabled={Boolean(sessionEmail) && (profileLoading || !memberDeliveryReady)}
                    className="w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white hover:bg-[#75453b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Proceed to payment
                  </button>
                  {paymentMessage && (
                    <p role="status" className="rounded-xl bg-[#f4e9e1] p-3 text-sm text-[#552d27]">
                      {paymentMessage} The next step is connecting a payment service such as Paystack or Flutterwave.
                    </p>
                  )}
                </form>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {cartItems.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-stone-500">
                        {money(p.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`Remove one ${p.name}`}
                        onClick={() =>
                          setCart((current) => ({
                            ...current,
                            [p.id]: Math.max(
                              0,
                              (current[p.id] ?? 0) - 1
                            ),
                          }))
                        }
                        className="rounded border px-2 py-1"
                      >
                        −
                      </button>
                      <span>{cart[p.id]}</span>
                      <button
                        aria-label={`Add one ${p.name}`}
                        disabled={cart[p.id] >= p.stock}
                        onClick={() => addToCart(p)}
                        className="rounded border px-2 py-1 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Subtotal</span>
                    <span>{money(total)}</span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    Delivery fees will be calculated at checkout.
                  </p>
                  <button
                    onClick={() => {
                      setCheckoutOpen(true);
                      setPaymentMessage("");
                    }}
                    className="mt-5 w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white"
                  >
                    Continue to checkout
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <section id="about" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-3xl border border-orange-100 bg-white p-7 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a35d45]">
            ABOUT US
          </p>
          <h2 className="mt-2 text-3xl font-bold">About Phunvict Fashion</h2>
          <div className="mt-4 max-w-3xl space-y-4 leading-7 text-stone-600">
            <p>
              At Phunvict Fashion, we believe every outfit should make you feel confident, comfortable, and beautifully you.
            </p>
            <p>
              We sew and sell ready-to-wear styles, corporate outfits for adults and children, and everyday essentials. From the first sketch to the final stitch, we put care and attention into the details—so you can enjoy a lovely fit and a look made to stand out.
            </p>
            <p>
              Whether you’re dressing for work, a special occasion, or an ordinary day, we’re here to help you wear something you love.
            </p>
          </div>
          <p className="mt-6 font-semibold text-[#75453b]">
            Phunvict Fashion — beautifully made, thoughtfully worn.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-3xl bg-[#f1e0d2] p-7 md:flex md:items-center md:justify-between md:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a35d45]">
              FOLLOW ALONG
            </p>
            <h2 className="mt-2 text-2xl font-bold">More Phunvict looks on Instagram</h2>
            <p className="mt-2 text-stone-700">
              See new styles, sewing, and shop updates from our two pages.
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-3 md:mt-0 md:items-end">
            <a
              href="https://www.instagram.com/phunvict__kiddies/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#552d27] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#75453b]"
            >
              @phunvict__kiddies
            </a>
            <a
              href="https://www.instagram.com/phunvict_fashion.ng/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#552d27] px-5 py-3 text-center text-sm font-semibold text-[#552d27] hover:bg-white"
            >
              @phunvict_fashion.ng
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-[#552d27] px-5 py-8 text-center text-sm text-white">
        <p className="font-semibold">Phunvict Fashion</p>
        <p className="mt-2 text-orange-100">
          We sew and sell ready-to-wear and corporate wear for kids and adults.
        </p>
        <p className="mt-4 text-orange-200">
          © {currentYear ?? 2026} Phunvict Fashion
        </p>
      </footer>
    </main>
  );
}
