'use client';

import React, { useState } from 'react';
import { Search, X, Filter, Sparkles, BookOpen } from 'lucide-react';
import { FACULTIES, PROJECT_TYPES, SKILL_CATALOG, ALL_SKILL_TAGS } from '../../app/lib/unsch.constants';

interface MatchmakingFiltersProps {
  onFiltersChange: (filters: { faculty: string; projectType: string; skills: string[] }) => void;
}

export function MatchmakingFilters({ onFiltersChange }: MatchmakingFiltersProps) {
  const [faculty, setFaculty] = useState('');
  const [projectType, setProjectType] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAddSkill = (tag: string) => {
    const cleanedTag = tag.trim();
    if (cleanedTag && !skills.includes(cleanedTag)) {
      const updatedSkills = [...skills, cleanedTag];
      setSkills(updatedSkills);
      onFiltersChange({ faculty, projectType, skills: updatedSkills });
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (tag: string) => {
    const updatedSkills = skills.filter((s) => s !== tag);
    setSkills(updatedSkills);
    onFiltersChange({ faculty, projectType, skills: updatedSkills });
  };

  const handleSelectFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFaculty(value);
    onFiltersChange({ faculty: value, projectType, skills });
  };

  const handleSelectProjectTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setProjectType(value);
    onFiltersChange({ faculty, projectType: value, skills });
  };

  // Filtrar sugerencias del catálogo cerrado basadas en lo que escribe el usuario
  const filteredSuggestions = ALL_SKILL_TAGS.filter(
    (tag) =>
      tag.toLowerCase().includes(skillInput.toLowerCase()) &&
      !skills.includes(tag)
  );

  return (
    <div className="bg-white border border-secondary/15 rounded-2xl p-5 shadow-sm flex flex-col gap-4 select-none">
      
      {/* Cabecera del Panel */}
      <div className="flex items-center gap-2 border-b border-secondary/10 pb-3">
        <Filter className="w-4.5 h-4.5 text-primary" />
        <h3 className="text-sm font-extrabold text-primary">Filtros de Emparejamiento</h3>
      </div>

      {/* Grid de Selects y Búsqueda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Selector de Facultad */}
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[11px] font-bold text-neutral-gray uppercase tracking-wider">
            Facultad Académica
          </label>
          <select
            value={faculty}
            onChange={handleSelectFacultyChange}
            className="w-full text-xs font-bold text-primary bg-surface/50 border border-secondary/15 px-3.5 py-2.5 rounded-xl outline-none focus:border-primary cursor-pointer transition-colors"
          >
            <option value="">Todas las Facultades</option>
            {FACULTIES.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name} ({f.abbreviation})
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Tipo de Proyecto */}
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[11px] font-bold text-neutral-gray uppercase tracking-wider">
            Tipo de Proyecto
          </label>
          <select
            value={projectType}
            onChange={handleSelectProjectTypeChange}
            className="w-full text-xs font-bold text-primary bg-surface/50 border border-secondary/15 px-3.5 py-2.5 rounded-xl outline-none focus:border-primary cursor-pointer transition-colors"
          >
            <option value="">Todos los Proyectos</option>
            {PROJECT_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Input de Habilidades */}
        <div className="flex flex-col gap-1.5 text-left relative">
          <label className="text-[11px] font-bold text-neutral-gray uppercase tracking-wider">
            Buscar Habilidades (Catálogo Cerrado)
          </label>
          <div className="relative">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => {
                setSkillInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Ej. Python, Normas APA..."
              className="w-full text-xs font-medium text-primary bg-surface/50 border border-secondary/15 pl-3.5 pr-10 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
            />
            {skillInput ? (
              <button
                type="button"
                onClick={() => handleAddSkill(skillInput)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-gray hover:text-primary transition-colors cursor-pointer outline-none"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
            ) : (
              <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-gray/40 pointer-events-none" />
            )}
          </div>

          {/* Menú desplegable de sugerencias de autocompletado */}
          {showSuggestions && skillInput && filteredSuggestions.length > 0 && (
            <div className="absolute top-[100%] left-0 w-full bg-white border border-secondary/15 rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto z-50">
              {filteredSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    handleAddSkill(tag);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sugerencias rápidas del catálogo (agrupadas por categoría) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-secondary/5 text-left">
        <span className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          Sugerencias del catálogo cerrado (haz click para agregar)
        </span>
        <div className="flex flex-col gap-3 max-h-40 overflow-y-auto pr-1 animate-in fade-in duration-200">
          {SKILL_CATALOG.map((cat) => (
            <div key={cat.area} className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest">{cat.area}</span>
              <div className="flex flex-wrap gap-1.5">
                {cat.tags.map((tag) => {
                  const isSelected = skills.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={isSelected}
                      onClick={() => handleAddSkill(tag)}
                      className={`text-[9px] font-bold px-2 py-0.5 border rounded-lg transition-all ${
                        isSelected
                          ? 'bg-neutral-gray/10 text-neutral-gray/40 border-neutral-gray/5 cursor-not-allowed'
                          : 'bg-surface border-secondary/10 text-neutral-gray hover:text-primary hover:border-primary/50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags de habilidades seleccionadas */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-secondary/5 text-left">
          {skills.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary/10 text-secondary border border-secondary/25"
            >
              {tag}
              <button
                onClick={() => handleRemoveSkill(tag)}
                className="hover:text-primary transition-colors cursor-pointer focus:outline-none outline-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
