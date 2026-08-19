import './globals.css';

export const metadata = {
  title: 'likedislike',
  description: 'Your taste, one link.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
