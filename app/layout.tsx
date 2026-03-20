import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GIGA Dashboard - Prevaler",
  description: "Directorio Médico — Sistema de gestión por sede y especialidad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
          <nav className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-cyan-100 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏥</span>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">GIGA Dashboard</h1>
                    <p className="text-xs text-cyan-600 -mt-1">Prevaler — Directorio Médico</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-500">En línea</span>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="text-center text-sm text-gray-400 py-6 border-t border-gray-100">
            Sistema GIGA v3.0 — Directorio médico conectado a base de datos en tiempo real
          </footer>
        </div>
      </body>
    </html>
  );
}
