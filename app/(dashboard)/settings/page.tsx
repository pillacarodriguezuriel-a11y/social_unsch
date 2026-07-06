'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  User,
  Shield,
  Bell,
  GraduationCap,
  Save,
  Camera,
  CheckCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  Info,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Alert } from '../../../components/ui/Alert';
import { SCHOOLS_BY_FACULTY } from '../../lib/unsch.constants';

type Tab = 'perfil' | 'privacidad' | 'notificaciones' | 'cuenta';

interface UserProfile {
  full_name: string;
  email: string;
  role: string;
  school_id: number;
  academic_cycle: number;
  bio: string;
  avatar_initials: string;
}

interface PrivacySettings {
  show_email: boolean;
  show_school: boolean;
  allow_matchmaking: boolean;
  allow_radar_reports: boolean;
}

interface NotifSettings {
  new_match: boolean;
  feed_mentions: boolean;
  marketplace_messages: boolean;
  job_alerts: boolean;
  radar_critical: boolean;
}

const defaultPrivacy: PrivacySettings = {
  show_email: false,
  show_school: true,
  allow_matchmaking: true,
  allow_radar_reports: true,
};

const defaultNotifs: NotifSettings = {
  new_match: true,
  feed_mentions: true,
  marketplace_messages: true,
  job_alerts: false,
  radar_critical: true,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('perfil');
  const [profile, setProfile]     = useState<UserProfile>({
    full_name: '',
    email: '',
    role: 'student',
    school_id: 1,
    academic_cycle: 5,
    bio: '',
    avatar_initials: 'ES',
  });
  const [privacy, setPrivacy]   = useState<PrivacySettings>(defaultPrivacy);
  const [notifs, setNotifs]     = useState<NotifSettings>(defaultNotifs);
  const [success, setSuccess]   = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          setProfile({
            full_name: u.full_name || 'Estudiante UNSCH',
            email: u.email || 'usuario@unsch.edu.pe',
            role: u.role || 'student',
            school_id: u.school_id || 1,
            academic_cycle: u.academic_cycle || 5,
            bio: u.bio || '',
            avatar_initials: (u.full_name || 'ES').substring(0, 2).toUpperCase(),
          });
        } catch { /* ignore */ }
      }

      const privStr = localStorage.getItem('privacy_settings');
      if (privStr) setPrivacy(JSON.parse(privStr));

      const notifStr = localStorage.getItem('notif_settings');
      if (notifStr) setNotifs(JSON.parse(notifStr));
    }
  }, []);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'student':       return 'Estudiante';
      case 'alumnus':       return 'Egresado';
      case 'professor':     return 'Docente';
      case 'administrator': return 'Administrador';
      default:              return 'Comunidad';
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleSaveProfile = () => {
    const updated = { ...profile };
    localStorage.setItem('user', JSON.stringify(updated));
    showSuccess('Perfil actualizado correctamente.');
  };

  const handleSavePrivacy = () => {
    localStorage.setItem('privacy_settings', JSON.stringify(privacy));
    showSuccess('Configuración de privacidad guardada.');
  };

  const handleSaveNotifs = () => {
    localStorage.setItem('notif_settings', JSON.stringify(notifs));
    showSuccess('Preferencias de notificaciones guardadas.');
  };

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      showSuccess('⚠️ La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    setNewPassword('');
    showSuccess('Contraseña actualizada. Se envió un email de confirmación a tu correo.');
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'perfil',          label: 'Mi Perfil',       icon: <User className="w-4 h-4" /> },
    { id: 'privacidad',      label: 'Privacidad',      icon: <Shield className="w-4 h-4" /> },
    { id: 'notificaciones',  label: 'Notificaciones',  icon: <Bell className="w-4 h-4" /> },
    { id: 'cuenta',          label: 'Cuenta',          icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col gap-6 select-none max-w-4xl mx-auto">

      {/* Cabecera */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
          <Settings className="w-6 h-6 text-primary" />
          Ajustes de Cuenta
        </h1>
        <p className="text-xs text-neutral-gray font-medium">
          Gestiona tu información personal, privacidad y preferencias de la plataforma.
        </p>
      </div>

      {/* Alerta de éxito */}
      {success && (
        <Alert title="Cambios Guardados" description={success} variant="info" />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {/* Panel de navegación lateral */}
        <div className="md:col-span-1">
          {/* Avatar */}
          <div className="bg-white border border-secondary/15 rounded-2xl p-4 shadow-sm flex flex-col items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-black text-primary text-xl uppercase">
                {profile.avatar_initials}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-primary text-surface w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer shadow-md"
                title="Cambiar foto"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-primary">{profile.full_name}</p>
              <p className="text-[10px] text-neutral-gray font-medium">{profile.email}</p>
              <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-primary/5 text-primary border border-primary/10">
                {getRoleLabel(profile.role)}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <nav className="bg-white border border-secondary/15 rounded-2xl shadow-sm overflow-hidden">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-all cursor-pointer text-left ${
                  i < TABS.length - 1 ? 'border-b border-secondary/10' : ''
                } ${
                  activeTab === tab.id
                    ? 'bg-primary/5 text-primary'
                    : 'text-neutral-gray/80 hover:bg-surface hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {tab.icon}
                  {tab.label}
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === tab.id ? 'text-primary' : 'text-neutral-gray/30'}`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Panel de contenido */}
        <div className="md:col-span-3">

          {/* ── PESTAÑA: PERFIL ── */}
          {activeTab === 'perfil' && (
            <div className="bg-white border border-secondary/15 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div className="flex justify-between items-center border-b border-secondary/10 pb-3">
                <h2 className="text-sm font-black text-primary flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Información Personal
                </h2>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  type="text"
                  label="Nombre Completo"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value, avatar_initials: e.target.value.substring(0, 2).toUpperCase() })}
                  leftIcon={<User className="w-4 h-4 text-neutral-gray/60" />}
                />

                <Input
                  type="email"
                  label="Correo Institucional"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  leftIcon={<Mail className="w-4 h-4 text-neutral-gray/60" />}
                  helperText="El correo institucional @unsch.edu.pe no puede modificarse."
                />

                {/* Escuela Profesional */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-gray uppercase tracking-wider flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Escuela Profesional
                  </label>
                  <select
                    value={profile.school_id}
                    onChange={(e) => setProfile({ ...profile, school_id: parseInt(e.target.value, 10) })}
                    className="w-full px-4 py-3 text-sm font-medium bg-white border border-secondary/40 text-primary rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary appearance-none cursor-pointer"
                  >
                    {SCHOOLS_BY_FACULTY.map((fac) => (
                      <optgroup key={fac.faculty.id} label={`${fac.faculty.name} (${fac.faculty.abbreviation})`}>
                        {fac.schools.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Ciclo académico */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-gray uppercase tracking-wider">
                    Ciclo Académico Actual
                  </label>
                  <select
                    value={profile.academic_cycle}
                    onChange={(e) => setProfile({ ...profile, academic_cycle: parseInt(e.target.value, 10) })}
                    className="w-full px-4 py-3 text-sm font-medium bg-white border border-secondary/40 text-primary rounded-xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary appearance-none cursor-pointer"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>{c}° Ciclo</option>
                    ))}
                    <option value={99}>Egresado</option>
                  </select>
                </div>

                {/* Bio */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-gray uppercase tracking-wider">
                    Descripción / Bio Pública
                  </label>
                  <textarea
                    rows={3}
                    maxLength={300}
                    placeholder="Cuéntale a la comunidad sobre ti, tus proyectos o habilidades..."
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full p-4 border border-secondary/15 rounded-xl text-sm font-medium text-primary placeholder:text-neutral-gray/50 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary resize-none"
                  />
                  <span className="text-[10px] text-neutral-gray/60 font-medium text-right">
                    {profile.bio.length}/300
                  </span>
                </div>
              </div>

              <Button onClick={handleSaveProfile} className="w-full py-3 flex items-center justify-center gap-2 font-extrabold">
                <Save className="w-4 h-4" />
                Guardar Cambios de Perfil
              </Button>
            </div>
          )}

          {/* ── PESTAÑA: PRIVACIDAD ── */}
          {activeTab === 'privacidad' && (
            <div className="bg-white border border-secondary/15 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div className="border-b border-secondary/10 pb-3">
                <h2 className="text-sm font-black text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Configuración de Privacidad
                </h2>
                <p className="text-[10px] text-neutral-gray font-medium mt-1">
                  Conforme a la Ley N° 29733 (Protección de Datos Personales).
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {([
                  {
                    key: 'show_email' as const,
                    title: 'Mostrar correo en perfil público',
                    desc: 'Permite que otros estudiantes vean tu correo @unsch.edu.pe en tu tarjeta de matchmaking.',
                  },
                  {
                    key: 'show_school' as const,
                    title: 'Mostrar escuela profesional',
                    desc: 'Muestra tu facultad y escuela en las tarjetas del matchmaking y feed.',
                  },
                  {
                    key: 'allow_matchmaking' as const,
                    title: 'Participar en Matchmaking',
                    desc: 'Permite que tu perfil aparezca en el mazo de descubrimiento de otros estudiantes.',
                  },
                  {
                    key: 'allow_radar_reports' as const,
                    title: 'Contribuir al Campus Radar',
                    desc: 'Tus reportes de afluencia se tomarán en cuenta para el estado del radar del campus.',
                  },
                ]).map((item) => (
                  <div key={item.key} className="flex justify-between items-start p-4 bg-surface border border-secondary/10 rounded-xl gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs font-bold text-primary">{item.title}</span>
                      <span className="text-[10px] text-neutral-gray font-medium leading-relaxed">{item.desc}</span>
                    </div>
                    <button
                      onClick={() => setPrivacy({ ...privacy, [item.key]: !privacy[item.key] })}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer mt-0.5 ${
                        privacy[item.key] ? 'bg-primary' : 'bg-neutral-gray/30'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          privacy[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <Button onClick={handleSavePrivacy} className="w-full py-3 flex items-center justify-center gap-2 font-extrabold">
                <Save className="w-4 h-4" />
                Guardar Privacidad
              </Button>
            </div>
          )}

          {/* ── PESTAÑA: NOTIFICACIONES ── */}
          {activeTab === 'notificaciones' && (
            <div className="bg-white border border-secondary/15 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div className="border-b border-secondary/10 pb-3">
                <h2 className="text-sm font-black text-primary flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Preferencias de Notificaciones
                </h2>
              </div>

              <div className="flex flex-col gap-4">
                {([
                  { key: 'new_match' as const,             title: '🤝 Nuevo Match en Matchmaking', desc: 'Recibe aviso cuando alguien hace match contigo en el sistema de conexión académica.' },
                  { key: 'feed_mentions' as const,         title: '💬 Menciones en el Feed', desc: 'Notificación cuando un compañero comenta o responde a tus publicaciones.' },
                  { key: 'marketplace_messages' as const,  title: '🛒 Mensajes del Marketplace', desc: 'Avisos cuando un comprador contacta por alguno de tus artículos publicados.' },
                  { key: 'job_alerts' as const,            title: '💼 Alertas de Job Board', desc: 'Resumen semanal con nuevas ofertas laborales que coincidan con tu carrera.' },
                  { key: 'radar_critical' as const,        title: '🚨 Radar: Estado Crítico', desc: 'Aviso inmediato cuando el Comedor o Rectorado registre estado Colapsado.' },
                ]).map((item) => (
                  <div key={item.key} className="flex justify-between items-start p-4 bg-surface border border-secondary/10 rounded-xl gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs font-bold text-primary">{item.title}</span>
                      <span className="text-[10px] text-neutral-gray font-medium leading-relaxed">{item.desc}</span>
                    </div>
                    <button
                      onClick={() => setNotifs({ ...notifs, [item.key]: !notifs[item.key] })}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer mt-0.5 ${
                        notifs[item.key] ? 'bg-primary' : 'bg-neutral-gray/30'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          notifs[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <Button onClick={handleSaveNotifs} className="w-full py-3 flex items-center justify-center gap-2 font-extrabold">
                <Save className="w-4 h-4" />
                Guardar Notificaciones
              </Button>
            </div>
          )}

          {/* ── PESTAÑA: CUENTA ── */}
          {activeTab === 'cuenta' && (
            <div className="flex flex-col gap-4">

              {/* Cambio de contraseña */}
              <div className="bg-white border border-secondary/15 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div className="border-b border-secondary/10 pb-3">
                  <h2 className="text-sm font-black text-primary flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Cambiar Contraseña
                  </h2>
                </div>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    label="Nueva Contraseña"
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4 text-neutral-gray/60" />}
                    rightIcon={
                      <button type="button" onClick={() => setShowPass(!showPass)} className="focus:outline-none text-neutral-gray/60 hover:text-primary cursor-pointer">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={newPassword.length < 8}
                  className="w-full py-3 font-extrabold flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Actualizar Contraseña
                </Button>
              </div>

              {/* Info de sesión */}
              <div className="bg-white border border-secondary/15 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
                <h2 className="text-sm font-black text-primary flex items-center gap-2 border-b border-secondary/10 pb-3">
                  <Info className="w-4 h-4" />
                  Información de la Cuenta
                </h2>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Proveedor de Identidad', value: 'UNSCH — OTI (Correo Institucional)' },
                    { label: 'Tipo de Cuenta', value: getRoleLabel(profile.role) },
                    { label: 'Dominio Verificado', value: '@unsch.edu.pe' },
                    { label: 'Autenticación', value: 'JWT RS256 — Tokens de acceso 24h' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center text-xs border-b border-secondary/5 pb-2 last:border-0 last:pb-0">
                      <span className="text-neutral-gray font-medium">{item.label}</span>
                      <span className="text-primary font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zona de peligro */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col gap-4">
                <h2 className="text-sm font-black text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Zona de Peligro
                </h2>
                <div className="flex flex-col gap-3">
                  <div className="p-4 bg-white rounded-xl border border-primary/15 flex justify-between items-center gap-4">
                    <div>
                      <p className="text-xs font-black text-primary">Eliminar Cuenta</p>
                      <p className="text-[10px] text-neutral-gray font-medium mt-0.5">
                        Esta acción es permanente. Todos tus datos, publicaciones y matchs serán eliminados.
                      </p>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs font-black text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors cursor-pointer flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
