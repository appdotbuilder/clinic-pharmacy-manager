import { db } from '../db';
import { 
  paymentsTable, 
  medicinesTable, 
  prescriptionItemsTable, 
  prescriptionsTable 
} from '../db/schema';
import { 
  type SalesReportInput, 
  type SalesReport, 
  type MedicineUsageReportInput, 
  type MedicineUsageReport,
  type LowStockAlert
} from '../schema';
import { and, between, eq, gte, lte, lt, sum, count, desc, sql, SQL } from 'drizzle-orm';

export async function generateSalesReport(input: SalesReportInput): Promise<SalesReport> {
  try {
    // Get total sales and transaction count for the date range
    const totalStats = await db.select({
      total_sales: sum(paymentsTable.amount),
      total_transactions: count(paymentsTable.id)
    })
    .from(paymentsTable)
    .where(between(paymentsTable.created_at, input.start_date, input.end_date))
    .execute();

    // Get daily breakdown
    const dailyBreakdown = await db.select({
      date: sql<string>`DATE(${paymentsTable.created_at})`,
      sales: sum(paymentsTable.amount),
      transactions: count(paymentsTable.id)
    })
    .from(paymentsTable)
    .where(between(paymentsTable.created_at, input.start_date, input.end_date))
    .groupBy(sql`DATE(${paymentsTable.created_at})`)
    .orderBy(sql`DATE(${paymentsTable.created_at})`)
    .execute();

    return {
      total_sales: parseFloat(totalStats[0]?.total_sales || '0'),
      total_transactions: totalStats[0]?.total_transactions || 0,
      daily_breakdown: dailyBreakdown.map(day => ({
        date: day.date,
        sales: parseFloat(day.sales || '0'),
        transactions: day.transactions || 0
      }))
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

export async function generateMedicineUsageReport(input: MedicineUsageReportInput): Promise<MedicineUsageReport[]> {
  try {
    // Build base query
    let baseQuery = db.select({
      medicine_id: medicinesTable.id,
      medicine_name: medicinesTable.name,
      current_stock: medicinesTable.current_stock,
      total_dispensed: sum(prescriptionItemsTable.quantity_dispensed)
    })
    .from(prescriptionItemsTable)
    .innerJoin(medicinesTable, eq(prescriptionItemsTable.medicine_id, medicinesTable.id))
    .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id));

    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    conditions.push(between(prescriptionsTable.created_at, input.start_date, input.end_date));

    if (input.medicine_id !== undefined) {
      conditions.push(eq(medicinesTable.id, input.medicine_id));
    }

    // Apply conditions and grouping
    const medicineStats = await baseQuery
      .where(and(...conditions))
      .groupBy(medicinesTable.id, medicinesTable.name, medicinesTable.current_stock)
      .execute();

    // Get usage breakdown for each medicine
    const results: MedicineUsageReport[] = [];

    for (const medicine of medicineStats) {
      // Get daily usage breakdown for this medicine
      const usageBreakdown = await db.select({
        date: sql<string>`DATE(${prescriptionsTable.created_at})`,
        quantity_dispensed: sum(prescriptionItemsTable.quantity_dispensed)
      })
      .from(prescriptionItemsTable)
      .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
      .where(
        and(
          eq(prescriptionItemsTable.medicine_id, medicine.medicine_id),
          between(prescriptionsTable.created_at, input.start_date, input.end_date)
        )
      )
      .groupBy(sql`DATE(${prescriptionsTable.created_at})`)
      .orderBy(sql`DATE(${prescriptionsTable.created_at})`)
      .execute();

      results.push({
        medicine_name: medicine.medicine_name,
        total_dispensed: Number(medicine.total_dispensed || 0),
        current_stock: medicine.current_stock,
        usage_breakdown: usageBreakdown.map(day => ({
          date: day.date,
          quantity_dispensed: Number(day.quantity_dispensed || 0)
        }))
      });
    }

    return results;
  } catch (error) {
    console.error('Medicine usage report generation failed:', error);
    throw error;
  }
}

export async function generateLowStockReport(): Promise<LowStockAlert[]> {
  try {
    const lowStockMedicines = await db.select({
      medicine_id: medicinesTable.id,
      medicine_name: medicinesTable.name,
      current_stock: medicinesTable.current_stock,
      minimum_stock_level: medicinesTable.minimum_stock_level
    })
    .from(medicinesTable)
    .where(lt(medicinesTable.current_stock, medicinesTable.minimum_stock_level))
    .orderBy(desc(sql`${medicinesTable.minimum_stock_level} - ${medicinesTable.current_stock}`))
    .execute();

    return lowStockMedicines.map(medicine => ({
      medicine_id: medicine.medicine_id,
      medicine_name: medicine.medicine_name,
      current_stock: medicine.current_stock,
      minimum_stock_level: medicine.minimum_stock_level,
      shortage: medicine.minimum_stock_level - medicine.current_stock
    }));
  } catch (error) {
    console.error('Low stock report generation failed:', error);
    throw error;
  }
}

export async function getDailySalesData(startDate: Date, endDate: Date): Promise<Array<{
  date: string;
  sales: number;
  transactions: number;
}>> {
  try {
    const dailySales = await db.select({
      date: sql<string>`DATE(${paymentsTable.created_at})`,
      sales: sum(paymentsTable.amount),
      transactions: count(paymentsTable.id)
    })
    .from(paymentsTable)
    .where(between(paymentsTable.created_at, startDate, endDate))
    .groupBy(sql`DATE(${paymentsTable.created_at})`)
    .orderBy(sql`DATE(${paymentsTable.created_at})`)
    .execute();

    return dailySales.map(day => ({
      date: day.date,
      sales: parseFloat(day.sales || '0'),
      transactions: day.transactions || 0
    }));
  } catch (error) {
    console.error('Daily sales data retrieval failed:', error);
    throw error;
  }
}

export async function getTopSellingMedicines(startDate: Date, endDate: Date, limit: number = 10): Promise<Array<{
  medicine_name: string;
  total_dispensed: number;
  revenue: number;
}>> {
  try {
    const topMedicines = await db.select({
      medicine_name: medicinesTable.name,
      total_dispensed: sum(prescriptionItemsTable.quantity_dispensed),
      revenue: sum(prescriptionItemsTable.total_price)
    })
    .from(prescriptionItemsTable)
    .innerJoin(medicinesTable, eq(prescriptionItemsTable.medicine_id, medicinesTable.id))
    .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
    .where(between(prescriptionsTable.created_at, startDate, endDate))
    .groupBy(medicinesTable.id, medicinesTable.name)
    .orderBy(desc(sum(prescriptionItemsTable.quantity_dispensed)))
    .limit(limit)
    .execute();

    return topMedicines.map(medicine => ({
      medicine_name: medicine.medicine_name,
      total_dispensed: Number(medicine.total_dispensed || 0),
      revenue: parseFloat(medicine.revenue || '0')
    }));
  } catch (error) {
    console.error('Top selling medicines retrieval failed:', error);
    throw error;
  }
}

export async function getInventoryValuation(): Promise<{
  total_medicines: number;
  total_stock_value: number;
  low_stock_items: number;
  expired_items: number;
}> {
  try {
    // Get total medicines count and stock value
    const inventoryStats = await db.select({
      total_medicines: count(medicinesTable.id),
      total_stock_value: sum(sql`${medicinesTable.current_stock} * ${medicinesTable.price}`)
    })
    .from(medicinesTable)
    .execute();

    // Get low stock items count
    const lowStockCount = await db.select({
      count: count(medicinesTable.id)
    })
    .from(medicinesTable)
    .where(lt(medicinesTable.current_stock, medicinesTable.minimum_stock_level))
    .execute();

    // Get expired items count (medicines with expiry_date in the past)
    const expiredCount = await db.select({
      count: count(medicinesTable.id)
    })
    .from(medicinesTable)
    .where(
      and(
        sql`${medicinesTable.expiry_date} IS NOT NULL`,
        sql`${medicinesTable.expiry_date} < CURRENT_DATE`
      )
    )
    .execute();

    return {
      total_medicines: inventoryStats[0]?.total_medicines || 0,
      total_stock_value: parseFloat(inventoryStats[0]?.total_stock_value || '0'),
      low_stock_items: lowStockCount[0]?.count || 0,
      expired_items: expiredCount[0]?.count || 0
    };
  } catch (error) {
    console.error('Inventory valuation calculation failed:', error);
    throw error;
  }
}