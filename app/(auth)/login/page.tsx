'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AuthTabs } from '../../../components/ui/AuthTabs';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validación básica en frontend
    if (!email || !password) {
      setError('Por favor, complete todos los campos.');
      setIsLoading(false);
      return;
    }

    if (!email.toLowerCase().endsWith('@unsch.edu.pe')) {
      setError('El correo electrónico debe pertenecer al dominio institucional @unsch.edu.pe');
      setIsLoading(false);
      return;
    }

    try {
      // Llamada real al backend Express en puerto 3000
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user } = response.data;

      // Persistir credenciales en localStorage para que el interceptor las use
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirigir al dashboard principal
      router.push('/');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Error al conectar con el servidor. Verifica tus credenciales.';
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-secondary/10 shadow-sm p-6 md:p-8 text-center">
      {/* Selector de Pestañas Duales */}
      <AuthTabs />

      {/* Título de Bienvenida */}
      <div className="text-left mb-6">
        <h2 className="text-xl font-bold text-primary">¡Hola de nuevo!</h2>
        <p className="text-xs text-neutral-gray mt-1">
          Ingresa tus credenciales institucionales para acceder a la red.
        </p>
      </div>

      <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
        {/* Input de Correo Institucional */}
        <Input
          type="email"
          label="Correo Institucional"
          placeholder="ejemplo@unsch.edu.pe"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4 text-neutral-gray/60" />}
          required
        />

        {/* Input de Contraseña con Botón de Visibilidad */}
        <Input
          type={showPassword ? 'text' : 'password'}
          label="Contraseña"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4 text-neutral-gray/60" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="focus:outline-none text-neutral-gray/60 hover:text-primary transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
          required
        />

        {/* Mensaje de Error en Login */}
        {error && (
          <div className="text-xs font-bold text-primary bg-primary/5 p-3 rounded-lg border border-primary/20 text-left">
            ⚠️ {error}
          </div>
        )}

        {/* Botón de envío */}
        <Button type="submit" isLoading={isLoading}>
          Ingresar al Portal
        </Button>
      </form>

      {/* Widget de Descargo de Seguridad Exclusivo */}
      <div className="mt-6 pt-6 border-t border-secondary/10 flex gap-2.5 items-start text-left bg-surface/50 p-3 rounded-xl border border-secondary/5">
        <ShieldCheck className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
        <p className="text-[11px] font-semibold text-neutral-gray leading-relaxed">
          <span className="text-primary font-bold">Acceso restringido.</span> Sistema protegido con verificación obligatoria de dominio @unsch.edu.pe. Las conexiones se registran con fines de seguridad.
        </p>
      </div>
    </div>
  );
}
