'use client';

import React from 'react';
import { ShieldCheck, Award, Briefcase, Code } from 'lucide-react';
import { SCHOOL_NAME_BY_ID, PROJECT_TYPE_LABEL } from '../../app/lib/unsch.constants';

export interface ProfileCardData {
  id: string; // profile_id
  user_id: string;
  full_name: string;
  role: string;
  project_type: string;
  description: string;
  school_id: number | null;
  // Campos del algoritmo de puntuación
  affinity_score?: number;
  affinity_level?: 'Alta' | 'Media' | 'Baja';
  matched_skills?: string[];
  missing_skills?: string[];
  skills_offered?: string[];
  skills_needed?: string[];
  project_title?: string;
  email?: string;
}

interface ProfileSplitCardProps {
  profile: ProfileCardData;
}

export function ProfileSplitCard({ profile }: ProfileSplitCardProps) {
  const getSchoolLabel = (schoolId: number | null) => {
    return schoolId ? SCHOOL_NAME_BY_ID[schoolId] || `Escuela Profesional ${schoolId}` : 'Comunidad General';
  };

  const getAffinityBadgeStyles = (level?: 'Alta' | 'Media' | 'Baja') => {
    switch (level) {
      case 'Alta':
        return 'bg-primary text-surface border-primary/20 shadow-sm';
      case 'Media':
        return 'bg-secondary/15 text-secondary border-secondary/25';
      default:
        return 'bg-neutral-gray/10 text-neutral-gray/70 border-neutral-gray/20';
    }
  };

  const getProjectTypeLabel = (type: string) => {
    return PROJECT_TYPE_LABEL[type.toLowerCase()] || type.toUpperCase();
  };

  const skillsNeeded = profile.skills_needed || [];
  const skillsOffered = profile.skills_offered || [];
  const matched = profile.matched_skills?.map((s) => s.toLowerCase().trim()) || [];

  return (
    <div className="bg-white border border-secondary/15 rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-5 min-h-[420px] select-none text-left">
      
      {/* Panel Izquierdo: Ficha del Perfil del Estudiante (md:col-span-2) */}
      <div className="md:col-span-2 bg-surface/35 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-secondary/15 relative">
        
        {/* Floating Affinity Badge */}
        {profile.affinity_score !== undefined && (
          <div className="absolute top-4 right-4">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black border ${getAffinityBadgeStyles(
                profile.affinity_level
              )}`}
            >
              <Award className="w-3.5 h-3.5" />
              {profile.affinity_score}% Afin
            </span>
          </div>
        )}

        {/* Datos Personales */}
        <div className="flex flex-col gap-4 mt-6">
          <div className="w-16 h-16 rounded-3xl bg-primary/5 border border-primary/15 flex items-center justify-center font-black text-primary text-2xl uppercase">
            {profile.full_name.substring(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-black text-primary tracking-tight">
                {profile.full_name}
              </h2>
              <span title="Estudiante Verificado">
                <ShieldCheck className="w-5 h-5 text-secondary" />
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-gray/85 mt-0.5">
              {getSchoolLabel(profile.school_id)}
            </p>
          </div>
        </div>

        {/* Resumen del Perfil */}
        <div className="flex flex-col gap-3.5 mt-6 pt-4 border-t border-secondary/10">
          <div className="flex gap-2">
            <Briefcase className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-gray font-medium leading-relaxed">
              {profile.description || 'Sin descripción académica de perfil.'}
            </p>
          </div>
        </div>
      </div>

      {/* Panel Derecho: Propuesta del Proyecto y Habilidades (md:col-span-3) */}
      <div className="md:col-span-3 p-6 flex flex-col justify-between bg-white">
        
        {/* Pitch del Proyecto */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black tracking-widest text-secondary block">
            {getProjectTypeLabel(profile.project_type)}
          </span>
          <h3 className="text-md font-extrabold text-primary leading-snug">
            {profile.project_title || 'Propuesta de Proyecto de Colaboración'}
          </h3>
          <p className="text-xs text-neutral-gray leading-relaxed font-medium">
            Interesado en formar equipos académicos multidisciplinarios para desarrollo técnico, tesis o proyectos de investigación conjuntos en la UNSCH.
          </p>
        </div>

        {/* Habilidades Ledger */}
        <div className="flex flex-col gap-4 mt-6 pt-4 border-t border-secondary/5">
          
          {/* Mis Habilidades (Ofrecidas) */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-wider flex items-center gap-1">
              <Code className="w-3.5 h-3.5" />
              Habilidades Ofrecidas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {skillsOffered.length > 0 ? (
                skillsOffered.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 bg-surface border border-secondary/10 text-neutral-gray text-[10px] font-bold rounded-lg"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-neutral-gray/50 italic">Ninguna cargada</span>
              )}
            </div>
          </div>

          {/* Busco (Requeridas con match resaltado) */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              Habilidades Requeridas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {skillsNeeded.length > 0 ? (
                skillsNeeded.map((skill) => {
                  const isMatch = matched.includes(skill.toLowerCase().trim());
                  return (
                    <span
                      key={skill}
                      className={`px-2.5 py-1 border text-[10px] font-bold rounded-lg transition-all ${
                        isMatch
                          ? 'bg-primary text-surface border-primary/20 shadow-sm scale-105'
                          : 'bg-surface border-secondary/10 text-neutral-gray'
                      }`}
                    >
                      {skill}
                    </span>
                  );
                })
              ) : (
                <span className="text-[10px] text-neutral-gray/50 italic font-medium">Cualquier perfil académico</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
