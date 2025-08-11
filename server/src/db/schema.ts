import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'doctor', 'cashier']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'insurance']);
export const movementTypeEnum = pgEnum('movement_type', ['in', 'out', 'adjustment']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name').notNull(),
  role: userRoleEnum('role').notNull(),
  phone: text('phone'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Patients table
export const patientsTable = pgTable('patients', {
  id: serial('id').primaryKey(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  date_of_birth: date('date_of_birth').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  gender: genderEnum('gender').notNull(),
  emergency_contact: text('emergency_contact'),
  medical_history: text('medical_history'),
  allergies: text('allergies'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Medicine categories table
export const medicineCategoriesTable = pgTable('medicine_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Medicines table
export const medicinesTable = pgTable('medicines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  brand: text('brand'),
  category_id: integer('category_id').references(() => medicineCategoriesTable.id).notNull(),
  generic_name: text('generic_name'),
  dosage: text('dosage').notNull(),
  unit: text('unit').notNull(),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull(),
  min_stock_level: integer('min_stock_level').notNull(),
  expiry_date: date('expiry_date').notNull(),
  batch_number: text('batch_number'),
  manufacturer: text('manufacturer'),
  description: text('description'),
  requires_prescription: boolean('requires_prescription').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Prescriptions table
export const prescriptionsTable = pgTable('prescriptions', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').references(() => patientsTable.id).notNull(),
  doctor_id: integer('doctor_id').references(() => usersTable.id).notNull(),
  prescription_date: timestamp('prescription_date').defaultNow().notNull(),
  diagnosis: text('diagnosis').notNull(),
  symptoms: text('symptoms'),
  notes: text('notes'),
  is_filled: boolean('is_filled').notNull().default(false),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Prescription items table
export const prescriptionItemsTable = pgTable('prescription_items', {
  id: serial('id').primaryKey(),
  prescription_id: integer('prescription_id').references(() => prescriptionsTable.id).notNull(),
  medicine_id: integer('medicine_id').references(() => medicinesTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  dosage_instructions: text('dosage_instructions').notNull(),
  duration_days: integer('duration_days').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Sales table
export const salesTable = pgTable('sales', {
  id: serial('id').primaryKey(),
  cashier_id: integer('cashier_id').references(() => usersTable.id).notNull(),
  patient_id: integer('patient_id').references(() => patientsTable.id),
  prescription_id: integer('prescription_id').references(() => prescriptionsTable.id),
  sale_date: timestamp('sale_date').defaultNow().notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  tax_amount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  final_amount: numeric('final_amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Sale items table
export const saleItemsTable = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  sale_id: integer('sale_id').references(() => salesTable.id).notNull(),
  medicine_id: integer('medicine_id').references(() => medicinesTable.id).notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Stock movements table
export const stockMovementsTable = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  medicine_id: integer('medicine_id').references(() => medicinesTable.id).notNull(),
  movement_type: movementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  reference_id: integer('reference_id'),
  reference_type: text('reference_type'),
  reason: text('reason'),
  performed_by: integer('performed_by').references(() => usersTable.id).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  prescriptions: many(prescriptionsTable),
  sales: many(salesTable),
  stockMovements: many(stockMovementsTable),
}));

export const patientsRelations = relations(patientsTable, ({ many }) => ({
  prescriptions: many(prescriptionsTable),
  sales: many(salesTable),
}));

export const medicineCategoriesRelations = relations(medicineCategoriesTable, ({ many }) => ({
  medicines: many(medicinesTable),
}));

export const medicinesRelations = relations(medicinesTable, ({ one, many }) => ({
  category: one(medicineCategoriesTable, {
    fields: [medicinesTable.category_id],
    references: [medicineCategoriesTable.id],
  }),
  prescriptionItems: many(prescriptionItemsTable),
  saleItems: many(saleItemsTable),
  stockMovements: many(stockMovementsTable),
}));

export const prescriptionsRelations = relations(prescriptionsTable, ({ one, many }) => ({
  patient: one(patientsTable, {
    fields: [prescriptionsTable.patient_id],
    references: [patientsTable.id],
  }),
  doctor: one(usersTable, {
    fields: [prescriptionsTable.doctor_id],
    references: [usersTable.id],
  }),
  items: many(prescriptionItemsTable),
  sales: many(salesTable),
}));

export const prescriptionItemsRelations = relations(prescriptionItemsTable, ({ one }) => ({
  prescription: one(prescriptionsTable, {
    fields: [prescriptionItemsTable.prescription_id],
    references: [prescriptionsTable.id],
  }),
  medicine: one(medicinesTable, {
    fields: [prescriptionItemsTable.medicine_id],
    references: [medicinesTable.id],
  }),
}));

export const salesRelations = relations(salesTable, ({ one, many }) => ({
  cashier: one(usersTable, {
    fields: [salesTable.cashier_id],
    references: [usersTable.id],
  }),
  patient: one(patientsTable, {
    fields: [salesTable.patient_id],
    references: [patientsTable.id],
  }),
  prescription: one(prescriptionsTable, {
    fields: [salesTable.prescription_id],
    references: [prescriptionsTable.id],
  }),
  items: many(saleItemsTable),
}));

export const saleItemsRelations = relations(saleItemsTable, ({ one }) => ({
  sale: one(salesTable, {
    fields: [saleItemsTable.sale_id],
    references: [salesTable.id],
  }),
  medicine: one(medicinesTable, {
    fields: [saleItemsTable.medicine_id],
    references: [medicinesTable.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovementsTable, ({ one }) => ({
  medicine: one(medicinesTable, {
    fields: [stockMovementsTable.medicine_id],
    references: [medicinesTable.id],
  }),
  performer: one(usersTable, {
    fields: [stockMovementsTable.performed_by],
    references: [usersTable.id],
  }),
}));

// Export all tables for enabling relation queries
export const tables = {
  users: usersTable,
  patients: patientsTable,
  medicineCategories: medicineCategoriesTable,
  medicines: medicinesTable,
  prescriptions: prescriptionsTable,
  prescriptionItems: prescriptionItemsTable,
  sales: salesTable,
  saleItems: saleItemsTable,
  stockMovements: stockMovementsTable,
};