export default function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-14 h-14 rounded-2xl overflow-hidden animate-pulse">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="" className="w-full h-full object-cover" />
      </div>
    </main>
  );
}
