import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

// Simple hash function for demonstration (in production, use proper bcrypt)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_key');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Simple password verification
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Simple JWT-like token generation (in production, use proper JWT library)
function generateToken(userId: number, username: string, role: string): string {
  const payload = {
    userId,
    username,
    role,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Hash the password
    const password_hash = await hashPassword(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        email: input.email,
        password_hash,
        role: input.role,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone || null
      })
      .returning()
      .execute();

    const user = result[0];
    return user;
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = generateToken(user.id, user.username, user.role);

    return { user, token };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}