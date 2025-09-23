# Railway Deployment Monitor and Auto-Fix Script
# This script monitors Railway deployments and automatically fixes common errors

param(
    [string]$ProjectId = "07c7df00-6cac-4404-9418-444134f717fe",
    [string]$ServiceName = "backend",
    [switch]$Watch
)

# Function to get deployment logs
function Get-RailwayLogs {
    param([string]$Service)
    
    Write-Host "Fetching logs for $Service..." -ForegroundColor Cyan
    
    if ($Service -eq "backend") {
        Set-Location -Path ".\backend"
    } else {
        Set-Location -Path ".\frontend"
    }
    
    $logs = railway logs --tail 100 2>&1
    Set-Location -Path ".."
    return $logs
}

# Function to get deployment status
function Get-DeploymentStatus {
    param([string]$Service)
    
    if ($Service -eq "backend") {
        Set-Location -Path ".\backend"
    } else {
        Set-Location -Path ".\frontend"
    }
    
    $status = railway status 2>&1
    Set-Location -Path ".."
    return $status
}

# Function to analyze errors and provide fixes
function Analyze-DeploymentError {
    param([string]$ErrorLog)
    
    $fixes = @()
    
    # Check for common errors
    if ($ErrorLog -match "Cannot find module") {
        $missingModule = [regex]::Match($ErrorLog, "Cannot find module '([^']+)'").Groups[1].Value
        $fixes += @{
            Type = "MissingModule"
            Module = $missingModule
            Fix = "npm install $missingModule"
            File = "package.json"
        }
    }
    
    if ($ErrorLog -match "Prisma|prisma") {
        if ($ErrorLog -match "P1001|P1002|P1003") {
            $fixes += @{
                Type = "DatabaseConnection"
                Fix = "Check DATABASE_URL environment variable"
                Action = "env-var"
            }
        }
        if ($ErrorLog -match "migrate") {
            $fixes += @{
                Type = "PrismaMigration"
                Fix = "npx prisma migrate deploy"
                Action = "command"
            }
        }
        if ($ErrorLog -match "generate") {
            $fixes += @{
                Type = "PrismaGenerate"
                Fix = "npx prisma generate"
                Action = "build-command"
            }
        }
    }
    
    if ($ErrorLog -match "ENOENT|no such file") {
        $missingFile = [regex]::Match($ErrorLog, "ENOENT[^']*'([^']+)'").Groups[1].Value
        $fixes += @{
            Type = "MissingFile"
            File = $missingFile
            Fix = "Create or check file: $missingFile"
        }
    }
    
    if ($ErrorLog -match "port|PORT") {
        $fixes += @{
            Type = "PortConfiguration"
            Fix = "Check PORT environment variable"
            Action = "env-var"
        }
    }
    
    if ($ErrorLog -match "TypeScript|\.ts|TSError") {
        $fixes += @{
            Type = "TypeScriptError"
            Fix = "Check TypeScript compilation"
            Action = "build"
        }
    }
    
    if ($ErrorLog -match "memory|heap|FATAL ERROR") {
        $fixes += @{
            Type = "MemoryError"
            Fix = "Increase memory limit or optimize build"
            Action = "build-optimization"
        }
    }
    
    return $fixes
}

# Function to apply fixes
function Apply-Fixes {
    param(
        [array]$Fixes,
        [string]$Service
    )
    
    $applied = $false
    $servicePath = if ($Service -eq "backend") { ".\backend" } else { ".\frontend" }
    
    foreach ($fix in $Fixes) {
        Write-Host "`nApplying fix for: $($fix.Type)" -ForegroundColor Yellow
        Write-Host "Fix: $($fix.Fix)" -ForegroundColor Green
        
        Set-Location -Path $servicePath
        
        switch ($fix.Type) {
            "MissingModule" {
                Write-Host "Installing missing module: $($fix.Module)" -ForegroundColor Cyan
                npm install $fix.Module --save
                $applied = $true
            }
            
            "PrismaGenerate" {
                Write-Host "Adding Prisma generate to build command..." -ForegroundColor Cyan
                # Update railway.json
                $railwayConfig = Get-Content "railway.json" | ConvertFrom-Json
                if ($railwayConfig.build.buildCommand -notmatch "prisma generate") {
                    $railwayConfig.build.buildCommand = "npm install --legacy-peer-deps && npx prisma generate && npm run build"
                    $railwayConfig | ConvertTo-Json -Depth 10 | Set-Content "railway.json"
                    $applied = $true
                }
            }
            
            "TypeScriptError" {
                Write-Host "Checking TypeScript configuration..." -ForegroundColor Cyan
                npx tsc --noEmit
                # Fix common TS issues
                if (Test-Path "tsconfig.json") {
                    $tsconfig = Get-Content "tsconfig.json" | ConvertFrom-Json
                    $tsconfig.compilerOptions.skipLibCheck = $true
                    $tsconfig | ConvertTo-Json -Depth 10 | Set-Content "tsconfig.json"
                    $applied = $true
                }
            }
            
            "MemoryError" {
                Write-Host "Optimizing build configuration..." -ForegroundColor Cyan
                # Add memory optimization to package.json scripts
                $packageJson = Get-Content "package.json" | ConvertFrom-Json
                $packageJson.scripts.build = "NODE_OPTIONS='--max-old-space-size=2048' next build"
                $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
                $applied = $true
            }
        }
        
        Set-Location -Path ".."
    }
    
    return $applied
}

# Function to commit and push fixes
function Push-Fixes {
    param(
        [string]$Service,
        [array]$Fixes
    )
    
    $servicePath = if ($Service -eq "backend") { ".\backend" } else { ".\frontend" }
    Set-Location -Path $servicePath
    
    # Create commit message
    $commitMessage = "Fix Railway deployment errors`n`n"
    foreach ($fix in $Fixes) {
        $commitMessage += "- Fix: $($fix.Type) - $($fix.Fix)`n"
    }
    
    # Git operations
    git add -A
    git commit -m $commitMessage
    git push origin main
    
    Set-Location -Path ".."
    
    Write-Host "`nFixes pushed to GitHub!" -ForegroundColor Green
    Write-Host "Railway will automatically redeploy..." -ForegroundColor Cyan
}

# Main monitoring loop
function Start-Monitoring {
    Write-Host "Starting Railway Deployment Monitor" -ForegroundColor Magenta
    Write-Host "Project ID: $ProjectId" -ForegroundColor Gray
    Write-Host "Monitoring: $ServiceName" -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray
    
    $lastCheck = Get-Date
    $checkInterval = 30 # seconds
    
    while ($true) {
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Checking deployment status..." -ForegroundColor Cyan
        
        # Get logs
        $logs = Get-RailwayLogs -Service $ServiceName
        $logString = $logs -join "`n"
        
        # Check for errors
        if ($logString -match "error|Error|ERROR|failed|Failed|FAILED") {
            Write-Host "Deployment error detected!" -ForegroundColor Red
            
            # Analyze errors
            $fixes = Analyze-DeploymentError -ErrorLog $logString
            
            if ($fixes.Count -gt 0) {
                Write-Host "`nFound $($fixes.Count) potential fixes:" -ForegroundColor Yellow
                foreach ($fix in $fixes) {
                    Write-Host "  - $($fix.Type): $($fix.Fix)" -ForegroundColor Gray
                }
                
                # Apply fixes
                $applied = Apply-Fixes -Fixes $fixes -Service $ServiceName
                
                if ($applied) {
                    # Push to GitHub
                    Push-Fixes -Service $ServiceName -Fixes $fixes
                    
                    Write-Host "`nWaiting for redeployment..." -ForegroundColor Cyan
                    Start-Sleep -Seconds 60
                }
            } else {
                Write-Host "No automatic fixes available. Manual intervention required." -ForegroundColor Yellow
                Write-Host "`nError log:" -ForegroundColor Red
                Write-Host $logString
            }
        } else {
            Write-Host "Deployment is healthy ✓" -ForegroundColor Green
        }
        
        if (-not $Watch) {
            break
        }
        
        Write-Host "`nNext check in $checkInterval seconds..." -ForegroundColor Gray
        Start-Sleep -Seconds $checkInterval
    }
}

# Run the monitor
if ($Watch) {
    Start-Monitoring
} else {
    # Single check
    $logs = Get-RailwayLogs -Service $ServiceName
    $logString = $logs -join "`n"
    
    if ($logString -match "error|Error|ERROR|failed|Failed|FAILED") {
        Write-Host "Errors found in deployment!" -ForegroundColor Red
        $fixes = Analyze-DeploymentError -ErrorLog $logString
        
        if ($fixes.Count -gt 0) {
            $applied = Apply-Fixes -Fixes $fixes -Service $ServiceName
            if ($applied) {
                Push-Fixes -Service $ServiceName -Fixes $fixes
            }
        }
    } else {
        Write-Host "No errors detected." -ForegroundColor Green
    }
}