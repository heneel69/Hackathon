import { getDb, runSql } from './server/db.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Connecting to DB...');
  await getDb();

  console.log('Seeding settings...');
  runSql('INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['companyName', 'Acme Inventory Co.']);
  runSql('INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['currencySymbol', '$']);
  runSql('INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['dateFormat', 'YYYY-MM-DD']);
  runSql('INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['globalLowStock', '50']);

  console.log('Hashing passwords...');
  const hash1 = await bcrypt.hash('admin123', 12);
  const hash2 = await bcrypt.hash('manager123', 12);
  const hash3 = await bcrypt.hash('staff123', 12);

  console.log('Seeding users...');
  try {
    runSql(`INSERT INTO users (name, email, password_hash, role, is_validated) VALUES (?, ?, ?, ?, ?)`, 
      ['Super Admin', 'admin@example.com', hash1, 'Inventory Manager', 1]);
    console.log('Added Admin User in DB');
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint')) console.error(e);
  }

  try {
    runSql(`INSERT INTO users (name, email, password_hash, role, is_validated) VALUES (?, ?, ?, ?, ?)`, 
      ['Jane Manager', 'jane@example.com', hash2, 'Inventory Manager', 1]);
    console.log('Added Manager User in DB');
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint')) console.error(e);
  }

  try {
    runSql(`INSERT INTO users (name, email, password_hash, role, is_validated) VALUES (?, ?, ?, ?, ?)`, 
      ['John Staff', 'john@example.com', hash3, 'Warehouse Staff', 0]);
    console.log('Added Staff User in DB');
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint')) console.error(e);
  }

  console.log('Seeding complete. The database has been saved.');
}

seed().catch(console.error);
