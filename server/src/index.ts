import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  loginInputSchema, 
  createUserInputSchema,
  createPatientInputSchema,
  updatePatientInputSchema,
  searchPatientsInputSchema,
  createMedicineInputSchema,
  updateMedicineInputSchema,
  searchMedicinesInputSchema,
  createMedicineCategoryInputSchema,
  createPrescriptionInputSchema,
  updatePrescriptionInputSchema,
  createSaleInputSchema,
  createStockMovementInputSchema,
  reportInputSchema,
  paginationInputSchema
} from './schema';

// Import handlers
import { login, createUser, getCurrentUser, getAllUsers } from './handlers/auth';
import { 
  createPatient, 
  updatePatient, 
  getPatientById, 
  searchPatients, 
  deletePatient 
} from './handlers/patients';
import { 
  createMedicine, 
  updateMedicine, 
  getMedicineById, 
  searchMedicines, 
  getLowStockMedicines, 
  getExpiringMedicines, 
  deleteMedicine,
  createMedicineCategory,
  getMedicineCategories 
} from './handlers/medicines';
import { 
  createPrescription, 
  updatePrescription, 
  getPrescriptionById, 
  getPrescriptionsByPatientId, 
  getPrescriptionsByDoctorId, 
  getUnfilledPrescriptions, 
  markPrescriptionAsFilled 
} from './handlers/prescriptions';
import { 
  createSale, 
  getSaleById, 
  getSales, 
  getSalesByDateRange, 
  getSalesByCashier, 
  getTodaysSales, 
  processPrescriptionSale 
} from './handlers/sales';
import { 
  createStockMovement, 
  getStockMovements, 
  getStockMovementsByMedicine, 
  getStockMovementsByDateRange, 
  adjustStock, 
  addStock, 
  removeStock 
} from './handlers/stock';
import { 
  generateSalesReport, 
  generateMedicineUsageReport, 
  generateStockMovementReport, 
  getDashboardStats, 
  exportReport 
} from './handlers/reports';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    
    createUser: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    
    getCurrentUser: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .query(({ input }) => getCurrentUser(input)),
    
    getAllUsers: publicProcedure
      .query(() => getAllUsers()),
  }),

  // Patient management routes
  patients: router({
    create: publicProcedure
      .input(createPatientInputSchema)
      .mutation(({ input }) => createPatient(input)),
    
    update: publicProcedure
      .input(updatePatientInputSchema)
      .mutation(({ input }) => updatePatient(input)),
    
    getById: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .query(({ input }) => getPatientById(input)),
    
    search: publicProcedure
      .input(searchPatientsInputSchema)
      .query(({ input }) => searchPatients(input)),
    
    delete: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .mutation(({ input }) => deletePatient(input)),
  }),

  // Medicine management routes
  medicines: router({
    create: publicProcedure
      .input(createMedicineInputSchema)
      .mutation(({ input }) => createMedicine(input)),
    
    update: publicProcedure
      .input(updateMedicineInputSchema)
      .mutation(({ input }) => updateMedicine(input)),
    
    getById: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .query(({ input }) => getMedicineById(input)),
    
    search: publicProcedure
      .input(searchMedicinesInputSchema)
      .query(({ input }) => searchMedicines(input)),
    
    getLowStock: publicProcedure
      .query(() => getLowStockMedicines()),
    
    getExpiring: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page || 30))
      .query(({ input }) => getExpiringMedicines(input)),
    
    delete: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .mutation(({ input }) => deleteMedicine(input)),

    // Categories
    createCategory: publicProcedure
      .input(createMedicineCategoryInputSchema)
      .mutation(({ input }) => createMedicineCategory(input)),
    
    getCategories: publicProcedure
      .query(() => getMedicineCategories()),
  }),

  // Prescription management routes
  prescriptions: router({
    create: publicProcedure
      .input(createPrescriptionInputSchema)
      .mutation(({ input }) => createPrescription(input)),
    
    update: publicProcedure
      .input(updatePrescriptionInputSchema)
      .mutation(({ input }) => updatePrescription(input)),
    
    getById: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .query(({ input }) => getPrescriptionById(input)),
    
    getByPatientId: publicProcedure
      .input(paginationInputSchema.extend({ patientId: paginationInputSchema.shape.page }))
      .query(({ input }) => getPrescriptionsByPatientId(input.patientId, { page: input.page, limit: input.limit })),
    
    getByDoctorId: publicProcedure
      .input(paginationInputSchema.extend({ doctorId: paginationInputSchema.shape.page }))
      .query(({ input }) => getPrescriptionsByDoctorId(input.doctorId, { page: input.page, limit: input.limit })),
    
    getUnfilled: publicProcedure
      .input(paginationInputSchema)
      .query(({ input }) => getUnfilledPrescriptions(input)),
    
    markAsFilled: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .mutation(({ input }) => markPrescriptionAsFilled(input)),
  }),

  // Sales management routes
  sales: router({
    create: publicProcedure
      .input(createSaleInputSchema)
      .mutation(({ input }) => createSale(input)),
    
    getById: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).transform(data => data.page))
      .query(({ input }) => getSaleById(input)),
    
    getAll: publicProcedure
      .input(paginationInputSchema)
      .query(({ input }) => getSales(input)),
    
    getByDateRange: publicProcedure
      .input(paginationInputSchema.extend({ 
        startDate: reportInputSchema.shape.start_date, 
        endDate: reportInputSchema.shape.end_date 
      }))
      .query(({ input }) => getSalesByDateRange(input.startDate, input.endDate, { page: input.page, limit: input.limit })),
    
    getByCashier: publicProcedure
      .input(paginationInputSchema.extend({ cashierId: paginationInputSchema.shape.page }))
      .query(({ input }) => getSalesByCashier(input.cashierId, { page: input.page, limit: input.limit })),
    
    getTodaysSales: publicProcedure
      .query(() => getTodaysSales()),
    
    processPrescriptionSale: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).extend({
        prescriptionId: paginationInputSchema.shape.page,
        cashierId: paginationInputSchema.shape.page,
        paymentMethod: createSaleInputSchema.shape.payment_method,
        discount: createSaleInputSchema.shape.discount.optional()
      }))
      .mutation(({ input }) => processPrescriptionSale(input.prescriptionId, input.cashierId, input.paymentMethod, input.discount)),
  }),

  // Stock management routes
  stock: router({
    createMovement: publicProcedure
      .input(createStockMovementInputSchema)
      .mutation(({ input }) => createStockMovement(input)),
    
    getMovements: publicProcedure
      .input(paginationInputSchema)
      .query(({ input }) => getStockMovements(input)),
    
    getMovementsByMedicine: publicProcedure
      .input(paginationInputSchema.extend({ medicineId: paginationInputSchema.shape.page }))
      .query(({ input }) => getStockMovementsByMedicine(input.medicineId, { page: input.page, limit: input.limit })),
    
    getMovementsByDateRange: publicProcedure
      .input(paginationInputSchema.extend({ 
        startDate: reportInputSchema.shape.start_date, 
        endDate: reportInputSchema.shape.end_date 
      }))
      .query(({ input }) => getStockMovementsByDateRange(input.startDate, input.endDate, { page: input.page, limit: input.limit })),
    
    adjustStock: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).extend({
        medicineId: paginationInputSchema.shape.page,
        newQuantity: paginationInputSchema.shape.page,
        reason: createStockMovementInputSchema.shape.reason,
        performedBy: paginationInputSchema.shape.page
      }))
      .mutation(({ input }) => adjustStock(input.medicineId, input.newQuantity, input.reason || 'Manual adjustment', input.performedBy)),
    
    addStock: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).extend({
        medicineId: paginationInputSchema.shape.page,
        quantity: paginationInputSchema.shape.page,
        reason: createStockMovementInputSchema.shape.reason,
        performedBy: paginationInputSchema.shape.page,
        batchNumber: createStockMovementInputSchema.shape.reason.optional()
      }))
      .mutation(({ input }) => addStock(input.medicineId, input.quantity, input.reason || 'Stock addition', input.performedBy, input.batchNumber || undefined)),
    
    removeStock: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).extend({
        medicineId: paginationInputSchema.shape.page,
        quantity: paginationInputSchema.shape.page,
        reason: createStockMovementInputSchema.shape.reason,
        performedBy: paginationInputSchema.shape.page,
        referenceId: paginationInputSchema.shape.page.optional(),
        referenceType: createStockMovementInputSchema.shape.reference_type.optional()
      }))
      .mutation(({ input }) => removeStock(input.medicineId, input.quantity, input.reason || 'Manual removal', input.performedBy, input.referenceId, input.referenceType || undefined)),
  }),

  // Reporting routes
  reports: router({
    generateSalesReport: publicProcedure
      .input(reportInputSchema)
      .query(({ input }) => generateSalesReport(input)),
    
    generateMedicineUsageReport: publicProcedure
      .input(reportInputSchema)
      .query(({ input }) => generateMedicineUsageReport(input)),
    
    generateStockMovementReport: publicProcedure
      .input(reportInputSchema)
      .query(({ input }) => generateStockMovementReport(input)),
    
    getDashboardStats: publicProcedure
      .input(paginationInputSchema.pick({ page: true }).extend({
        userRole: createUserInputSchema.shape.role
      }))
      .query(({ input }) => getDashboardStats(input.page, input.userRole)),
    
    exportReport: publicProcedure
      .input(reportInputSchema.extend({
        format: paginationInputSchema.pick({ page: true }).transform(data => data.page === 1 ? 'csv' as const : 'pdf' as const)
      }))
      .mutation(({ input }) => exportReport(input.type, { start_date: input.start_date, end_date: input.end_date, type: input.type }, input.format)),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();