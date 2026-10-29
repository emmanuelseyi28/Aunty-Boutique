"use client";

import { type FormEvent, useEffect, useState } from "react";
import { normalizeProductCategory } from "@/lib/product-categories";
import { homePageSampleProducts } from "@/lib/sample-products";
import { supabase } from "@/lib/supabase/client";

type ProductRow = {
  admin_id: string;
  name: string;
  description: string | null;
  category: string;
  price_ngn: number;
  stock_quantity: number;
  stock_unit: string | null;
  image_url: string | null;
  is_active: boolean;
  is_exclusive: boolean;
};

type ProductForm = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  stockUnit: string;
  imageUrl: string;
  isActive: boolean;
  isExclusive: boolean;
};

const categories = [
  "Adult Office Wear",
  "Kid Ready-to-Wear",
  "Adult Outing Wear",
  "Men's Underwear",
  "Women's Underwear",
  "Fashion Clothes",
];

const blankForm: ProductForm = {
  name: "",
  description: "",
  category: "Adult Office Wear",
  price: "",
  stock: "",
  stockUnit: "pieces",
  imageUrl: "",
  isActive: true,
  isExclusive: false,
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

function categoryForForm(category: string) {
  return normalizeProductCategory(category) === "Kids' Ready-to-Wear"
    ? "Kid Ready-to-Wear"
    : category;
}

export default function AdminPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [access, setAccess] = useState<"checking" | "signed-out" | "denied" | "allowed" | "error">("checking");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  useEffect(() => {
    if (!supabase) {
      setAccess("error");
      setMessage("Supabase is not connected. Add the project settings before using the admin page.");
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setUserEmail(data.session?.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!userId) {
      setAccess("signed-out");
      setProducts([]);
      return;
    }
    let active = true;
    async function checkAdmin() {
      setAccess("checking");
      const { data: admin, error: adminError } = await supabase!
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (adminError) {
        setAccess("error");
        setMessage(`Could not check admin access. Run the admin setup SQL in Supabase first. ${adminError.message}`);
        return;
      }
      if (!admin) {
        setAccess("denied");
        setMessage("This account has not been approved as a store administrator yet.");
        return;
      }
      const { data, error } = await supabase!
        .from("products")
        .select("admin_id, name, description, category, price_ngn, stock_quantity, stock_unit, image_url, is_active, is_exclusive")
        .order("name");
      if (!active) return;
      if (error) {
        setAccess("error");
        setMessage(`Could not load products. ${error.message}`);
        return;
      }
      setProducts((data ?? []) as ProductRow[]);
      setAccess("allowed");
      setMessage("");
    }
    void checkAdmin();
    return () => { active = false; };
  }, [userId]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else setLoginPassword("");
  }

  function startEdit(product: ProductRow) {
    setEditingId(product.admin_id);
    setPhotoFile(null);
    setForm({
      name: product.name,
      description: product.description ?? "",
      category: categoryForForm(product.category),
      price: String(product.price_ngn),
      stock: String(product.stock_quantity),
      stockUnit: product.stock_unit ?? "pieces",
      imageUrl: product.image_url ?? "",
      isActive: product.is_active,
      isExclusive: product.is_exclusive,
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setPhotoFile(null);
    setForm(blankForm);
    setMessage("");
  }

  async function refreshProducts() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("products")
      .select("admin_id, name, description, category, price_ngn, stock_quantity, stock_unit, image_url, is_active, is_exclusive")
      .order("name");
    if (error) throw error;
    setProducts((data ?? []) as ProductRow[]);
  }

  async function importHomepageSamples() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const existingKeys = new Set(
        products.map((product) => `${product.name.trim().toLocaleLowerCase()}|${normalizeProductCategory(product.category).toLocaleLowerCase()}`)
      );
      const drafts = homePageSampleProducts
        .filter((product) => !existingKeys.has(`${product.name.trim().toLocaleLowerCase()}|${normalizeProductCategory(product.category).toLocaleLowerCase()}`))
        .map((product) => ({
          name: product.name,
          description: "Homepage sample draft. Review the name, category, price, stock, and photo before making this item available.",
          category: categoryForForm(product.category),
          price_ngn: product.price,
          stock_quantity: product.stock,
          stock_unit: "pieces",
          image_url: product.image || null,
          is_active: false,
          is_exclusive: false,
        }));

      if (drafts.length === 0) {
        setMessage("All homepage sample items are already in the admin product list.");
        return;
      }
      const { error } = await supabase.from("products").insert(drafts);
      if (error) throw error;
      await refreshProducts();
      setMessage(`${drafts.length} homepage sample ${drafts.length === 1 ? "item was" : "items were"} added as unavailable drafts. Review each one and mark it available when it is ready for customers.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not add the homepage samples. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    if (!form.name.trim() || !form.price || !form.stock) {
      setMessage("Please enter the product name, price, and available quantity.");
      return;
    }
    if (photoFile && (!photoFile.type.startsWith("image/") || photoFile.size > 5 * 1024 * 1024)) {
      setMessage("Choose an image file smaller than 5 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let imageUrl = form.imageUrl;
      if (photoFile) {
        const extension = photoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const safeExtension = /^[a-z0-9]{1,8}$/.test(extension) ? extension : "jpg";
        const imagePath = `${userId}/${crypto.randomUUID()}.${safeExtension}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(imagePath, photoFile, { contentType: photoFile.type, cacheControl: "3600" });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
      }

      const values = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        price_ngn: Math.round(Number(form.price)),
        stock_quantity: Math.max(0, Math.floor(Number(form.stock))),
        stock_unit: form.stockUnit.trim() || "pieces",
        image_url: imageUrl || null,
        is_active: form.isActive,
        is_exclusive: form.isExclusive,
        updated_at: new Date().toISOString(),
      };

      const result = editingId
        ? await supabase.from("products").update(values).eq("admin_id", editingId)
        : await supabase.from("products").insert(values);
      if (result.error) throw result.error;
      await refreshProducts();
      setEditingId(null);
      setPhotoFile(null);
      setForm(blankForm);
      setMessage(editingId ? "Product changes saved." : "Product added to the shop.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not save the product. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(product: ProductRow) {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("products")
      .update({ is_active: !product.is_active, updated_at: new Date().toISOString() })
      .eq("admin_id", product.admin_id);
    if (error) setMessage(error.message);
    else {
      setProducts((current) => current.map((item) => item.admin_id === product.admin_id ? { ...item, is_active: !product.is_active } : item));
      setMessage(product.is_active ? "Product marked unavailable." : "Product is available in the shop again.");
    }
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] text-[#30241f]">
      <header className="border-b border-orange-100 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a href="/" className="text-xl font-bold"><span className="text-[#a35d45]">Phunvict</span> Fashion <span className="ml-2 text-sm font-medium text-stone-500">Admin</span></a>
          <div className="flex items-center gap-3">
            {userEmail && <span className="hidden text-sm text-stone-600 sm:block">{userEmail}</span>}
            {userId && <button type="button" onClick={() => void signOut()} className="rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold">Sign out</button>}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a35d45]">STORE MANAGEMENT</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Manage your products</h1>
          <p className="mt-3 leading-6 text-stone-600">Add a style, update its price or stock, upload a photo, or mark it unavailable. Changes are saved to the shop catalog.</p>
        </div>

        {access === "checking" && <p role="status" className="rounded-2xl bg-white p-5 text-stone-600">Checking your admin access…</p>}

        {access === "signed-out" && (
          <form onSubmit={signIn} className="max-w-md space-y-4 rounded-3xl border border-orange-100 bg-white p-6 md:p-8">
            <h2 className="text-xl font-bold">Admin sign in</h2>
            <p className="text-sm leading-5 text-stone-600">Use the email and password for the account that was approved as a store administrator.</p>
            <label className="block text-sm font-medium">Email address<input required type="email" autoComplete="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" /></label>
            <label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" /></label>
            <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        )}

        {(access === "denied" || access === "error") && (
          <div role="status" className="max-w-2xl rounded-2xl border border-orange-100 bg-white p-6">
            <h2 className="text-xl font-bold">Admin access needed</h2>
            <p className="mt-2 leading-6 text-stone-600">{message}</p>
            {access === "denied" && <p className="mt-3 text-sm text-stone-500">The store owner can approve the account using the Supabase admin-access SQL file.</p>}
          </div>
        )}

        {access === "allowed" && (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <form onSubmit={saveProduct} className="space-y-4 rounded-3xl border border-orange-100 bg-white p-6 md:p-8">
              <div>
                <h2 className="text-xl font-bold">{editingId ? "Edit product" : "Add a product"}</h2>
                <p className="mt-1 text-sm text-stone-500">Price is in Nigerian naira.</p>
              </div>
              <label className="block text-sm font-medium">Product name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="For example, Women's Office Dress" /></label>
              <label className="block text-sm font-medium">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 outline-none focus:border-[#a35d45]">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label className="block text-sm font-medium">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="A short description for customers" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Price (₦)<input required type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="25000" /></label>
                <label className="block text-sm font-medium">Quantity available<input required type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="5" /></label>
              </div>
              <label className="block text-sm font-medium">Stock unit<input value={form.stockUnit} onChange={(event) => setForm({ ...form, stockUnit: event.target.value })} className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2.5 outline-none focus:border-[#a35d45]" placeholder="pieces" /></label>
              <label className="block text-sm font-medium">Product photo<input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-xl border border-orange-200 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#f1e0d2] file:px-3 file:py-2 file:font-semibold" /><span className="mt-1 block text-xs text-stone-500">Choose an image under 5 MB. {editingId && !photoFile && form.imageUrl ? "The current photo will be kept." : ""}</span></label>
              {photoPreviewUrl && <img src={photoPreviewUrl} alt="Selected product preview" className="h-40 w-full rounded-xl object-cover" />}
              {!photoFile && form.imageUrl && <img src={form.imageUrl} alt="Current product" className="h-40 w-full rounded-xl object-cover" />}
              <label className="flex items-center gap-3 rounded-xl bg-[#fff8f1] p-3 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 accent-[#552d27]" /><span><span className="font-semibold">Available in the shop</span><span className="block text-xs text-stone-500">Turn off to hide this product without deleting it.</span></span></label>
              <label className="flex items-center gap-3 rounded-xl bg-[#fff8f1] p-3 text-sm"><input type="checkbox" checked={form.isExclusive} onChange={(event) => setForm({ ...form, isExclusive: event.target.checked })} className="h-4 w-4 accent-[#552d27]" /><span><span className="font-semibold">Members-only product</span><span className="block text-xs text-stone-500">Only signed-in members can view it.</span></span></label>
              <div className="flex gap-3">
                {editingId && <button type="button" onClick={cancelEdit} className="flex-1 rounded-xl border border-orange-200 px-4 py-3 font-semibold">Cancel</button>}
                <button disabled={busy} type="submit" className="flex-1 rounded-xl bg-[#552d27] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : editingId ? "Save changes" : "Add product"}</button>
              </div>
            </form>

            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div><h2 className="text-xl font-bold">Products ({products.length})</h2><p className="mt-1 text-sm text-stone-500">Edit details or hide a product from customers.</p></div>
              </div>
              <div className="mb-4 rounded-2xl border border-orange-100 bg-white p-4">
                <p className="text-sm leading-5 text-stone-600">The products shown before Supabase is connected are sample examples. Add them here as drafts so they can be edited. They stay hidden from customers until marked available.</p>
                <button type="button" disabled={busy} onClick={() => void importHomepageSamples()} className="mt-3 rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">Add homepage sample items as drafts</button>
              </div>
              <div className="space-y-3">
                {products.map((product) => (
                  <article key={product.admin_id} className="flex gap-4 rounded-2xl border border-orange-100 bg-white p-4">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="h-24 w-20 shrink-0 rounded-xl bg-stone-100 object-cover" /> : <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-[#f4e9e1] px-2 text-center text-xs text-stone-500">No photo</div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{product.name}</h3>{!product.is_active && <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">Unavailable</span>}{product.is_exclusive && <span className="rounded-full bg-[#fff0d7] px-2 py-1 text-xs text-[#75453b]">Members only</span>}</div>
                      <p className="mt-1 text-xs text-stone-500">{normalizeProductCategory(product.category)}</p>
                      <p className="mt-1 text-sm font-semibold">{money(Number(product.price_ngn))} <span className="font-normal text-stone-500">· {product.stock_quantity} {product.stock_unit || "pieces"}</span></p>
                      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(product)} className="rounded-full border border-orange-200 px-3 py-1.5 text-xs font-semibold">Edit</button><button type="button" disabled={busy} onClick={() => void toggleAvailability(product)} className="rounded-full border border-orange-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{product.is_active ? "Mark unavailable" : "Make available"}</button></div>
                    </div>
                  </article>
                ))}
                {products.length === 0 && <p className="rounded-2xl border border-orange-100 bg-white p-6 text-sm text-stone-600">There are no products yet. Add the first one using the form.</p>}
              </div>
            </section>
          </div>
        )}

        {message && access !== "denied" && access !== "error" && <p role="status" className="mt-5 rounded-xl bg-[#f1e0d2] p-4 text-sm text-[#552d27]">{message}</p>}
      </section>
    </main>
  );
}
