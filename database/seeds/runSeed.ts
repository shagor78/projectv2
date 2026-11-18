import 'dotenv/config';
import fs from 'node:fs';
import { count } from 'drizzle-orm';
import { closeDatabasePool, db } from '../index.ts';
import { excelImportLogs } from '../schema/index.ts';
import { DEFAULT_EXCEL_PATH } from '../../backend/src/config/env.ts';
import { importWorkspaceExcelFile } from '../../backend/src/services/excelImportService.ts';
import { ensureSeeded } from './seed.ts';

async function main() {
  console.log('[DB Seed] Running centralized PostgreSQL seed & CMS initialization...');
  await ensureSeeded();

  if (fs.existsSync(DEFAULT_EXCEL_PATH)) {
    const [{ value: importCount }] = await db.select({ value: count() }).from(excelImportLogs);
    if (importCount === 0) {
      console.log('[DB Seed] Importing initial workspace catalog from dataexcel.xlsx...');
      const report = await importWorkspaceExcelFile({ mode: 'seed', overwriteExisting: false });
      console.log(
        `[DB Seed] Excel import finished: inserted=${report.insertedCount}, updated=${report.updatedCount}, skipped=${report.skippedCount}, errors=${report.errorCount}`
      );
    } else {
      console.log('[DB Seed] Workspace Excel catalog already imported previously; skipping duplicate seed.');
    }
  }

  console.log('[DB Seed] Done.');
}

main()
  .catch((err) => {
    console.error('[DB Seed] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
