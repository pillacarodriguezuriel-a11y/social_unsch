/**
 * Clase base para errores personalizados de la aplicación.
 * Permite capturar errores de negocio y validación de forma uniforme.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
