import "../styles.css";

export const metadata = {
  title: "Duncan Robert | Digital Designer",
  description:
    "Duncan Robert, digital designer and Framer developer portfolio template rebuilt from Framer MCP content.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@900&family=Archivo+Black&family=Syne:wght@800&family=Unbounded:wght@900&family=Space+Grotesk:wght@300..900&family=Permanent+Marker&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
