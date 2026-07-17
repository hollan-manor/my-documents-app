import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "E-Docs Access",
  description: "Access your documents anywhere",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
     lang="en"
     className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
     suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var isSpecial = sessionStorage.getItem('specialTheme') === 'true';
                  document.documentElement.style.setProperty(
                    '--bg-image',
                    isSpecial ? "url('/circuit-bg.svg')" : "url('/triangles-bg.svg')"
                  );
                } catch (e) {}
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}