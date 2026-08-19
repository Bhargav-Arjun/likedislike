import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-medium mb-3">your taste, one link</h1>
      <p className="text-neutral-500 mb-8 max-w-sm">
        songs, movies, heroes — what you like and why. one page, share it anywhere your bio lets you.
      </p>
      <Link
        href="/login"
        className="px-6 py-3 rounded-lg border border-neutral-300 hover:bg-neutral-50 font-medium"
      >
        create your page
      </Link>
    </main>
  );
}
