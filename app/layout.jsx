export const metadata = {
  title: "Space Plan — Moving, Planning, Marketplace",
  description:
    "Draw your new place, see what fits, and sell what doesn't to someone nearby.",
};

/**
 * The Archivo superfamily is loaded once here rather than per page: wide for
 * display, narrow for text. Every page leans on that width contrast, so it
 * belongs to the document rather than to any one component.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Narrow:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
