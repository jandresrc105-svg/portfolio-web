import type { ProfileApi } from '../api/ProfileApi';
import type { Profile } from '../models/Profile';

/**
 * Lógica de negocio del perfil: obtención de datos y cálculo de la experiencia.
 */
export class ProfileService {
  private static readonly MONTHS_PER_YEAR = 12;

  /**
   * Crea el service del perfil.
   *
   * @param api Acceso remoto al perfil.
   */
  public constructor(private readonly api: ProfileApi) {}

  /**
   * Obtiene el perfil profesional.
   *
   * @returns Perfil profesional.
   */
  public getProfile(): Promise<Profile> {
    return this.api.getProfile();
  }

  /**
   * Describe el tiempo de experiencia en texto legible, p. ej. "2 años y 3 meses".
   *
   * @param profile Perfil con la fecha de inicio.
   * @param today Fecha de referencia; por defecto la actual.
   * @returns Texto con la experiencia acumulada.
   */
  public experienceLabel(profile: Profile, today: Date = new Date()): string {
    const months = ProfileService.monthsBetween(new Date(profile.careerStartDate), today);
    const years = Math.floor(months / ProfileService.MONTHS_PER_YEAR);
    const remainder = months % ProfileService.MONTHS_PER_YEAR;
    return [ProfileService.unit(years, 'año', 'años'), ProfileService.unit(remainder, 'mes', 'meses')]
      .filter((part) => part.length > 0)
      .join(' y ');
  }

  /**
   * Meses completos transcurridos entre dos fechas (en UTC para evitar desfases de zona horaria).
   *
   * @param from Fecha inicial.
   * @param to Fecha final.
   * @returns Meses transcurridos.
   */
  private static monthsBetween(from: Date, to: Date): number {
    const years = to.getUTCFullYear() - from.getUTCFullYear();
    return years * ProfileService.MONTHS_PER_YEAR + to.getUTCMonth() - from.getUTCMonth();
  }

  /**
   * Formatea una cantidad con su unidad en singular o plural.
   *
   * @param value Cantidad.
   * @param singular Unidad en singular.
   * @param plural Unidad en plural.
   * @returns Texto formateado, o vacío si la cantidad es cero.
   */
  private static unit(value: number, singular: string, plural: string): string {
    if (value === 0) {
      return '';
    }
    return `${String(value)} ${value === 1 ? singular : plural}`;
  }
}
