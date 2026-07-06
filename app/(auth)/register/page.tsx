'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, GraduationCap, ShieldAlert, ArrowRight, BookOpen } from 'lucide-react';
import { AuthTabs } from '../../../components/ui/AuthTabs';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { api } from '../../lib/api';
import { SCHOOLS_BY_FACULTY } from '../../lib/unsch.constants';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'alumnus' | 'professor' | 'administrator'>('student');
  const [schoolId, setSchoolId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Validación de dominio institucional en tiempo real
  const isEmailError = email.length > 0 && !email.toLowerCase().endsWith('@unsch.edu.pe');
  const emailHelperText = isEmailError
    ? 'El correo debe terminar en @unsch.edu.pe'
    : 'Solo cuentas institucionales verificadas.';

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    // Validaciones frontend
    if (!email.toLowerCase().endsWith('@unsch.edu.pe')) {
      setServerError('El correo electrónico debe pertenecer al dominio @unsch.edu.pe');
      return;
    }
    if (password.length < 8) {
      setServerError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      // Llamada real al backend Express en puerto 3000
      await api.post('/auth/register', {
        full_name: fullName,
        email,
        password,
        role,
        professional_school_id: schoolId ? parseInt(schoolId, 10) : null,
        current_academic_cycle: null,
      });

      setSuccessMessage('¡Cuenta creada exitosamente! Serás redirigido al inicio de sesión...');

      // Redirigir al login tras 2 segundos para que el usuario lea el mensaje
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Error al registrar. Verifica los datos e inténtalo de nuevo.';
      setServerError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-secondary/10 shadow-sm p-6 md:p-8 text-center transition-all duration-300">
      {/* Selector de Pestañas Duales */}
      <AuthTabs />

      {/* Cabecera del formulario */}
      <div className="text-left mb-6">
        <h2 className="text-xl font-bold text-primary">Crea tu cuenta</h2>
        <p className="text-xs text-neutral-gray mt-1">
          Únete a la comunidad académica digital más activa de Ayacucho.
        </p>
      </div>

      {/* Mensaje de éxito */}
      {successMessage && (
        <div className="mb-4 text-xs font-bold text-green-700 bg-green-50 p-3 rounded-lg border border-green-200 text-left flex items-center gap-2">
          ✅ {successMessage}
        </div>
      )}

      {/* Mensaje de error del servidor */}
      {serverError && (
        <div className="mb-4 text-xs font-bold text-primary bg-primary/5 p-3 rounded-lg border border-primary/20 text-left">
          ⚠️ {serverError}
        </div>
      )}

      <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
        {/* Input de Nombre Completo */}
        <Input
          type="text"
          label="Nombre Completo"
          placeholder="Juan Carlos Quispe Huamaní"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          leftIcon={<User className="w-4 h-4 text-neutral-gray/60" />}
          required
        />

        {/* Input de Correo Institucional con validación dinámica */}
        <Input
          type="email"
          label="Correo Institucional"
          placeholder="ejemplo@unsch.edu.pe"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={isEmailError}
          helperText={emailHelperText}
          leftIcon={
            isEmailError ? (
              <ShieldAlert className="w-4 h-4 text-primary" />
            ) : (
              <Mail className="w-4 h-4 text-neutral-gray/60" />
            )
          }
          required
        />

        {/* Selección de Rol */}
        <div className="w-full flex flex-col gap-1.5 text-left">
          <label className="text-xs font-bold text-neutral-gray uppercase tracking-wider">
            Tipo de Usuario
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            required
            className="w-full px-4 py-3 text-sm font-medium bg-white border border-secondary/40 text-primary rounded-xl transition-all outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary appearance-none cursor-pointer"
          >
            <option value="student">Estudiante</option>
            <option value="alumnus">Egresado</option>
            <option value="professor">Docente</option>
          </select>
        </div>

        {/* Selección de Escuela Profesional */}
        <div className="w-full flex flex-col gap-1.5 text-left">
          <label className="text-xs font-bold text-neutral-gray uppercase tracking-wider">
            Escuela Profesional
          </label>
          <div className="relative flex items-center w-full">
            <GraduationCap className="absolute left-4 w-4 h-4 text-neutral-gray/60 pointer-events-none" />
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 text-sm font-medium bg-white border border-secondary/40 text-primary rounded-xl transition-all outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">Selecciona tu carrera...</option>
              {SCHOOLS_BY_FACULTY.map((group) => (
                <optgroup key={group.faculty.id} label={`${group.faculty.name} (${group.faculty.abbreviation})`}>
                  {group.schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Input de Contraseña */}
        <Input
          type="password"
          label="Contraseña"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4 text-neutral-gray/60" />}
          required
        />

        {/* Botón de envío */}
        <Button
          type="submit"
          disabled={isEmailError || !!successMessage}
          isLoading={isLoading}
          className={isEmailError ? 'bg-neutral-gray/30 text-neutral-gray/60 cursor-not-allowed shadow-none hover:bg-neutral-gray/30 border-transparent' : ''}
        >
          Crear Cuenta
        </Button>
      </form>

      {/* Bloque informativo para cachimbos */}
      <div className="mt-6 p-4 rounded-xl border border-secondary/15 bg-surface text-left flex flex-col gap-2">
        <div className="flex gap-2 items-center text-primary">
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">¿Eres ingresante (cachimbo)?</span>
        </div>
        <p className="text-[11px] font-semibold text-neutral-gray leading-relaxed">
          Las cuentas institucionales se activan automáticamente hasta 72 horas después del proceso de matrícula. Si necesitas activar tu correo, contacta a la OTI.
        </p>
        <a
          href="https://oti.unsch.edu.pe/manual-correo"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-xs font-bold text-primary hover:underline flex items-center gap-1 group w-fit cursor-pointer"
        >
          Manual de Activación de Correo UNSCH
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}
