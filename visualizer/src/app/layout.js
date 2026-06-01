import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ['400', '500', '700'],
});

export const metadata = {
  title: "Global AI Data Center Analytics & Research",
  description: "An interactive, high-fidelity visualizer mapping the infrastructure powering next-generation artificial intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <script src="https://unpkg.com/lucide@latest"></script>
      </body>
    </html>
  );
}
