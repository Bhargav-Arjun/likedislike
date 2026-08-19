'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile, Category, Item } from '@/lib/supabase';

const ACCENTS = ['blue', 'teal', 'coral', 'pink', 'amber', 'purple'];

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<(Category & { items: Item[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: cats } = await supabase
      .from('categories')
      .select('*, items(*)')
      .eq('profile_id', user.id)
      .order('sort_order');
    setCategories((cats as any) || []);
    setLoading(false);
  }

  async function updateProfile(fields: Partial<Profile>) {
    if (!profile) return;
    const updated = { ...profile, ...fields };
    setProfile(updated);
    await supabase.from('profiles').update(fields).eq('id', profile.id);
  }

  async function addCategory() {
    if (!newCategory.trim() || !profile) return;
    const { data } = await supabase
      .from('categories')
      .insert({ profile_id: profile.id, name: newCategory.trim(), sort_order: categories.length })
      .select()
      .single();
    if (data) setCategories([...categories, { ...data, items: [] }]);
    setNewCategory('');
  }

  async function deleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id);
    setCategories(categories.filter((c) => c.id !== id));
  }

  async function addItem(categoryId: string) {
    const { data } = await supabase
      .from('items')
      .insert({ category_id: categoryId, title: 'New item', subtitle: '', why_note: '' })
      .select()
      .single();
    if (data) {
      setCategories(
        categories.map((c) => (c.id === categoryId ? { ...c, items: [...c.items, data] } : c))
      );
    }
  }

  async function updateItem(itemId: string, categoryId: string, fields: Partial<Item>) {
    setCategories(
      categories.map((c) =>
        c.id === categoryId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...fields } : i)) }
          : c
      )
    );
    await supabase.from('items').update(fields).eq('id', itemId);
  }

  async function deleteItem(itemId: string, categoryId: string) {
    await supabase.from('items').delete().eq('id', itemId);
    setCategories(
      categories.map((c) =>
        c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      )
    );
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;
  if (!profile) return null;

  return (
    <main className="min-h-screen max-w-md mx-auto px-5 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">edit your page</h1>
        <a href={`/${profile.username}`} target="_blank" className="text-sm text-blue-600">
          view live →
        </a>
      </div>

      <div className="border border-neutral-200 rounded-xl p-4 mb-6">
        <label className="text-xs text-neutral-500">username</label>
        <input
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-3"
          value={profile.username}
          onChange={(e) => updateProfile({ username: e.target.value.toLowerCase() })}
        />
        <label className="text-xs text-neutral-500">display name</label>
        <input
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-3"
          value={profile.display_name}
          onChange={(e) => updateProfile({ display_name: e.target.value })}
        />
        <label className="text-xs text-neutral-500">bio</label>
        <textarea
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-3"
          value={profile.bio || ''}
          onChange={(e) => updateProfile({ bio: e.target.value })}
        />
        <label className="text-xs text-neutral-500 block mb-1">accent color</label>
        <div className="flex gap-2">
          {ACCENTS.map((color) => (
            <button
              key={color}
              onClick={() => updateProfile({ accent_color: color })}
              className={`w-7 h-7 rounded-full border-2 ${
                profile.accent_color === color ? 'border-black' : 'border-transparent'
              }`}
              style={{ background: `var(--tw-color-${color}, #ccc)` }}
              title={color}
            />
          ))}
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="border border-neutral-200 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium">{cat.name}</h2>
            <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-500">
              delete category
            </button>
          </div>
          {cat.items.map((item) => (
            <div key={item.id} className="bg-neutral-50 rounded-lg p-3 mb-2">
              <input
                className="w-full bg-transparent font-medium mb-1 outline-none"
                value={item.title}
                placeholder="title"
                onChange={(e) => updateItem(item.id, cat.id, { title: e.target.value })}
              />
              <input
                className="w-full bg-transparent text-sm text-neutral-500 mb-1 outline-none"
                value={item.subtitle || ''}
                placeholder="subtitle (artist, actor...)"
                onChange={(e) => updateItem(item.id, cat.id, { subtitle: e.target.value })}
              />
              <textarea
                className="w-full bg-transparent text-sm outline-none"
                value={item.why_note || ''}
                placeholder="why you like it..."
                onChange={(e) => updateItem(item.id, cat.id, { why_note: e.target.value })}
              />
              <button
                onClick={() => deleteItem(item.id, cat.id)}
                className="text-xs text-red-500 mt-1"
              >
                remove
              </button>
            </div>
          ))}
          <button
            onClick={() => addItem(cat.id)}
            className="text-sm text-blue-600 mt-1"
          >
            + add item
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          className="flex-1 border border-neutral-300 rounded-lg px-3 py-2"
          placeholder="new category name"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button onClick={addCategory} className="px-4 py-2 bg-black text-white rounded-lg">
          add
        </button>
      </div>
    </main>
  );
}
