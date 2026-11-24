/**
 * Re-exporta los puertos del dominio Feed desde @social-unsch/feed-domain.
 * Mantener este archivo garantiza compatibilidad con importaciones existentes
 * en apps/api sin duplicar las definiciones.
 */
export type {
  IFeedPost,
  IAuthorMeta,
  IAuthorMetaReader,
  IFeedRepository,
} from '@social-unsch/feed-domain';
