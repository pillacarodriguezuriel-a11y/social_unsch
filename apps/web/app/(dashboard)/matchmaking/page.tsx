'use client';

import React, { useState, useEffect } from 'react';
import { MatchmakingFilters } from '../../../components/ui/MatchmakingFilters';
import { DiscoveryDeck } from '../../../components/ui/DiscoveryDeck';
import { MatchCelebrationModal } from '../../../components/ui/MatchCelebrationModal';
import { ProfileCardData } from '../../../components/ui/ProfileSplitCard';
import { api } from '../../lib/api';
import { Alert } from '../../../components/ui/Alert';
import { Users, Info } from 'lucide-react';
import { PROFESSIONAL_SCHOOLS } from '../../lib/unsch.constants';

export default function MatchmakingPage() {
  const [profiles, setProfiles] = useState<ProfileCardData[]>([]);
  const [filters, setFilters] = useState<{ faculty: string; projectType: string; skills: string[] }>({
    faculty: '',
    projectType: '',
    skills: [],
  });

  const [loading, setLoading] = useState(true);
  const [errorAlert, setErrorAlert] = useState<{ message: string; code: string } | null>(null);
  const [celebrationMatch, setCelebrationMatch] = useState<{
    chatChannelId: string | null;
    contactInfo: ProfileCardData;
  } | null>(null);

  // Habilidades de prueba del alumno logueado para cálculo de afinidades
  const currentUserSkills = ['Python', 'SQL', 'React', 'TypeScript', 'Normas APA', 'Investigación'];

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/matchmaking/profiles');
      
      // Simular/cargar las habilidades de los perfiles ficticios para la demo
      const rawProfiles = response.data.data;
      
      const parsedProfiles = rawProfiles.map((p: any, idx: number) => {
        // Asignar habilidades ofrecidas y requeridas ficticias para visualización
        const mockSkillsOffered = [
          ['Python', 'SQL', 'Power BI'],
          ['Diseño Gráfico', 'Photoshop', 'UI/UX'],
          ['Redacción Académica', 'Normas APA', 'Investigación'],
          ['Derecho Penal', 'Oratoria', 'Litigación'],
        ];
        
        const mockSkillsNeeded = [
          ['React', 'TypeScript', 'Tailwind'],
          ['Figma', 'Diseño de Logos', 'Ilustración'],
          ['Python', 'Estadística', 'Investigación'],
          ['Derecho Procesal', 'Investigación', 'Normas APA'],
        ];

        const skillsOffered = mockSkillsOffered[idx % mockSkillsOffered.length];
        const skillsNeeded = mockSkillsNeeded[idx % mockSkillsNeeded.length];

        // Calcular afinidad del lado del cliente coincidiendo con la especificación del Algoritmo UNSCH-301
        const normalizedUser = currentUserSkills.map(s => s.toLowerCase().trim());
        const normalizedNeeded = skillsNeeded.map(s => s.toLowerCase().trim());
        const normalizedOffered = skillsOffered.map(s => s.toLowerCase().trim());

        const matchesNeeded = normalizedUser.filter(s => normalizedNeeded.includes(s));
        const matchesOffered = normalizedUser.filter(s => normalizedOffered.includes(s));

        let score = 0;
        if (normalizedNeeded.length > 0) {
          score = (matchesNeeded.length / normalizedNeeded.length) * 100;
        } else {
          score = (matchesOffered.length / Math.max(normalizedOffered.length, 1)) * 100;
        }

        const affinityScore = parseFloat(score.toFixed(2));
        let affinityLevel: 'Alta' | 'Media' | 'Baja' = 'Baja';
        if (affinityScore >= 75.0) {
          affinityLevel = 'Alta';
        } else if (affinityScore >= 40.0) {
          affinityLevel = 'Media';
        }

        const matchedSkills = currentUserSkills.filter(s => {
          const norm = s.toLowerCase().trim();
          return normalizedNeeded.includes(norm) || normalizedOffered.includes(norm);
        });

        const targetSkillsSource = skillsNeeded.length > 0 ? skillsNeeded : skillsOffered;
        const missingSkills = targetSkillsSource.filter(
          s => !normalizedUser.includes(s.toLowerCase().trim())
        );

        return {
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          role: p.role,
          project_type: p.project_type,
          description: p.description,
          school_id: (idx % 31) + 1, // Simular IDs de escuela del 1 al 31 de forma equilibrada
          affinity_score: affinityScore,
          affinity_level: affinityLevel,
          matched_skills: matchedSkills,
          missing_skills: missingSkills,
          skills_offered: skillsOffered,
          skills_needed: skillsNeeded,
          project_title: `Proyecto de Colaboración de ${p.full_name}`,
        };
      });

      // Ordenar por nivel de afinidad descendente para priorizar compatibilidad alta
      parsedProfiles.sort((a: any, b: any) => b.affinity_score - a.affinity_score);

      setProfiles(parsedProfiles);
    } catch (err: any) {
      console.error('Error al cargar perfiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleFiltersChange = (newFilters: { faculty: string; projectType: string; skills: string[] }) => {
    setFilters(newFilters);
  };

  // Filtrar perfiles localmente en el mazo según los dropdowns y los badges de habilidades
  const filteredProfiles = profiles.filter((p) => {
    if (filters.faculty) {
      const school = PROFESSIONAL_SCHOOLS.find(s => s.id === p.school_id);
      if (!school || String(school.faculty_id) !== filters.faculty) return false;
    }
    if (filters.projectType && p.project_type !== filters.projectType) return false;
    
    if (filters.skills.length > 0) {
      const skillsSource = [...(p.skills_needed || []), ...(p.skills_offered || [])];
      const lowerSource = skillsSource.map((s) => s.toLowerCase().trim());
      const hasMatch = filters.skills.some((tag) => lowerSource.includes(tag.toLowerCase().trim()));
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 select-none max-w-4xl mx-auto">
      
      {/* Cabecera del Portal */}
      <div className="text-left flex flex-col gap-1.5">
        <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
          <Users className="w-6 h-6 text-primary" />
          Conexión Sancristobalina
        </h1>
        <p className="text-xs text-neutral-gray font-medium leading-relaxed">
          Encuentra compañeros ideales para tus tesis o proyectos académicos aplicando filtros curriculares de afinidad.
        </p>
      </div>

      {/* Alerta de Error General */}
      {errorAlert && (
        <Alert
          title="Fallo de Interacción"
          description={errorAlert.message}
          variant="error"
        />
      )}

      {/* Filtros Superiores */}
      <MatchmakingFilters onFiltersChange={handleFiltersChange} />

      {/* Mazo de Descubrimiento */}
      {loading ? (
        <div className="bg-white border border-secondary/15 rounded-3xl p-16 text-center shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-xs text-neutral-gray mt-4 font-bold">Buscando perfiles compatibles...</p>
        </div>
      ) : (
        <DiscoveryDeck
          profiles={filteredProfiles}
          onMatch={setCelebrationMatch}
          onQueueEmpty={() => console.log('Cola vacía')}
          onInteractionError={setErrorAlert}
        />
      )}

      {/* Leyenda Legal didáctica */}
      <div className="p-4 bg-tertiary/5 border border-tertiary/15 rounded-2xl text-left flex gap-3">
        <Info className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-tertiary font-bold leading-relaxed">
          <strong>Ley N° 29733 (Protección de Datos Personales):</strong> Para asegurar tu privacidad, SOCIAL-UNSCH no expone tus datos de contacto en las tarjetas de descubrimiento. Solo se revelarán tu correo y chat de comunicación al producirse un Match mutuo.
        </p>
      </div>

      {/* Modal de Doble Match (Celebración) */}
      <MatchCelebrationModal
        isOpen={celebrationMatch !== null}
        onClose={() => setCelebrationMatch(null)}
        matchData={celebrationMatch}
      />
    </div>
  );
}
