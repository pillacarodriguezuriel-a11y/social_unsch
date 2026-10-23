import { pool } from '../../config/database';

export interface User {
  id: string; // UUID v4
  full_name: string;
  email: string;
  password_hash: string;
  role: 'student' | 'alumnus' | 'professor' | 'administrator';
  professional_school_id: number | null;
  faculty_id: number | null;
  current_academic_cycle: number | null;
  credits_balance: number;
  has_accepted_terms: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  full_name: string;
  email: string;
  password_hash: string;
  role: 'student' | 'alumnus' | 'professor' | 'administrator';
  professional_school_id?: number | null;
  current_academic_cycle?: number | null;
}

export class AuthRepository {
  /**
   * Busca un usuario por su correo institucional.
   * Utiliza prepared statements de pg para evitar inyección SQL.
   * @param email Correo electrónico a buscar
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = {
      name: 'fetch-user-by-email',
      text: `
        SELECT u.id, u.full_name, u.email, u.password_hash, u.role, u.professional_school_id, 
               ps.faculty_id, u.current_academic_cycle, u.credits_balance, u.has_accepted_terms, 
               u.created_at, u.updated_at 
        FROM users u
        LEFT JOIN professional_schools ps ON u.professional_school_id = ps.id
        WHERE u.email = $1
      `,
      values: [email],
    };

    const result = await pool.query<User>(query);
    return result.rows[0] || null;
  }

  /**
   * Busca un usuario por su identificador único (UUID).
   * Utiliza prepared statements de pg para evitar inyección SQL.
   * @param id Identificador único UUID del usuario
   */
  async findById(id: string): Promise<User | null> {
    const query = {
      name: 'fetch-user-by-id',
      text: `
        SELECT u.id, u.full_name, u.email, u.password_hash, u.role, u.professional_school_id, 
               ps.faculty_id, u.current_academic_cycle, u.credits_balance, u.has_accepted_terms, 
               u.created_at, u.updated_at 
        FROM users u
        LEFT JOIN professional_schools ps ON u.professional_school_id = ps.id
        WHERE u.id = $1
      `,
      values: [id],
    };

    const result = await pool.query<User>(query);
    return result.rows[0] || null;
  }

  /**
   * Registra un nuevo usuario en la base de datos, inicializando créditos y aceptación de términos.
   * Utiliza prepared statements de pg para evitar inyección SQL.
   * @param input Parámetros para la creación del usuario
   */
  async create(input: CreateUserInput): Promise<User> {
    const {
      full_name,
      email,
      password_hash,
      role,
      professional_school_id = null,
      current_academic_cycle = null,
    } = input;

    const query = {
      name: 'insert-new-user',
      text: `
        INSERT INTO users (
          full_name, 
          email, 
          password_hash, 
          role, 
          professional_school_id, 
          current_academic_cycle, 
          credits_balance, 
          has_accepted_terms, 
          created_at, 
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, full_name, email, password_hash, role, professional_school_id, current_academic_cycle, credits_balance, has_accepted_terms, created_at, updated_at
      `,
      values: [
        full_name,
        email.toLowerCase().trim(),
        password_hash,
        role,
        professional_school_id,
        current_academic_cycle,
        0, // credits_balance inicializado a 0
        false, // has_accepted_terms inicializado a false
      ],
    };

    const result = await pool.query<User>(query);
    return result.rows[0];
  }
}
