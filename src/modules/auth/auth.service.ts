import bcrypt from 'bcrypt';
import { AuthRepository, CreateUserInput } from './auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { signAccessToken } from '../../config/jwt';

export class AuthService {
  private authRepository = new AuthRepository();

  /**
   * Procesa el registro de un nuevo usuario.
   * Verifica la unicidad del correo, hashea la contraseña de forma segura con 12 salt rounds
   * y guarda el perfil del usuario.
   */
  async register(input: CreateUserInput) {
    // Verificar si el correo ya existe en la base de datos
    const existingUser = await this.authRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError(
        'Este correo electrónico ya se encuentra registrado en el sistema.',
        400,
        'ERR_AUTH_EMAIL_EXISTS'
      );
    }

    // Hashear contraseña con bcrypt utilizando un factor de costo de 12 por seguridad (producción-grade)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(input.password_hash, saltRounds);

    // Crear el usuario con la contraseña hasheada
    const newUser = await this.authRepository.create({
      ...input,
      password_hash: passwordHash,
    });

    return {
      success: true,
      message: 'Usuario registrado exitosamente.',
      user_id: newUser.id,
    };
  }

  /**
   * Procesa la autenticación del usuario mediante correo institucional y contraseña.
   * Compara criptográficamente la contraseña y genera un token JWT de 24 horas de vigencia.
   */
  async login(email: string, passwordPlain: string) {
    // Buscar usuario por correo electrónico
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      // Usar error genérico para no revelar la existencia o inexistencia de cuentas por seguridad
      throw new AppError(
        'Las credenciales ingresadas son incorrectas.',
        401,
        'ERR_AUTH_INVALID_CREDENTIALS'
      );
    }

    // Comparar la contraseña ingresada con el hash guardado de forma segura y constante
    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(
        'Las credenciales ingresadas son incorrectas.',
        401,
        'ERR_AUTH_INVALID_CREDENTIALS'
      );
    }

    // El payload JWT debe contener exactamente los campos indicados
    const payload = {
      user_id: user.id,
      role: user.role,
      school_id: user.professional_school_id,
      has_accepted_terms: user.has_accepted_terms,
      facultad_id: user.faculty_id,
      escuela_id: user.professional_school_id,
      ciclo: user.current_academic_cycle,
    };

    // Firmar token JWT con vigencia estricta de 24 horas
    // Nota: Como se usa RS256, se requiere configurar las llaves pública y privada RSA correspondientes.
    const token = signAccessToken(payload as any, { expiresIn: '24h' });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400, // 24 horas en segundos
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        school_id: user.professional_school_id,
        current_academic_cycle: user.current_academic_cycle,
        credits_balance: user.credits_balance,
        has_accepted_terms: user.has_accepted_terms,
      },
    };
  }
}
