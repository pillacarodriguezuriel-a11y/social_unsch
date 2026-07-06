'use client';

import React, { useState } from 'react';
import {
  Briefcase,
  MapPin,
  Clock,
  Search,
  Filter,
  ExternalLink,
  Building2,
  GraduationCap,
  Banknote,
  CheckCircle,
  BookOpen,
  ChevronRight,
  Info,
  Star,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';

type JobType = 'all' | 'internship' | 'part_time' | 'full_time' | 'remote' | 'research';
type JobArea = 'all' | 'tech' | 'admin' | 'health' | 'engineering' | 'law' | 'education';

interface Job {
  id: string;
  title: string;
  company: string;
  company_type: 'empresa' | 'ong' | 'gobierno' | 'startup' | 'universidad';
  area: JobArea;
  type: Exclude<JobType, 'all'>;
  location: string;
  is_remote: boolean;
  salary_range: string | null;
  description: string;
  requirements: string[];
  preferred_careers: string[];
  posted_at: string;
  deadline: string;
  is_featured: boolean;
  contact_email: string;
  source_url: string | null;
}

const JOBS: Job[] = [
  {
    id: 'j1',
    title: 'Practicante de Desarrollo de Software',
    company: 'Gobierno Regional de Ayacucho',
    company_type: 'gobierno',
    area: 'tech',
    type: 'internship',
    location: 'Ayacucho, Perú',
    is_remote: false,
    salary_range: 'S/. 1,200/mes',
    description: 'Apoyar al equipo de TI en el desarrollo y mantenimiento de sistemas de gestión interna. Se trabaja con tecnologías web modernas y bases de datos PostgreSQL.',
    requirements: ['Estudiante desde 7° ciclo', 'Conocimientos en JavaScript o Python', 'Bases de datos relacionales'],
    preferred_careers: ['Ingeniería de Sistemas', 'Ingeniería de Computación'],
    posted_at: '2026-07-01T00:00:00Z',
    deadline: '2026-07-20T00:00:00Z',
    is_featured: true,
    contact_email: 'practicas@regionayacucho.gob.pe',
    source_url: null,
  },
  {
    id: 'j2',
    title: 'Asistente de Investigación — Proyecto FONDECYT',
    company: 'UNSCH — Instituto de Investigación',
    company_type: 'universidad',
    area: 'research',
    type: 'research',
    location: 'Ciudad Universitaria UNSCH',
    is_remote: false,
    salary_range: 'S/. 800/mes',
    description: 'Colaboración en proyecto de investigación sobre impacto de tecnologías digitales en comunidades rurales de Ayacucho. Trabajo de campo y análisis de datos.',
    requirements: ['Estudiante de pregrado o egresado', 'Habilidades de redacción académica', 'Normas APA', 'Disponibilidad para trabajo de campo'],
    preferred_careers: ['Ingeniería de Sistemas', 'Administración', 'Derecho', 'Cualquier carrera'],
    posted_at: '2026-06-28T00:00:00Z',
    deadline: '2026-07-15T00:00:00Z',
    is_featured: true,
    contact_email: 'investigacion@unsch.edu.pe',
    source_url: null,
  },
  {
    id: 'j3',
    title: 'Tutor Académico (Matemáticas / Cálculo)',
    company: 'Centro Preuniversitario UNSCH — CEPRE',
    company_type: 'universidad',
    area: 'education',
    type: 'part_time',
    location: 'Ciudad Universitaria UNSCH',
    is_remote: false,
    salary_range: 'S/. 25/hora',
    description: 'Dictar clases de reforzamiento de Matemáticas y Cálculo a estudiantes preuniversitarios del CEPRE UNSCH los fines de semana.',
    requirements: ['Promedio mínimo de 14 en cursos de matemáticas', 'Habilidades de comunicación', 'Disponibilidad sábados y domingos'],
    preferred_careers: ['Ingeniería de Sistemas', 'Ingeniería Civil', 'Ingeniería de Minas', 'Matemáticas'],
    posted_at: '2026-07-03T00:00:00Z',
    deadline: '2026-07-25T00:00:00Z',
    is_featured: false,
    contact_email: 'cepre@unsch.edu.pe',
    source_url: null,
  },
  {
    id: 'j4',
    title: 'Desarrollador Full-Stack (Freelance/Remoto)',
    company: 'AgroTech Ayacucho S.A.C.',
    company_type: 'startup',
    area: 'tech',
    type: 'remote',
    location: 'Remoto — Perú',
    is_remote: true,
    salary_range: 'S/. 2,500 – 4,000/mes',
    description: 'Startup de tecnología agraria busca desarrollador para construir plataforma de gestión de cultivos. Stack: React, Node.js, PostgreSQL. Trabajo 100% remoto con horario flexible.',
    requirements: ['React y Node.js', 'Experiencia con APIs REST', 'Control de versiones con Git', 'Inglés básico para documentación'],
    preferred_careers: ['Ingeniería de Sistemas', 'Computación', 'Cualquier carrera STEM'],
    posted_at: '2026-07-05T00:00:00Z',
    deadline: '2026-07-30T00:00:00Z',
    is_featured: true,
    contact_email: 'rrhh@agrotech-ayacucho.com',
    source_url: null,
  },
  {
    id: 'j5',
    title: 'Practicante de Contabilidad y Finanzas',
    company: 'Cámara de Comercio de Ayacucho',
    company_type: 'empresa',
    area: 'admin',
    type: 'internship',
    location: 'Ayacucho — Centro Histórico',
    is_remote: false,
    salary_range: 'S/. 1,000/mes',
    description: 'Apoyo en registro contable, elaboración de estados financieros y gestión tributaria. Aprendizaje práctico del sistema SIAF-SP y SUNAT en línea.',
    requirements: ['Estudiante desde 6° ciclo de Contabilidad o Administración', 'Conocimiento básico de Excel', 'Responsabilidad y puntualidad'],
    preferred_careers: ['Contabilidad', 'Administración de Empresas', 'Economía'],
    posted_at: '2026-07-02T00:00:00Z',
    deadline: '2026-07-18T00:00:00Z',
    is_featured: false,
    contact_email: 'practicantes@camarayacucho.pe',
    source_url: null,
  },
  {
    id: 'j6',
    title: 'Asistente Legal — Estudio Jurídico',
    company: 'Estudio Jurídico Quispe & Asociados',
    company_type: 'empresa',
    area: 'law',
    type: 'part_time',
    location: 'Jr. 28 de Julio, Ayacucho',
    is_remote: false,
    salary_range: 'S/. 900 – 1,100/mes',
    description: 'Apoyo en redacción de escritos judiciales, investigación jurisprudencial y gestión de expedientes. Excelente oportunidad de práctica profesional real.',
    requirements: ['Estudiante desde 8° ciclo de Derecho', 'Redacción legal', 'Manejo de expedientes'],
    preferred_careers: ['Derecho y Ciencias Políticas'],
    posted_at: '2026-07-04T00:00:00Z',
    deadline: '2026-07-22T00:00:00Z',
    is_featured: false,
    contact_email: 'contacto@quispe-asociados.pe',
    source_url: null,
  },
  {
    id: 'j7',
    title: 'Técnico en Soporte de Sistemas',
    company: 'DIRESA Ayacucho — Salud',
    company_type: 'gobierno',
    area: 'tech',
    type: 'full_time',
    location: 'Ayacucho — Jesús Nazareno',
    is_remote: false,
    salary_range: 'S/. 1,800/mes',
    description: 'Mantenimiento de equipos informáticos, soporte técnico a usuarios y administración de redes LAN en instalaciones de la Dirección Regional de Salud.',
    requirements: ['Egresado de Ingeniería de Sistemas o Computación', 'Redes y soporte técnico', 'Disponibilidad inmediata'],
    preferred_careers: ['Ingeniería de Sistemas', 'Computación e Informática'],
    posted_at: '2026-07-01T00:00:00Z',
    deadline: '2026-07-14T00:00:00Z',
    is_featured: false,
    contact_email: 'rrhhti@diresaayacucho.gob.pe',
    source_url: null,
  },
  {
    id: 'j8',
    title: 'Supervisor de Obras — Junior',
    company: 'Constructora Andina del Sur S.R.L.',
    company_type: 'empresa',
    area: 'engineering',
    type: 'full_time',
    location: 'Ayacucho y provincias',
    is_remote: false,
    salary_range: 'S/. 2,200 – 3,000/mes',
    description: 'Supervisión de proyectos de infraestructura vial y edificaciones en la región Ayacucho. Incluye trabajo en campo con viáticos cubiertos.',
    requirements: ['Egresado de Ingeniería Civil o Minas', 'AutoCAD básico', 'Licencia de conducir A1 (deseable)'],
    preferred_careers: ['Ingeniería Civil', 'Ingeniería de Minas'],
    posted_at: '2026-06-30T00:00:00Z',
    deadline: '2026-07-16T00:00:00Z',
    is_featured: false,
    contact_email: 'obras@andinadelsur.com.pe',
    source_url: null,
  },
];

const TYPE_LABELS: Record<Exclude<JobType, 'all'>, { label: string; color: string }> = {
  internship: { label: 'Pasantía',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  part_time:  { label: 'Tiempo Parcial', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  full_time:  { label: 'Tiempo Completo',color: 'bg-green-50 text-green-700 border-green-200' },
  remote:     { label: 'Remoto',         color: 'bg-violet-50 text-violet-700 border-violet-200' },
  research:   { label: 'Investigación',  color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

const COMPANY_TYPE_LABELS: Record<Job['company_type'], string> = {
  empresa:     'Empresa Privada',
  ong:         'ONG',
  gobierno:    'Sector Público',
  startup:     'Startup',
  universidad: 'Universidad',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

const daysLeft = (deadline: string) => {
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return diff;
};

export default function JobsPage() {
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState<JobType>('all');
  const [areaFilter, setAreaFilter] = useState<JobArea>('all');
  const [selected, setSelected]     = useState<Job | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [alert, setAlert]           = useState<{ title: string; description: string } | null>(null);

  const filtered = JOBS.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
                        j.company.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'all' || j.type === typeFilter;
    const matchArea   = areaFilter === 'all' || j.area === areaFilter;
    return matchSearch && matchType && matchArea;
  });

  const featured  = filtered.filter((j) => j.is_featured);
  const regular   = filtered.filter((j) => !j.is_featured);

  const handleApply = (job: Job) => {
    setAppliedIds((prev) => [...prev, job.id]);
    setAlert({
      title: '¡Postulación Registrada!',
      description: `Hemos enviado tu perfil UNSCH a ${job.company}. Revisa tu correo ${job.contact_email} para los próximos pasos.`,
    });
    setSelected(null);
    setTimeout(() => setAlert(null), 6000);
  };

  const renderJobCard = (job: Job) => {
    const days = daysLeft(job.deadline);
    const applied = appliedIds.includes(job.id);
    return (
      <div
        key={job.id}
        onClick={() => setSelected(job)}
        className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group text-left flex flex-col gap-3 ${
          job.is_featured ? 'border-primary/25 ring-1 ring-primary/10' : 'border-secondary/15 hover:border-primary/20'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            {job.is_featured && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-primary">
                <Star className="w-3 h-3 fill-primary" />
                DESTACADO
              </div>
            )}
            <h3 className="text-xs font-black text-primary leading-snug group-hover:text-primary/80 transition-colors">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-gray font-bold">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full shrink-0 ${TYPE_LABELS[job.type].color}`}>
            {TYPE_LABELS[job.type].label}
          </span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 text-[9px] text-neutral-gray font-bold">
            <MapPin className="w-3 h-3 text-secondary flex-shrink-0" />
            <span>{job.is_remote ? 'Remoto' : job.location}</span>
          </div>
          {job.salary_range && (
            <div className="flex items-center gap-1 text-[9px] text-neutral-gray font-bold">
              <Banknote className="w-3 h-3 text-secondary flex-shrink-0" />
              <span>{job.salary_range}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[9px] font-bold" style={{ color: days <= 5 ? '#c0392b' : '#6b7280' }}>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{days > 0 ? `${days} días restantes` : 'Vencido'}</span>
          </div>
        </div>

        {/* Carreras */}
        <div className="flex flex-wrap gap-1">
          {job.preferred_careers.slice(0, 3).map((c) => (
            <span key={c} className="text-[8px] font-bold px-1.5 py-0.5 bg-surface border border-secondary/10 rounded-md text-neutral-gray">
              {c}
            </span>
          ))}
          {job.preferred_careers.length > 3 && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-surface border border-secondary/10 rounded-md text-neutral-gray">
              +{job.preferred_careers.length - 3} más
            </span>
          )}
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-secondary/5">
          <span className="text-[9px] text-neutral-gray/60 font-medium">
            Publicado {formatDate(job.posted_at)}
          </span>
          {applied ? (
            <div className="flex items-center gap-1 text-[9px] font-bold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" />
              Postulado
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-bold text-primary group-hover:gap-2 transition-all">
              Ver Detalles
              <ChevronRight className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 select-none max-w-5xl mx-auto">

      {/* Cabecera */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
          <Briefcase className="w-6 h-6 text-primary" />
          Job Board Sancristobalino
        </h1>
        <p className="text-xs text-neutral-gray font-medium leading-relaxed">
          Ofertas laborales, pasantías y proyectos de investigación para la comunidad UNSCH. 
          Solo empleadores verificados con convenio institucional.
        </p>
      </div>

      {/* Alerta */}
      {alert && (
        <Alert title={alert.title} description={alert.description} variant="info" />
      )}

      {/* Filtros */}
      <div className="bg-white border border-secondary/15 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-gray/50" />
          <input
            type="text"
            placeholder="Buscar por puesto o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-secondary/15 rounded-xl text-xs font-medium text-primary placeholder:text-neutral-gray/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* Filtro tipo */}
        <div className="relative flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-neutral-gray/50 flex-shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as JobType)}
            className="bg-surface border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary outline-none focus:border-primary/50 cursor-pointer appearance-none pr-6"
          >
            <option value="all">Todos los tipos</option>
            <option value="internship">Pasantía</option>
            <option value="part_time">Tiempo Parcial</option>
            <option value="full_time">Tiempo Completo</option>
            <option value="remote">Remoto</option>
            <option value="research">Investigación</option>
          </select>
        </div>

        {/* Filtro área */}
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value as JobArea)}
          className="bg-surface border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary outline-none focus:border-primary/50 cursor-pointer appearance-none"
        >
          <option value="all">Todas las áreas</option>
          <option value="tech">Tecnología</option>
          <option value="admin">Admin / Finanzas</option>
          <option value="engineering">Ingeniería</option>
          <option value="health">Salud</option>
          <option value="law">Derecho</option>
          <option value="education">Educación</option>
          <option value="research">Investigación</option>
        </select>
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-gray">
          {filtered.length} oferta{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] text-neutral-gray/60 font-medium">
          Última actualización: Jul 2026
        </span>
      </div>

      {/* Grid de empleos */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-secondary/15 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center gap-4">
          <Briefcase className="w-12 h-12 text-neutral-gray/20" />
          <div>
            <p className="text-sm font-bold text-neutral-gray/60">No se encontraron ofertas</p>
            <p className="text-xs text-neutral-gray/40 mt-1">Intenta ajustar los filtros de búsqueda</p>
          </div>
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-primary" />
                Ofertas Destacadas
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featured.map(renderJobCard)}
              </div>
            </div>
          )}
          {regular.length > 0 && (
            <div className="flex flex-col gap-3">
              {featured.length > 0 && (
                <span className="text-xs font-bold text-neutral-gray uppercase tracking-wider">
                  Otras Ofertas
                </span>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {regular.map(renderJobCard)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Nota informativa */}
      <div className="p-4 bg-tertiary/5 border border-tertiary/15 rounded-2xl flex gap-3">
        <Info className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-tertiary font-bold leading-relaxed">
            <strong>Empleadores Verificados:</strong> Todas las ofertas provienen de empresas, instituciones públicas o proyectos con convenio vigente con la UNSCH. 
            Si deseas publicar una oferta como empleador, contacta a la Oficina de Empleabilidad y Proyección Social.
          </p>
          <p className="text-[10px] text-tertiary/80 font-semibold">
            Correo: <span className="font-bold">empleabilidad@unsch.edu.pe</span>
          </p>
        </div>
      </div>

      {/* Modal detalle */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex flex-col gap-4">
              {/* Header modal */}
              <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full w-fit ${TYPE_LABELS[selected.type].color}`}>
                    {TYPE_LABELS[selected.type].label}
                  </span>
                  <h2 className="text-base font-black text-primary leading-snug">{selected.title}</h2>
                  <p className="text-xs font-bold text-neutral-gray">{selected.company}</p>
                  <p className="text-[10px] text-neutral-gray/70 font-medium">{COMPANY_TYPE_LABELS[selected.company_type]}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-neutral-gray hover:text-primary transition-colors cursor-pointer mt-1 flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-2 bg-surface p-3.5 rounded-2xl border border-secondary/10">
                {[
                  { icon: <MapPin className="w-3.5 h-3.5 text-secondary" />, label: selected.is_remote ? 'Remoto' : selected.location },
                  { icon: <Banknote className="w-3.5 h-3.5 text-secondary" />, label: selected.salary_range || 'A convenir' },
                  { icon: <Clock className="w-3.5 h-3.5 text-secondary" />, label: `Cierra ${formatDate(selected.deadline)}` },
                  { icon: <Building2 className="w-3.5 h-3.5 text-secondary" />, label: COMPANY_TYPE_LABELS[selected.company_type] },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">Descripción del Puesto</span>
                <p className="text-xs text-neutral-gray font-medium leading-relaxed">{selected.description}</p>
              </div>

              {/* Requisitos */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">Requisitos</span>
                <ul className="flex flex-col gap-1.5">
                  {selected.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-medium text-neutral-gray">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Carreras */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Carreras de Preferencia
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selected.preferred_careers.map((c) => (
                    <span key={c} className="text-[10px] font-bold px-2 py-0.5 bg-primary/5 border border-primary/15 text-primary rounded-lg">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contacto */}
              <div className="flex items-center gap-2 text-[10px] text-neutral-gray bg-surface p-3 rounded-xl border border-secondary/10">
                <BookOpen className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                <span>Contacto directo: <strong className="text-primary">{selected.contact_email}</strong></span>
              </div>

              {/* Acción */}
              <Button
                onClick={() => handleApply(selected)}
                disabled={appliedIds.includes(selected.id)}
                className={`py-3 font-extrabold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 ${
                  appliedIds.includes(selected.id)
                    ? 'bg-green-500 text-white cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/95 text-surface'
                }`}
              >
                {appliedIds.includes(selected.id) ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Postulación Enviada
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Postular con mi Perfil UNSCH
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
