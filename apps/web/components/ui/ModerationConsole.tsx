'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Trash2, 
  RefreshCw, 
  FileDown, 
  UserMinus,
  Eye, 
  EyeOff, 
  CheckCircle,
  AlertTriangle,
  History,
  ShieldCheck
} from 'lucide-react';
import { Button } from './Button';
import { Alert } from './Alert';

interface ReportedPost {
  id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  content: string;
  censored_content: string;
  reason: 'harassment' | 'defamation' | 'prohibited_sale' | 'academic_fraud' | 'spam';
  reporter_name: string;
  reporter_email: string;
  reports_count: number;
  audit_history: string;
  created_at: string;
}

const INITIAL_REPORTED_POSTS: ReportedPost[] = [
  {
    id: 'rp1',
    author_id: 'u10',
    author_name: 'Mateo Rojas',
    author_email: 'mrojas@unsch.edu.pe',
    content: 'Vendo el examen final resuelto de Algoritmos y Estructura de Datos de este ciclo. Interesados al inbox, precio cómodo de 20 soles.',
    censored_content: 'Vendo el [EXAMEN RESUELTO] de Algoritmos y Estructura de Datos de este ciclo. Interesados al inbox, precio cómodo de [VENTA RESTRINGIDA].',
    reason: 'academic_fraud',
    reporter_name: 'Ana María Huamán',
    reporter_email: 'ahuaman@unsch.edu.pe',
    reports_count: 3,
    audit_history: 'El post fue ocultado automáticamente tras acumular 3 reportes concordantes en la última hora.',
    created_at: '2026-07-05T14:30:00Z'
  },
  {
    id: 'rp2',
    author_id: 'u11',
    author_name: 'Ramiro Quispe',
    author_email: 'rquispe@unsch.edu.pe',
    content: 'Ese profesor de civil es un corrupto y coimero, cobra por pasar y maltrata a los estudiantes del pabellón AA.',
    censored_content: 'Ese profesor de civil es un [DIFAMACIÓN] y [DIFAMACIÓN], cobra por pasar y maltrata a los estudiantes del pabellón AA.',
    reason: 'defamation',
    reporter_name: 'Juan Carlos Quispe',
    reporter_email: 'jquispe@unsch.edu.pe',
    reports_count: 4,
    audit_history: 'Usuario con historial limpio. Post reportado por la comunidad por vulnerar las normas de convivencia.',
    created_at: '2026-07-04T18:15:00Z'
  },
  {
    id: 'rp3',
    author_id: 'u12',
    author_name: 'Estela Prado',
    author_email: 'eprado@unsch.edu.pe',
    content: 'Gana créditos gratis y dinero entrando a este enlace de apuestas online: http://apuestas-faciles.xyz/unsch',
    censored_content: 'Gana créditos gratis y dinero entrando a este enlace de [SPAM / ENLACE PROHIBIDO]: http://[RESTRINGIDO]/unsch',
    reason: 'spam',
    reporter_name: 'Carlos Mendoza',
    reporter_email: 'cmendoza@unsch.edu.pe',
    reports_count: 3,
    audit_history: 'El autor tiene una advertencia previa por spam de enlaces en el radar estudiantil.',
    created_at: '2026-07-05T09:00:00Z'
  }
];

export function ModerationConsole() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // tracks active operation item id
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [revealedPosts, setRevealedPosts] = useState<string[]>([]);
  const [alertInfo, setAlertInfo] = useState<{ title: string; description: string; variant: 'info' | 'warning' | 'error' } | null>(null);

  // Authenticate role 'administrator' from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setIsAdmin(user.role === 'administrator');
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      const storedReports = localStorage.getItem('moderation_reports_list');
      if (storedReports) {
        setReports(JSON.parse(storedReports));
      } else {
        setReports(INITIAL_REPORTED_POSTS);
        localStorage.setItem('moderation_reports_list', JSON.stringify(INITIAL_REPORTED_POSTS));
      }
    }
  }, []);

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      harassment: 'Acoso',
      defamation: 'Difamación / Insultos',
      prohibited_sale: 'Venta Prohibida',
      academic_fraud: 'Fraude Académico',
      spam: 'Spam / Publicidad'
    };
    return labels[reason] || reason;
  };

  const toggleReveal = (postId: string) => {
    setRevealedPosts(prev => 
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  // Restore post (removes reports, is_visible = true on backend)
  const handleRestore = async (postId: string) => {
    setLoading(postId);
    setAlertInfo(null);
    
    // Simulate async network request
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updated = reports.filter(r => r.id !== postId);
    setReports(updated);
    localStorage.setItem('moderation_reports_list', JSON.stringify(updated));
    setLoading(null);
    
    setAlertInfo({
      title: 'Publicación Restaurada',
      description: 'El post ha sido verificado, se restauró su visibilidad y se removieron las denuncias asociadas.',
      variant: 'info'
    });
  };

  // Permanently ban user
  const handleBan = async (report: ReportedPost) => {
    setLoading(report.id);
    setAlertInfo(null);
    
    // Simulate async network request
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const updated = reports.filter(r => r.author_id !== report.author_id);
    setReports(updated);
    localStorage.setItem('moderation_reports_list', JSON.stringify(updated));
    setLoading(null);

    setAlertInfo({
      title: 'Baneo Permanente Aplicado',
      description: `El usuario ${report.author_name} (${report.author_email}) ha sido bloqueado de forma definitiva. Se purgó su contenido.`,
      variant: 'error'
    });
  };

  // Download PDF Evidence
  const handleDownloadEvidence = (report: ReportedPost) => {
    const evidenceData = {
      title: 'EVIDENCIA DE AUDITORÍA DE MODERACIÓN - SOCIAL-UNSCH',
      timestamp: new Date().toISOString(),
      post_id: report.id,
      infraction_type: report.reason,
      infraction_label: getReasonLabel(report.reason),
      author: {
        id: report.author_id,
        name: report.author_name,
        email: report.author_email
      },
      reporter: {
        name: report.reporter_name,
        email: report.reporter_email
      },
      evidence_content: report.content,
      total_reports: report.reports_count,
      audit_history: report.audit_history,
      legal_disclaimer: 'Documento confidencial generado automáticamente por el panel de administración central de SOCIAL-UNSCH para derivación al Tribunal de Honor.'
    };

    const blob = new Blob([JSON.stringify(evidenceData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evidencia_reporte_${report.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setAlertInfo({
      title: 'Evidencia Generada',
      description: 'Se ha descargado la traza técnica de auditoría para derivación formal al Tribunal de Honor.',
      variant: 'info'
    });
  };

  // 403 Access Denied view if not administrator
  if (isAdmin === false) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 select-none text-left">
        <div className="bg-white border border-primary/20 rounded-2xl p-8 max-w-md w-full shadow-sm flex flex-col gap-5">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-black text-primary tracking-tight">403 - Acceso Denegado</h2>
            <p className="text-xs text-neutral-gray font-semibold leading-relaxed">
              No cuentas con los privilegios de seguridad necesarios para acceder a la consola de moderación central. Este módulo requiere credenciales de administrador verificado.
            </p>
          </div>
          <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl">
            <span className="text-[10px] font-bold text-primary block leading-relaxed">
              <strong>Aviso de Seguridad:</strong> Todo intento de escalamiento de privilegios o alteración del contexto de seguridad JWT es registrado en la bitácora central de auditoría del campus.
            </span>
          </div>
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-primary text-surface font-extrabold text-xs py-3 rounded-xl hover:bg-primary/95"
          >
            Volver a la Página Principal
          </Button>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto select-none">
      
      {/* Cabecera del Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-secondary/15 pb-4">
        <div>
          <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Consola de Moderación Central
          </h1>
          <p className="text-xs text-neutral-gray font-medium">
            Cola de reportes acumulados por la comunidad. Gestiona denuncias e impone sanciones disciplinarias.
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-full py-1.5 px-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Sesión de Administrador Activa
        </div>
      </div>

      {/* Alertas didácticas del sistema */}
      {alertInfo && (
        <Alert
          title={alertInfo.title}
          description={alertInfo.description}
          variant={alertInfo.variant}
        />
      )}

      {/* Cola de Reportes */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider block">
          Cola de Denuncias Pendientes ({reports.length})
        </h3>

        {reports.length === 0 ? (
          <div className="bg-white border border-secondary/15 rounded-2xl p-16 text-center shadow-sm">
            <CheckCircle className="w-12 h-12 text-emerald-500/80 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-primary mb-1">¡Sin reportes pendientes!</h4>
            <p className="text-xs text-neutral-gray font-medium max-w-xs mx-auto">
              La cola de moderación está limpia. Todo el contenido público se encuentra operando bajo conformidad.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reports.map((report) => {
              const isRevealed = revealedPosts.includes(report.id);
              const isItemLoading = loading === report.id;

              return (
                <div 
                  key={report.id}
                  className={`bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col gap-4 relative overflow-hidden ${
                    isItemLoading ? 'opacity-60 border-secondary/15 pointer-events-none' : 'border-secondary/15 hover:border-secondary/30'
                  }`}
                >
                  {/* Spinner superpuesto durante carga */}
                  {isItemLoading && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Fila 1: Metadatos de la denuncia */}
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b border-secondary/5 pb-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/5 text-primary border border-primary/10 text-[9px] font-black uppercase tracking-wide">
                          Motivo: {getReasonLabel(report.reason)}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary/10 text-primary border border-secondary/20 text-[9px] font-black uppercase tracking-wide">
                          Denuncias: {report.reports_count}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-gray mt-1">
                        Reportado por: <strong>{report.reporter_name}</strong> ({report.reporter_email})
                      </span>
                    </div>
                    
                    <span className="text-[9px] font-bold text-neutral-gray">
                      {new Date(report.created_at).toLocaleString('es-ES')}
                    </span>
                  </div>

                  {/* Fila 2: Visualizador de Contenido Censurado */}
                  <div className="bg-surface/65 border border-secondary/10 rounded-xl p-4 text-left flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-secondary uppercase tracking-wider block">
                        Contenido Denunciado
                      </span>
                      <button
                        onClick={() => toggleReveal(report.id)}
                        className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer focus:outline-none"
                      >
                        {isRevealed ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            Ocultar original
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Revelar original
                          </>
                        )}
                      </button>
                    </div>

                    <p className={`text-xs leading-relaxed font-semibold italic mt-1 ${isRevealed ? 'text-primary' : 'text-neutral-gray'}`}>
                      "{isRevealed ? report.content : report.censored_content}"
                    </p>
                  </div>

                  {/* Fila 3: Autor del Post & Historial de Auditoría */}
                  <div className="flex flex-col gap-2 p-3 bg-surface/30 border border-secondary/5 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-secondary shrink-0" />
                      <span className="font-semibold text-primary">
                        Autor: <strong>{report.author_name}</strong> ({report.author_email})
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-gray font-medium leading-relaxed pl-6">
                      <strong>Trazabilidad:</strong> {report.audit_history}
                    </p>
                  </div>

                  {/* Acciones del Administrador */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary/5 pt-3">
                    {/* Botón Descarga Evidencias */}
                    <button
                      onClick={() => handleDownloadEvidence(report)}
                      className="text-[10px] font-bold text-tertiary hover:text-tertiary/90 flex items-center gap-1.5 cursor-pointer focus:outline-none"
                      title="Descargar bitácora técnica de evidencia para Tribunal de Honor"
                    >
                      <FileDown className="w-4 h-4 text-tertiary" />
                      Exportar Evidencia (.json)
                    </button>

                    {/* Botones de acción directos */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="secondary"
                        onClick={() => handleRestore(report.id)}
                        className="py-2 px-3 text-[10px] font-black uppercase rounded-lg tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Restaurar Publicación
                      </Button>

                      <Button
                        variant="primary"
                        onClick={() => handleBan(report)}
                        className="py-2 px-3 text-[10px] font-black uppercase rounded-lg tracking-wider bg-primary hover:bg-primary/95 text-surface flex items-center gap-1 cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        🚨 Baneo Permanente
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alerta de derivación legal */}
      <div className="p-4 bg-tertiary/5 border border-tertiary/15 rounded-2xl flex gap-3 text-left">
        <AlertTriangle className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-xs text-tertiary font-bold leading-relaxed">
            <strong>Derivación Formal al Tribunal de Honor UNSCH:</strong>
          </p>
          <p className="text-[10px] text-tertiary/90 leading-relaxed font-semibold">
            Las infracciones calificadas como "Muy Graves" (difamación sistemática, fraude académico grave, acoso) deben ser exportadas utilizando la opción "Exportar Evidencia". El archivo descargado contiene la firma digital de auditoría y debe ser remitido al Tribunal de Honor para las sanciones correspondientes bajo el reglamento estudiantil.
          </p>
        </div>
      </div>
    </div>
  );
}
