import { NextRequest, NextResponse } from 'next/server';

// Uses TMDB's free API (get a key at themoviedb.org/settings/api).
// Searches both movies and TV series in one call since "Movies+Series" is one combined category.
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ results: [] });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
  }

  const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(
    query
  )}&include_adult=false`;

  const res = await fetch(url);
  const data = await res.json();

  const results = (data.results || [])
    .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 8)
    .map((r: any) => ({
      id: String(r.id),
      title: r.title || r.name,
      subtitle: (r.release_date || r.first_air_date || '').slice(0, 4),
      image_url: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
      source: 'tmdb',
    }));

  return NextResponse.json({ results });
}

