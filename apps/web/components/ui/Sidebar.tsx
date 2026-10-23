'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Radio, 
  Users, 
  ShoppingBag, 
  FolderOpen, 
  Briefcase, 
  Settings, 
  LogOut,
  ShieldCheck,
  Car,
  ShieldAlert
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ full_name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          setUser(JSON.parse(userStr));
        } catch {
          // Fallback a mock user para desarrollo
          setUser({
            full_name: 'Juan Carlos Quispe',
            email: 'jquispe@unsch.edu.pe',
            role: 'student',
          });
        }
      } else {
        // Mock user por defecto si no está logueado para desarrollo visual
        setUser({
          full_name: 'Estudiante UNSCH',
          email: 'usuario@unsch.edu.pe',
          role: 'student',
        });
      }
    }
  }, []);

  const navItems = [
    { name: 'Inicio', href: '/', icon: <Home className="w-5 h-5" /> },
    { name: 'Campus Radar', href: '/radar', icon: <Radio className="w-5 h-5" /> },
    { name: 'Matchmaking', href: '/matchmaking', icon: <Users className="w-5 h-5" /> },
    { name: 'Marketplace', href: '/marketplace', icon: <ShoppingBag className="w-5 h-5" /> },
    { name: 'Wiki-Files', href: '/wiki-files', icon: <FolderOpen className="w-5 h-5" /> },
    { name: 'Ruta Sancristobalina', href: '/carpooling', icon: <Car className="w-5 h-5" /> },
    { name: 'Job Board', href: '/jobs', icon: <Briefcase className="w-5 h-5" /> },
    { name: 'Ajustes', href: '/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  // Agregar Consola de Moderación si el usuario es administrador
  if (user && user.role === 'administrator') {
    navItems.splice(6, 0, { name: 'Moderación', href: '/moderation', icon: <ShieldAlert className="w-5 h-5" /> });
  }

  const handleLogout = () => {
    const confirmLogout = window.confirm(
      '🔐 ALERTA DE SEGURIDAD:\nSi estás utilizando una computadora de uso compartido (Biblioteca Central o Laboratorio), asegúrate de cerrar la pestaña del navegador por completo después de salir para destruir la sesión y resguardar tu información.'
    );
    if (confirmLogout) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'student':
        return 'Estudiante';
      case 'alumnus':
        return 'Egresado';
      case 'professor':
        return 'Docente';
      case 'administrator':
        return 'Administrador';
      default:
        return 'Comunidad';
    }
  };

  return (
    <aside className={`w-64 bg-white border-r border-secondary/15 h-screen flex flex-col justify-between p-6 select-none ${className}`}>
      <div className="flex flex-col gap-8">
        {/* Cabecera Sidebar — Logo institucional */}
        <div className="flex items-center justify-center min-h-[56px] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logos/logo-social-unsch.svg"
            alt="SOCIAL-UNSCH"
            className="h-14 w-auto object-contain mx-auto"
          />
        </div>

        {/* Perfil del Alumno Verificado */}
        {user && (
          <div className="flex flex-col gap-2 p-3.5 bg-surface/55 border border-secondary/10 rounded-2xl text-left">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm uppercase">
                {user.full_name.substring(0, 2)}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-primary truncate block">{user.full_name}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 mt-1">
                  {getRoleBadge(user.role)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1 border-t border-secondary/5 pt-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
              <span className="text-[10px] font-bold text-neutral-gray truncate tracking-wide">
                {user.email}
              </span>
            </div>
          </div>
        )}

        {/* Navegación Core (Sección 3.1) */}
        <nav className="flex flex-col gap-1 text-left">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all ${
                  isActive
                    ? 'bg-primary text-surface shadow-sm'
                    : 'text-neutral-gray/85 hover:bg-secondary/10 hover:text-primary'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Acciones del pie del Sidebar */}
      <div className="flex flex-col gap-1.5 border-t border-secondary/10 pt-4 text-left">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold tracking-wide text-primary hover:bg-primary/5 transition-all text-left w-full cursor-pointer focus:outline-none"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
