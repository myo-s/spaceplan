export const metadata = {
  title: "Space Plan — Moving, Planning, Marketplace",
  description:
    "Draw your new place, see what fits, and sell what doesn't to someone nearby.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
