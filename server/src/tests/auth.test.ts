import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { createUser, loginUser, getUsers } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Helper function to verify password hash (matches implementation)
async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_key');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const passwordHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return passwordHash === hash;
}

// Helper function to decode token (matches implementation)
function decodeToken(token: string): any {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    return decoded;
  } catch {
    return null;
  }
}

// Test data
const testUserInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  role: 'doctor',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890'
};

const adminUserInput: CreateUserInput = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'admin123',
  role: 'admin',
  first_name: 'Admin',
  last_name: 'User'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with hashed password', async () => {
    const result = await createUser(testUserInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('doctor');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).not.toEqual('password123');
    expect(result.password_hash.length).toBeGreaterThan(20);
  });

  it('should create user with nullable phone field', async () => {
    const inputWithoutPhone = {
      ...testUserInput,
      phone: undefined
    };

    const result = await createUser(inputWithoutPhone);

    expect(result.username).toEqual('testuser');
    expect(result.phone).toBeNull();
  });

  it('should save user to database', async () => {
    const result = await createUser(testUserInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].role).toEqual('doctor');
    expect(users[0].is_active).toBe(true);
  });

  it('should hash password properly', async () => {
    const result = await createUser(testUserInput);

    // Verify password can be verified with our hash function
    const isValidPassword = await verifyPasswordHash('password123', result.password_hash);
    expect(isValidPassword).toBe(true);

    const isInvalidPassword = await verifyPasswordHash('wrongpassword', result.password_hash);
    expect(isInvalidPassword).toBe(false);
  });

  it('should handle duplicate username error', async () => {
    await createUser(testUserInput);

    // Try to create another user with same username
    const duplicateInput = {
      ...testUserInput,
      email: 'different@example.com'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow();
  });

  it('should handle duplicate email error', async () => {
    await createUser(testUserInput);

    // Try to create another user with same email
    const duplicateInput = {
      ...testUserInput,
      username: 'differentuser'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow();
  });
});

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should login user with valid credentials', async () => {
    // Create a user first
    await createUser(testUserInput);

    const loginInput: LoginInput = {
      username: 'testuser',
      password: 'password123'
    };

    const result = await loginUser(loginInput);

    // Verify user data
    expect(result.user.username).toEqual('testuser');
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.role).toEqual('doctor');
    expect(result.user.first_name).toEqual('John');
    expect(result.user.last_name).toEqual('Doe');
    expect(result.user.is_active).toBe(true);

    // Verify token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify token can be decoded
    const decoded = decodeToken(result.token);
    expect(decoded).toBeDefined();
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.username).toEqual('testuser');
    expect(decoded.role).toEqual('doctor');
    expect(decoded.exp).toBeDefined();
  });

  it('should reject invalid username', async () => {
    await createUser(testUserInput);

    const loginInput: LoginInput = {
      username: 'nonexistent',
      password: 'password123'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should reject invalid password', async () => {
    await createUser(testUserInput);

    const loginInput: LoginInput = {
      username: 'testuser',
      password: 'wrongpassword'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should reject inactive user', async () => {
    // Create user and then deactivate
    const user = await createUser(testUserInput);
    
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, user.id))
      .execute();

    const loginInput: LoginInput = {
      username: 'testuser',
      password: 'password123'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/account is inactive/i);
  });

  it('should generate valid token', async () => {
    await createUser(testUserInput);

    const loginInput: LoginInput = {
      username: 'testuser',
      password: 'password123'
    };

    const result = await loginUser(loginInput);

    // Decode and verify token structure
    const decoded = decodeToken(result.token);
    
    expect(decoded.userId).toBeDefined();
    expect(decoded.username).toEqual('testuser');
    expect(decoded.role).toEqual('doctor');
    expect(decoded.exp).toBeDefined(); // Expiration time
    
    // Verify expiration is in the future (24 hours)
    expect(decoded.exp).toBeGreaterThan(Date.now());
  });
});

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toEqual([]);
  });

  it('should return all users', async () => {
    // Create multiple users
    await createUser(testUserInput);
    await createUser(adminUserInput);

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const usernames = result.map(user => user.username);
    expect(usernames).toContain('testuser');
    expect(usernames).toContain('admin');

    // Verify user data structure
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.first_name).toBeDefined();
      expect(user.last_name).toBeDefined();
      expect(user.is_active).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should include both active and inactive users', async () => {
    // Create users and deactivate one
    await createUser(testUserInput);
    const adminUser = await createUser(adminUserInput);

    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, adminUser.id))
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const activeUsers = result.filter(user => user.is_active);
    const inactiveUsers = result.filter(user => !user.is_active);
    
    expect(activeUsers).toHaveLength(1);
    expect(inactiveUsers).toHaveLength(1);
  });

  it('should return users with all required fields', async () => {
    await createUser(testUserInput);

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];

    expect(user.username).toEqual('testuser');
    expect(user.email).toEqual('test@example.com');
    expect(user.role).toEqual('doctor');
    expect(user.first_name).toEqual('John');
    expect(user.last_name).toEqual('Doe');
    expect(user.phone).toEqual('+1234567890');
    expect(user.password_hash).toBeDefined();
    expect(typeof user.is_active).toBe('boolean');
  });
});