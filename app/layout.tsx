import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cartas de um Diabo a seu Aprendiz",
  description: "Apresentação literária sobre a obra de C. S. Lewis.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
