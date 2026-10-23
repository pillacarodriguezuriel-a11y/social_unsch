import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { RouteGuard } from '../components/ui/RouteGuard';
import './globals.css';

// Configuración de tipografía institucional Manrope (Sección 1 y 2 de la Skill de Frontend)
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SOCIAL-UNSCH - Conexión Universitaria',
  description: 'La red social académica exclusiva para la comunidad de la Universidad Nacional de San Cristóbal de Huamanga.',
  icons: {
    icon: '/images/logos/logo-unsch.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${manrope.variable} h-full`}>
      <body className="font-sans antialiased h-full bg-surface text-neutral-gray selection:bg-primary/10 selection:text-primary">
        <RouteGuard>
          {children}
        </RouteGuard>
      </body>
    </html>
  );
}
