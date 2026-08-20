export const metadata = {
  title: "Space Plan — Moving, Planning, Marketplace",
  description:
    "Draw your new place, see what fits, and sell what doesn't to someone nearby.",
};

/**
 * The Archivo superfamily is loaded once here rather than per page: wide for
 * display, narrow for text. Every page leans on that width contrast, so it
 * belongs to the document rather than to any one component.
 *
 * BOTH ARE ASKED FOR AS A FULL WEIGHT RANGE, and that matters. The stylesheet
 * used to request Archivo Narrow at 400–700 only, while the app sets
 * font-weight:800 on nearly every button, tag and caption — so the browser
 * quietly faked the missing weight by smearing the 700 outlines. Half the small
 * type on the site was synthetic bold and half was real, which is exactly the
 * kind of difference you feel without being able to name it.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&family=Archivo+Narrow:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
