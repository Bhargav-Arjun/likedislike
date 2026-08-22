
import { NextRequest, NextResponse } from 'next/server';

// iTunes Search API is free and needs no API key or auth -- simplest reliable
// option for song + album art auto-fetch on a zero-budget stack.
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ results: [] });

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    query
  )}&media=music&entity=song&limit=8`;

  const res = await fetch(url);
  const data = await res.json();

  const results = (data.results || []).map((r: any) => ({
    id: String(r.trackId),
    title: r.trackName,
    subtitle: r.artistName,
    image_url: r.artworkUrl100 ? r.artworkUrl100.replace('100x100', '400x400') : null,
    source: 'itunes',
  }));

  return NextResponse.json({ results });
}
