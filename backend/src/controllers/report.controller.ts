import type { Request, Response } from 'express';
import { topCustomers } from '../repositories/report.repository';
import { normalizeDate } from '../utils/dates';

export async function getTopCustomers(req: Request, res: Response) {
  const asOf = normalizeDate(
    typeof req.query.as_of === 'string' ? req.query.as_of : new Date().toISOString().slice(0, 10),
  );
  res.json({ as_of: asOf, data: await topCustomers(asOf) });
}
