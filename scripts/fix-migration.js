// This script creates a baseline migration for the production database
// Run this to fix the migration issue

const { execSync } = require('child_process');

console.log('Fixing migration issue for production...\n');

try {
  // Step 1: Mark the failed migration as rolled back
  console.log('Step 1: Marking failed migration as rolled back...');
  try {
    execSync('npx prisma migrate resolve --rolled-back "20250923080228_init"', {
      stdio: 'inherit',
      env: { ...process.env }
    });
  } catch (e) {
    console.log('Migration might already be resolved or not exist, continuing...');
  }

  // Step 2: Create a new baseline migration
  console.log('\nStep 2: Creating baseline migration...');
  execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20250923120000_baseline/migration.sql', {
    stdio: 'inherit',
    env: { ...process.env }
  });

  // Step 3: Mark the baseline migration as applied
  console.log('\nStep 3: Marking baseline migration as applied...');
  execSync('npx prisma migrate resolve --applied "20250923120000_baseline"', {
    stdio: 'inherit',
    env: { ...process.env }
  });

  console.log('\n✅ Migration issue fixed successfully!');
} catch (error) {
  console.error('❌ Error fixing migration:', error.message);
  process.exit(1);
}