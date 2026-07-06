import { MatchmakingRepository, MatchmakingProfile } from './matchmaking.repository';
import { AppError } from '../../shared/errors/AppError';

export interface ScoreResponse {
  project_id: string;
  affinity_score: number;
  affinity_level: 'Alta' | 'Media' | 'Baja';
  matched_skills: string[];
  missing_skills: string[];
}

export class MatchmakingService {
  private matchmakingRepository = new MatchmakingRepository();

  /**
   * Calcula el puntaje de compatibilidad algorítmica (UNSCH-301)
   */
  async calculateScore(projectId: string, userSkills: string[]): Promise<ScoreResponse> {
    // 1. Obtener proyecto
    const project = await this.matchmakingRepository.findProjectById(projectId);
    if (!project || !project.is_open) {
      throw new AppError(
        'El proyecto de emparejamiento especificado no existe o ha sido cerrado.',
        404,
        'ERR_FEED_POST_NOT_FOUND' // Mapeo de código según exigencias del contrato
      );
    }

    // 2. Normalización de habilidades
    const normalizedUser = userSkills.map((s) => s.toLowerCase().trim());
    const normalizedNeeded = project.skills_needed.map((s) => s.toLowerCase().trim());
    const normalizedOffered = project.skills_offered.map((s) => s.toLowerCase().trim());

    // 3. Evaluar intersecciones de habilidades
    const matchesNeeded = normalizedUser.filter((s) => normalizedNeeded.includes(s));
    const matchesOffered = normalizedUser.filter((s) => normalizedOffered.includes(s));

    // 4. Calcular puntaje porcentual
    let score = 0;
    if (normalizedNeeded.length > 0) {
      score = (matchesNeeded.length / normalizedNeeded.length) * 100;
    } else {
      score = (matchesOffered.length / Math.max(normalizedOffered.length, 1)) * 100;
    }

    // Redondear puntaje a dos decimales
    const affinityScore = parseFloat(score.toFixed(2));

    // 5. Categorizar nivel de afinidad
    let affinityLevel: 'Alta' | 'Media' | 'Baja' = 'Baja';
    if (affinityScore >= 75.0) {
      affinityLevel = 'Alta';
    } else if (affinityScore >= 40.0) {
      affinityLevel = 'Media';
    }

    // Determinar habilidades coincidentes y faltantes preservando el formato original
    const matchedSkills = userSkills.filter((s) => {
      const norm = s.toLowerCase().trim();
      return normalizedNeeded.includes(norm) || normalizedOffered.includes(norm);
    });

    const targetSkillsSource = project.skills_needed.length > 0 ? project.skills_needed : project.skills_offered;
    const missingSkills = targetSkillsSource.filter(
      (s) => !normalizedUser.includes(s.toLowerCase().trim())
    );

    return {
      project_id: projectId,
      affinity_score: affinityScore,
      affinity_level: affinityLevel,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
    };
  }

  /**
   * Recupera perfiles descubribles anonimizados.
   */
  async getDiscoverableProfiles(userId: string): Promise<MatchmakingProfile[]> {
    return this.matchmakingRepository.getDiscoverableProfiles(userId);
  }

  /**
   * Envía interacción y procesa el handshake de la máquina de estados (UNSCH-303).
   */
  async submitInteraction(
    senderId: string,
    receiverProfileId: string,
    action: 'like' | 'dislike'
  ): Promise<{ status: string; chatChannelId: string | null; contactInfo?: MatchmakingProfile }> {
    try {
      const result = await this.matchmakingRepository.submitInteraction(
        senderId,
        receiverProfileId,
        action
      );

      // Si se acepta el Match, recuperar de manera transaccional los datos del canal de comunicación
      if (result.status === 'accepted') {
        const contactInfo = await this.matchmakingRepository.getMatchedContactInfo(
          senderId,
          receiverProfileId
        );
        return {
          status: result.status,
          chatChannelId: result.chatChannelId,
          contactInfo: contactInfo || undefined,
        };
      }

      return result;
    } catch (error: any) {
      if (error.message === 'EL_PERFIL_RECEPTOR_NO_EXISTE') {
        throw new AppError(
          'El perfil estudiantil seleccionado no existe.',
          404,
          'ERR_FEED_POST_NOT_FOUND'
        );
      }
      if (error.message === 'AUTOLIKE_NO_PERMITIDO') {
        throw new AppError(
          'No puedes enviarte una solicitud de conexión a ti mismo.',
          400,
          'ERR_MOD_SELF_REPORT' // Mapeo de autoconsulta prohibida
        );
      }
      throw error;
    }
  }
}
