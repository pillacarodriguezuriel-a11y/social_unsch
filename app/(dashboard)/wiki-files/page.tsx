'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  ChevronRight, 
  Download, 
  Upload, 
  FileText, 
  ThumbsUp, 
  Coins, 
  ArrowLeft,
  X,
  Search,
  BookOpen,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { RepositoryEmptyState } from '../../../components/ui/RepositoryEmptyState';

interface AcademicFile {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  school_id: number;
  course_id: number;
  academic_cycle: number;
  file_url: string;
  votes_count: number;
  credit_cost: number;
  file_type: 'PDF' | 'DOCX';
  created_at: string;
}

import { FACULTIES, PROFESSIONAL_SCHOOLS } from '../../lib/unsch.constants';

const SCHOOLS = PROFESSIONAL_SCHOOLS;

const COURSES = [
  { id: 1, school_id: 20, name: 'Algoritmos y Estructura de Datos', cycle: 3 },
  { id: 2, school_id: 20, name: 'Base de Datos II', cycle: 5 },
  { id: 3, school_id: 20, name: 'Sistemas Operativos', cycle: 5 }, // Empezará vacío
  { id: 4, school_id: 20, name: 'Redes y Conectividad', cycle: 6 }
];

const INITIAL_FILES: AcademicFile[] = [
  {
    id: 'f1',
    title: 'Examen Parcial 2025-II - Algoritmos Resuelto',
    owner_id: 'u2',
    owner_name: 'Juan Carlos Quispe',
    school_id: 20,
    course_id: 1,
    academic_cycle: 3,
    file_url: '#',
    votes_count: 18,
    credit_cost: 1,
    file_type: 'PDF',
    created_at: '2026-05-10T12:00:00Z'
  },
  {
    id: 'f2',
    title: 'Formulario Completo de Complejidad Algorítmica Big-O',
    owner_id: 'u3',
    owner_name: 'Ana María Huamán',
    school_id: 20,
    course_id: 1,
    academic_cycle: 3,
    file_url: '#',
    votes_count: 9,
    credit_cost: 1,
    file_type: 'DOCX',
    created_at: '2026-06-15T15:30:00Z'
  },
  {
    id: 'f3',
    title: 'Práctica Calificada 2 (2026-I) - SQL Avanzado y Triggers',
    owner_id: 'u4',
    owner_name: 'Carlos Mendoza',
    school_id: 20,
    course_id: 2,
    academic_cycle: 5,
    file_url: '#',
    votes_count: 24,
    credit_cost: 1,
    file_type: 'PDF',
    created_at: '2026-07-02T10:15:00Z'
  },
  {
    id: 'f4',
    title: 'Laboratorio de Enrutamiento Dinámico con OSPF y RIPv2',
    owner_id: 'u5',
    owner_name: 'Sofía Prado',
    school_id: 20,
    course_id: 4,
    academic_cycle: 6,
    file_url: '#',
    votes_count: 14,
    credit_cost: 1,
    file_type: 'PDF',
    created_at: '2026-06-28T09:00:00Z'
  }
];

export default function WikiFilesPage() {
  // Navigation State
  const [currentFaculty, setCurrentFaculty] = useState<typeof FACULTIES[0] | null>(null);
  const [currentSchool, setCurrentSchool] = useState<typeof SCHOOLS[0] | null>(null);
  const [currentCourse, setCurrentCourse] = useState<typeof COURSES[0] | null>(null);

  // Data & Local Persistence State
  const [files, setFiles] = useState<AcademicFile[]>([]);
  const [credits, setCredits] = useState(5);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; description: string; variant: 'info' | 'warning' | 'error' } | null>(null);
  const [votedFiles, setVotedFiles] = useState<string[]>([]);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'PDF' | 'DOCX'>('PDF');
  const [newCycle, setNewCycle] = useState(3);
  const [newCost, setNewCost] = useState(1);

  // Hydrate State from LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCredits = localStorage.getItem('user_credits');
      if (storedCredits) setCredits(parseInt(storedCredits));

      const storedDownloads = localStorage.getItem('downloaded_files');
      if (storedDownloads) setDownloadedFiles(JSON.parse(storedDownloads));

      const storedFiles = localStorage.getItem('academic_files');
      if (storedFiles) {
        setFiles(JSON.parse(storedFiles));
      } else {
        setFiles(INITIAL_FILES);
        localStorage.setItem('academic_files', JSON.stringify(INITIAL_FILES));
      }
    }
  }, []);

  const updateCredits = (newBalance: number) => {
    setCredits(newBalance);
    localStorage.setItem('user_credits', String(newBalance));
    
    // Also trigger update on mock logged-in user in Sidebar
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        parsedUser.credits_balance = newBalance;
        localStorage.setItem('user', JSON.stringify(parsedUser));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDownload = (file: AcademicFile) => {
    const isDownloaded = downloadedFiles.includes(file.id);

    if (isDownloaded) {
      // Free download flow (redownload_free within current semester)
      setAlertInfo({
        title: 'Re-descarga Autorizada',
        description: `El archivo "${file.title}" ya fue adquirido este semestre. Descarga gratuita autorizada (redownload_free).`,
        variant: 'info'
      });
      // Simulate file download
      triggerFileDownload(file.title);
    } else {
      // Normal transaction
      if (credits < file.credit_cost) {
        setAlertInfo({
          title: 'Saldo Insuficiente',
          description: `No tienes suficientes créditos para descargar "${file.title}". Necesitas ${file.credit_cost} crédito(s) y cuentas con ${credits}.`,
          variant: 'error'
        });
        return;
      }

      // Deduct credit and mark as downloaded
      const nextCredits = credits - file.credit_cost;
      const nextDownloads = [...downloadedFiles, file.id];
      
      updateCredits(nextCredits);
      setDownloadedFiles(nextDownloads);
      localStorage.setItem('downloaded_files', JSON.stringify(nextDownloads));

      // In a real environment, the trigger fn_process_file_download would add +2 to uploader.
      // Let's reflect this in our local simulated files list by finding the owner and printing an audit message
      setAlertInfo({
        title: 'Descarga Realizada Exitosamente',
        description: `Se descontó -${file.credit_cost} crédito de tu balance. Se han acreditado +2 al autor (${file.owner_name}) atómicamente en el ledger.`,
        variant: 'info'
      });

      triggerFileDownload(file.title);
    }
  };

  const triggerFileDownload = (title: string) => {
    // Simulated browser download trigger
    console.log(`[Wiki-Files]: Downloading file: ${title}`);
    const link = document.createElement('a');
    link.href = '#';
    link.setAttribute('download', title);
    document.body.appendChild(link);
    // Remove element
    setTimeout(() => document.body.removeChild(link), 100);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTitle.trim()) {
      alert('Por favor ingresa un título para el documento.');
      return;
    }

    if (!currentSchool || !currentCourse) return;

    const newFile: AcademicFile = {
      id: `f_${Date.now()}`,
      title: newTitle,
      owner_id: 'u1',
      owner_name: 'Estudiante Logueado',
      school_id: currentSchool.id,
      course_id: currentCourse.id,
      academic_cycle: newCycle,
      file_url: '#',
      votes_count: 0,
      credit_cost: newCost,
      file_type: newType,
      created_at: new Date().toISOString()
    };

    const nextFiles = [...files, newFile];
    setFiles(nextFiles);
    localStorage.setItem('academic_files', JSON.stringify(nextFiles));

    // Award +2 credits for approved upload (simulation)
    updateCredits(credits + 2);

    setAlertInfo({
      title: '¡Aporte Publicado Correctamente!',
      description: `Has subido "${newTitle}" al repositorio. Se te han abonado +2 créditos atómicos por tu contribución académica.`,
      variant: 'info'
    });

    // Reset Form
    setNewTitle('');
    setIsUploadOpen(false);
  };

  const handleVote = (fileId: string) => {
    if (votedFiles.includes(fileId)) return;

    setFiles(prevFiles => {
      const next = prevFiles.map(f => {
        if (f.id === fileId) {
          return { ...f, votes_count: f.votes_count + 1 };
        }
        return f;
      });
      localStorage.setItem('academic_files', JSON.stringify(next));
      return next;
    });

    setVotedFiles(prev => [...prev, fileId]);
  };

  // Filter files matching active course and search query
  const courseFiles = files.filter(f => {
    if (!currentCourse) return false;
    const matchesCourse = f.course_id === currentCourse.id;
    const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto select-none">
      
      {/* Cabecera del Módulo con Estado de Créditos */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-secondary/15 pb-4">
        <div>
          <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
            <FolderOpen className="w-6 h-6 text-primary" />
            Wiki-Banco de Archivos
          </h1>
          <p className="text-xs text-neutral-gray font-medium">
            Biblioteca académica cooperativa. Comparte exámenes, prácticas y apuntes para mantener la economía de créditos activa.
          </p>
        </div>

        {/* Indicador de Créditos en Tiempo Real */}
        <div className="bg-white border border-secondary/20 rounded-2xl py-2.5 px-4 shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-neutral-gray block uppercase tracking-wider">Tus Créditos</span>
            <span className="text-base font-black text-primary">{credits} cr</span>
          </div>
        </div>
      </div>

      {/* Alertas Didácticas */}
      {alertInfo && (
        <Alert
          title={alertInfo.title}
          description={alertInfo.description}
          variant={alertInfo.variant}
        />
      )}

      {/* 2. Navegación por Migas de Pan (Breadcrumbs) - UNSCH-402 */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-neutral-gray bg-white border border-secondary/10 px-4 py-2.5 rounded-xl shadow-sm">
        <span 
          onClick={() => {
            setCurrentFaculty(null);
            setCurrentSchool(null);
            setCurrentCourse(null);
            setAlertInfo(null);
          }}
          className="hover:text-primary cursor-pointer transition-colors"
        >
          Facultades
        </span>

        {currentFaculty && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-secondary/50" />
            <span 
              onClick={() => {
                setCurrentSchool(null);
                setCurrentCourse(null);
                setAlertInfo(null);
              }}
              className="hover:text-primary cursor-pointer transition-colors max-w-[180px] truncate"
            >
              {currentFaculty.name}
            </span>
          </>
        )}

        {currentSchool && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-secondary/50" />
            <span 
              onClick={() => {
                setCurrentCourse(null);
                setAlertInfo(null);
              }}
              className="hover:text-primary cursor-pointer transition-colors max-w-[150px] truncate"
            >
              {currentSchool.name}
            </span>
          </>
        )}

        {currentCourse && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-secondary/50" />
            <span className="text-primary max-w-[180px] truncate">
              {currentCourse.name}
            </span>
          </>
        )}
      </div>

      {/* Flujo de Selección de Niveles Jerárquicos */}
      {!currentFaculty && (
        <div className="flex flex-col gap-4">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Selecciona una Facultad</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FACULTIES.map((fac) => (
              <div 
                key={fac.id}
                onClick={() => setCurrentFaculty(fac)}
                className="bg-white border border-secondary/15 rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-surface border border-secondary/10 flex items-center justify-center text-primary font-black group-hover:bg-primary group-hover:text-surface transition-colors">
                  {fac.id}
                </div>
                <h3 className="text-sm font-extrabold text-primary group-hover:text-primary/90">
                  {fac.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentFaculty && !currentSchool && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentFaculty(null)}
              className="p-1 rounded-lg hover:bg-secondary/10 text-primary cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Selecciona una Escuela Profesional</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SCHOOLS.filter(s => s.faculty_id === currentFaculty.id).map((sch) => (
              <div 
                key={sch.id}
                onClick={() => setCurrentSchool(sch)}
                className="bg-white border border-secondary/15 rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between h-28 group"
              >
                <h3 className="text-sm font-extrabold text-primary group-hover:text-primary/90">
                  {sch.name}
                </h3>
                <span className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider block">
                  Ver Cursos ➔
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentSchool && !currentCourse && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentSchool(null)}
              className="p-1 rounded-lg hover:bg-secondary/10 text-primary cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Selecciona un Curso</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {COURSES.filter(c => c.school_id === currentSchool.id).map((crs) => {
              const fileCount = files.filter(f => f.course_id === crs.id).length;
              return (
                <div 
                  key={crs.id}
                  onClick={() => setCurrentCourse(crs)}
                  className="bg-white border border-secondary/15 rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                >
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/5 text-primary border border-primary/10 text-[9px] font-bold mb-2">
                      Ciclo {crs.cycle}
                    </span>
                    <h3 className="text-sm font-extrabold text-primary leading-snug group-hover:text-primary/90">
                      {crs.name}
                    </h3>
                  </div>
                  <div className="flex justify-between items-center border-t border-secondary/5 pt-2 text-[10px] font-bold text-neutral-gray">
                    <span>Archivos: {fileCount}</span>
                    <span className="group-hover:text-primary transition-colors">Ver repositorio ➔</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Repositorio de Documentos del Curso Seleccionado */}
      {currentCourse && (
        <div className="flex flex-col gap-5">
          {/* Header de Operaciones */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentCourse(null)}
                className="p-1.5 rounded-lg hover:bg-secondary/10 text-primary cursor-pointer"
                title="Volver a Cursos"
              >
                <ArrowLeft className="w-4.5 h-4.5" />
              </button>
              <h2 className="text-base font-black text-primary tracking-tight">
                Repositorio: {currentCourse.name}
              </h2>
            </div>

            {/* Barra de Filtros Internos y Botón Subir */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-neutral-gray absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en esta carpeta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-48 bg-white border border-secondary/15 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-primary placeholder:text-neutral-gray/60 focus:outline-none focus:border-primary/50 shadow-sm"
                />
              </div>

              <Button
                onClick={() => setIsUploadOpen(true)}
                className="py-2.5 px-4 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-primary/95 flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                Subir Archivo
              </Button>
            </div>
          </div>

          {/* Renderizado de Archivos / Empty State */}
          {courseFiles.length === 0 ? (
            /* 4.2 Empty State Layout del Repositorio */
            <RepositoryEmptyState onUploadClick={() => setIsUploadOpen(true)} />
          ) : (
            /* Visualizador en Formato Tabla Dense y High-Contrast (Sección 3.4) */
            <div className="bg-white border border-secondary/15 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface border-b border-secondary/10 font-black text-primary uppercase tracking-wide">
                      <th className="py-3 px-4 w-12">Tipo</th>
                      <th className="py-3 px-4">Nombre del Documento</th>
                      <th className="py-3 px-4 w-28 text-center">Reputación</th>
                      <th className="py-3 px-4 w-32">Aporte de</th>
                      <th className="py-3 px-4 w-44 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/5 font-semibold text-neutral-gray">
                    {courseFiles.map((file) => {
                      const isDownloaded = downloadedFiles.includes(file.id);
                      return (
                        <tr key={file.id} className="hover:bg-surface/40 transition-colors">
                          {/* Badge de tipo de archivo */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-[9px] ${
                              file.file_type === 'PDF' 
                                ? 'bg-red-50 text-red-600 border border-red-200' 
                                : 'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}>
                              {file.file_type}
                            </span>
                          </td>
                          
                          {/* Título del documento */}
                          <td className="py-3.5 px-4 font-bold text-primary max-w-xs truncate">
                            <div className="flex flex-col gap-0.5">
                              <span className="block truncate" title={file.title}>{file.title}</span>
                              <span className="text-[9px] text-neutral-gray font-medium">
                                Subido el {new Date(file.created_at).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                          </td>

                          {/* Votación y Reputación */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleVote(file.id)}
                              disabled={votedFiles.includes(file.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                                votedFiles.includes(file.id)
                                  ? 'bg-primary/5 text-primary border-primary/20 cursor-default'
                                  : 'bg-white hover:bg-primary/5 text-neutral-gray hover:text-primary border-secondary/15 cursor-pointer'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>+{file.votes_count}</span>
                            </button>
                          </td>

                          {/* Nombre del Autor */}
                          <td className="py-3.5 px-4 text-primary truncate max-w-[120px]" title={file.owner_name}>
                            {file.owner_name}
                          </td>

                          {/* Botón de Descarga Carmesí */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDownload(file)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all shadow-sm focus:outline-none cursor-pointer ${
                                isDownloaded
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-primary hover:bg-primary/95 text-surface'
                              }`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              {isDownloaded ? (
                                'Comprado'
                              ) : file.credit_cost === 0 ? (
                                'Gratis'
                              ) : (
                                `Descargar (-${file.credit_cost} Cr)`
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leyenda de Semestre para Redescargas gratuitas */}
          <div className="p-3.5 bg-surface border border-secondary/10 rounded-xl flex gap-3 text-left">
            <Info className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
            <p className="text-[10px] font-bold text-neutral-gray leading-relaxed">
              <strong>Regla de Redescarga Gratuita:</strong> Las descargas de archivos adquiridos previamente en el mismo semestre académico (2026-I: Marzo a Julio; 2026-II: Agosto a Enero) no consumen créditos. El ledger registrará delta 0 con la traza `redownload_free`.
            </p>
          </div>
        </div>
      )}

      {/* Modal / Overlay de Carga de Archivo (Upload Simulation) */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-secondary/15 rounded-3xl p-6 w-full max-w-md shadow-lg text-left flex flex-col gap-5 relative animate-in fade-in zoom-in duration-200">
            
            {/* Cabecera del modal */}
            <div className="flex justify-between items-center border-b border-secondary/10 pb-3">
              <h3 className="text-sm font-black text-primary flex items-center gap-2">
                <Upload className="w-4.5 h-4.5 text-primary" />
                Subir Aporte Académico
              </h3>
              <button 
                onClick={() => setIsUploadOpen(false)}
                className="text-neutral-gray hover:text-primary transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                  Título del Documento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Examen Final de Base de Datos - 2025-I"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-secondary/15 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-primary focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                    Tipo de Archivo
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'PDF' | 'DOCX')}
                    className="w-full bg-white border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary focus:outline-none focus:border-primary/50"
                  >
                    <option value="PDF">PDF</option>
                    <option value="DOCX">DOCX (Word)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                    Ciclo del Curso
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newCycle}
                    onChange={(e) => setNewCycle(parseInt(e.target.value))}
                    className="w-full bg-white border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-semibold text-primary focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                  Costo de Descarga (Créditos)
                </label>
                <select
                  value={newCost}
                  onChange={(e) => setNewCost(parseInt(e.target.value))}
                  className="w-full bg-white border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value={1}>1 Crédito (Normal)</option>
                  <option value={0}>0 Créditos (Público/Gratis)</option>
                </select>
              </div>

              {/* Banner Didáctico de Recompensa */}
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-[9px] font-bold text-primary leading-relaxed">
                  <strong>Recompensa UNSCH:</strong> Al publicar el archivo, recibirás automáticamente +2 créditos en tu balance al ser verificado. Fomentamos la cooperación académica.
                </span>
              </div>

              {/* Botón de Envío */}
              <Button
                type="submit"
                className="mt-2 py-3 bg-primary hover:bg-primary/95 text-surface font-extrabold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                Subir Documento (+2 Créditos)
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
