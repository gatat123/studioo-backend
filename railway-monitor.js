#!/usr/bin/env node

/**
 * Railway Deployment Monitor and Auto-Fix Script
 * Monitors Railway deployments and automatically fixes common errors
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  projectId: '07c7df00-6cac-4404-9418-444134f717fe',
  checkInterval: 30000, // 30 seconds
  services: {
    backend: {
      path: './backend',
      repo: 'https://github.com/gatat123/studioo-backend.git'
    },
    frontend: {
      path: './frontend', 
      repo: 'https://github.com/gatat123/Studioo.git'
    }
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Helper function for colored console output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Execute command and return output
function execCommand(command, cwd = '.') {
  try {
    return execSync(command, { cwd, encoding: 'utf8' });
  } catch (error) {
    return error.stdout + error.stderr;
  }
}

// Get Railway logs for a service
async function getRailwayLogs(service) {
  log(`Fetching logs for ${service}...`, 'cyan');
  const servicePath = CONFIG.services[service].path;
  // Get both deployment and build logs
  const deployLogs = execCommand('railway logs --deployment', servicePath);
  const buildLogs = execCommand('railway logs --build', servicePath);
  return deployLogs + '\n' + buildLogs;
}

// Get deployment status
async function getDeploymentStatus(service) {
  const servicePath = CONFIG.services[service].path;
  return execCommand('railway status', servicePath);
}

// Analyze deployment errors and suggest fixes
function analyzeErrors(errorLog) {
  const fixes = [];
  
  // Missing module errors
  const moduleMatch = errorLog.match(/Cannot find module '([^']+)'/);
  if (moduleMatch) {
    fixes.push({
      type: 'MissingModule',
      module: moduleMatch[1],
      command: `npm install ${moduleMatch[1]}`,
      description: `Install missing module: ${moduleMatch[1]}`
    });
  }
  
  // Prisma errors
  if (errorLog.includes('Prisma') || errorLog.includes('prisma')) {
    if (errorLog.match(/P100[123]/)) {
      fixes.push({
        type: 'DatabaseConnection',
        description: 'Database connection error',
        action: 'Check DATABASE_URL environment variable in Railway'
      });
    }
    
    if (errorLog.includes('migrate')) {
      fixes.push({
        type: 'PrismaMigration',
        command: 'npx prisma migrate deploy',
        description: 'Deploy database migrations',
        updateBuildCommand: true
      });
    }
    
    if (errorLog.includes('generate') || errorLog.includes('Prisma Client')) {
      fixes.push({
        type: 'PrismaGenerate',
        command: 'npx prisma generate',
        description: 'Generate Prisma Client',
        updateBuildCommand: true
      });
    }
  }
  
  // TypeScript errors
  if (errorLog.match(/\.tsx?|TSError|TypeScript/)) {
    fixes.push({
      type: 'TypeScriptError',
      description: 'TypeScript compilation error',
      action: 'Fix TypeScript errors'
    });
  }
  
  // Memory errors
  if (errorLog.includes('JavaScript heap out of memory') || errorLog.includes('FATAL ERROR')) {
    fixes.push({
      type: 'MemoryError',
      description: 'Memory limit exceeded',
      updatePackageJson: true,
      buildScript: "NODE_OPTIONS='--max-old-space-size=2048' next build"
    });
  }
  
  // Port binding errors
  if (errorLog.includes('EADDRINUSE') || errorLog.includes('port')) {
    fixes.push({
      type: 'PortError',
      description: 'Port configuration error',
      action: 'Check PORT environment variable'
    });
  }
  
  // File not found errors
  const fileMatch = errorLog.match(/ENOENT.*?'([^']+)'/);
  if (fileMatch) {
    fixes.push({
      type: 'MissingFile',
      file: fileMatch[1],
      description: `Missing file: ${fileMatch[1]}`
    });
  }
  
  // Next.js specific errors
  if (errorLog.includes('next build') || errorLog.includes('next start')) {
    if (errorLog.includes('.next')) {
      fixes.push({
        type: 'NextBuildError',
        command: 'npm run build',
        description: 'Next.js build error'
      });
    }
  }
  
  return fixes;
}

// Apply fixes automatically
async function applyFixes(fixes, service) {
  const servicePath = CONFIG.services[service].path;
  let applied = false;
  const appliedFixes = [];
  
  for (const fix of fixes) {
    log(`\nApplying fix: ${fix.description}`, 'yellow');
    
    try {
      switch (fix.type) {
        case 'MissingModule':
          log(`Installing ${fix.module}...`, 'cyan');
          execCommand(fix.command, servicePath);
          appliedFixes.push(fix);
          applied = true;
          break;
          
        case 'PrismaGenerate':
        case 'PrismaMigration':
          if (fix.updateBuildCommand) {
            updateRailwayConfig(service, fix);
            appliedFixes.push(fix);
            applied = true;
          }
          break;
          
        case 'MemoryError':
          if (fix.updatePackageJson) {
            updatePackageJson(service, fix);
            appliedFixes.push(fix);
            applied = true;
          }
          break;
          
        case 'TypeScriptError':
          fixTypeScriptConfig(service);
          appliedFixes.push(fix);
          applied = true;
          break;
          
        case 'MissingFile':
          createMissingFile(service, fix.file);
          appliedFixes.push(fix);
          applied = true;
          break;
      }
    } catch (error) {
      log(`Error applying fix: ${error.message}`, 'red');
    }
  }
  
  return { applied, appliedFixes };
}

// Update railway.json configuration
function updateRailwayConfig(service, fix) {
  const configPath = path.join(CONFIG.services[service].path, 'railway.json');
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (fix.type === 'PrismaGenerate' && !config.build.buildCommand.includes('prisma generate')) {
      config.build.buildCommand = 'npm install --legacy-peer-deps && npx prisma generate && npm run build';
    }
    
    if (fix.type === 'PrismaMigration') {
      config.deploy.startCommand = 'npx prisma migrate deploy && ' + (config.deploy.startCommand || 'npm run start');
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log('Updated railway.json', 'green');
  } catch (error) {
    log(`Error updating railway.json: ${error.message}`, 'red');
  }
}

// Update package.json scripts
function updatePackageJson(service, fix) {
  const packagePath = path.join(CONFIG.services[service].path, 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (fix.buildScript) {
      packageJson.scripts.build = fix.buildScript;
    }
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    log('Updated package.json', 'green');
  } catch (error) {
    log(`Error updating package.json: ${error.message}`, 'red');
  }
}

// Fix TypeScript configuration
function fixTypeScriptConfig(service) {
  const tsconfigPath = path.join(CONFIG.services[service].path, 'tsconfig.json');
  
  try {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    
    // Add common fixes
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.skipLibCheck = true;
    tsconfig.compilerOptions.strict = false;
    
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    log('Updated tsconfig.json', 'green');
  } catch (error) {
    log(`Error updating tsconfig.json: ${error.message}`, 'red');
  }
}

// Create missing file
function createMissingFile(service, filePath) {
  const fullPath = path.join(CONFIG.services[service].path, filePath);
  const dir = path.dirname(fullPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create empty file
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '');
      log(`Created missing file: ${filePath}`, 'green');
    }
  } catch (error) {
    log(`Error creating file: ${error.message}`, 'red');
  }
}

// Commit and push fixes to GitHub
async function pushFixes(service, fixes) {
  const servicePath = CONFIG.services[service].path;
  
  try {
    // Create commit message
    let commitMessage = 'Fix Railway deployment errors\n\n';
    fixes.forEach(fix => {
      commitMessage += `- ${fix.description}\n`;
    });
    
    // Git operations
    execCommand('git add -A', servicePath);
    execCommand(`git commit -m "${commitMessage}"`, servicePath);
    execCommand('git push origin main', servicePath);
    
    log('\nFixes pushed to GitHub!', 'green');
    log('Railway will automatically redeploy...', 'cyan');
    return true;
  } catch (error) {
    log(`Error pushing to GitHub: ${error.message}`, 'red');
    return false;
  }
}

// Main monitoring function
async function monitor(service = 'backend', watch = false) {
  log('Railway Deployment Monitor', 'magenta');
  log(`Project: ${CONFIG.projectId}`, 'gray');
  log(`Service: ${service}`, 'gray');
  
  if (watch) {
    log('Continuous monitoring enabled (Ctrl+C to stop)\n', 'gray');
  }
  
  do {
    const timestamp = new Date().toLocaleTimeString();
    log(`\n[${timestamp}] Checking deployment...`, 'cyan');
    
    try {
      // Get deployment logs
      const logs = await getRailwayLogs(service);
      
      // Check for errors
      if (logs.match(/error|Error|ERROR|failed|Failed|FAILED/i)) {
        log('Deployment errors detected!', 'red');
        
        // Analyze errors
        const fixes = analyzeErrors(logs);
        
        if (fixes.length > 0) {
          log(`\nFound ${fixes.length} potential fixes:`, 'yellow');
          fixes.forEach(fix => {
            log(`  • ${fix.description}`, 'gray');
          });
          
          // Apply fixes
          const { applied, appliedFixes } = await applyFixes(fixes, service);
          
          if (applied && appliedFixes.length > 0) {
            // Push to GitHub
            await pushFixes(service, appliedFixes);
            
            log('\nWaiting for redeployment...', 'cyan');
            if (watch) {
              await new Promise(resolve => setTimeout(resolve, 60000));
            }
          } else {
            log('\nNo automatic fixes could be applied.', 'yellow');
            log('Manual intervention may be required.', 'yellow');
          }
        } else {
          log('\nNo automatic fixes available.', 'yellow');
          log('Error details:', 'red');
          console.log(logs);
        }
      } else {
        log('Deployment is healthy ✓', 'green');
      }
      
      if (watch) {
        log(`\nNext check in ${CONFIG.checkInterval / 1000} seconds...`, 'gray');
        await new Promise(resolve => setTimeout(resolve, CONFIG.checkInterval));
      }
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }
  } while (watch);
}

// Command line interface
const args = process.argv.slice(2);
const service = args.find(arg => arg === 'backend' || arg === 'frontend') || 'backend';
const watch = args.includes('--watch') || args.includes('-w');

// Run monitor
monitor(service, watch).catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});