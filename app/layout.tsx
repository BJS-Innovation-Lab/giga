import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GIGA — Prevaler",
  description: "Directorio Médico — Sistema de gestión por sede y especialidad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50">
          <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-14">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">G</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-slate-900 leading-tight">GIGA</h1>
                    <p className="text-[11px] text-slate-400 -mt-0.5 font-medium tracking-wide">PREVALER · DIRECTORIO MÉDICO</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="text-xs text-slate-400 font-medium">En línea</span>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="text-center text-xs text-slate-300 py-6 border-t border-slate-100">
            GIGA v3.0 · Directorio médico en tiempo real
          </footer>
        </div>
      </body>
    </html>
  );
}
