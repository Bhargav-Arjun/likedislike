import './globals.css';

export const metadata = {
  title: 'GetMe',
  description: "No need to ask. It's all right here.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="max-w-md mx-auto">{children}</body>
    </html>
  );
}
