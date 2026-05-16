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
          href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&family=Manrope:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
