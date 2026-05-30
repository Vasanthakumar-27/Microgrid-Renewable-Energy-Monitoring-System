# ================================================================
# WINDOWS AUTO-RESTART & AUTO-START CONFIGURATION
# PM2 Auto-Start Configuration for Windows
# ================================================================

# This script sets up automatic restart of PM2 applications on Windows
# It uses Windows Task Scheduler as PM2's startup doesn't work on Windows

param(
    [ValidateSet("install", "remove", "status", "help")]
    [string]$Action = "help"
)

$TaskName = "PM2-MicrogridCitySystem"
$TaskDescription = "Auto-start PM2 Microgrid City System on Windows startup"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $ScriptPath "start-pm2.bat"

function Write-Status {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Create-StartScript {
    @"
@echo off
REM Auto-start PM2 application on Windows startup
REM This script is called by Windows Task Scheduler

cd /d "$ScriptPath"

REM Wait for network to be available
timeout /t 5 /nobreak

REM Start PM2
echo Starting PM2 Microgrid City System...
call npm run pm2:start

REM Log startup
echo [%date% %time%] PM2 started >> startup.log
"@ | Out-File -FilePath $StartScript -Encoding ASCII -Force
    
    Write-Status "Created startup script: $StartScript" "SUCCESS"
}

function Install-AutoRestart {
    Write-Status "Setting up Windows auto-restart..." "INFO"
    
    # Create the startup batch script
    Create-StartScript
    
    # Create Task Scheduler action
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`""
    
    # Create trigger for system startup
    $trigger = New-ScheduledTaskTrigger -AtStartup
    
    # Create task settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    
    # Create the task
    try {
        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Description $TaskDescription `
            -RunLevel Highest `
            -Force
        
        Write-Status "Auto-restart installed successfully" "SUCCESS"
        Write-Status "Task: $TaskName" "SUCCESS"
        Write-Status "The application will now auto-start on system startup" "SUCCESS"
        
    } catch {
        Write-Status "Failed to install auto-restart: $_" "ERROR"
        exit 1
    }
}

function Remove-AutoRestart {
    Write-Status "Removing auto-restart configuration..." "INFO"
    
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        
        if ($task) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Status "Auto-restart removed successfully" "SUCCESS"
            
            # Clean up startup script
            if (Test-Path $StartScript) {
                Remove-Item $StartScript -Force
                Write-Status "Startup script deleted" "INFO"
            }
        } else {
            Write-Status "Task not found: $TaskName" "WARN"
        }
        
    } catch {
        Write-Status "Failed to remove auto-restart: $_" "ERROR"
        exit 1
    }
}

function Show-Status {
    Write-Status "Checking auto-restart status..." "INFO"
    Write-Host ""
    
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        
        if ($task) {
            Write-Host "Task Name: $($task.TaskName)" -ForegroundColor Green
            Write-Host "Status: $($task.State)" -ForegroundColor Green
            Write-Host "Last Run: $($task.LastRunTime)" -ForegroundColor Green
            Write-Host "Next Run: $($task.NextRunTime)" -ForegroundColor Green
            
            if ($task.State -eq "Ready") {
                Write-Host "`n✅ Auto-restart is ENABLED" -ForegroundColor Green
            } else {
                Write-Host "`n⚠️  Auto-restart is DISABLED" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Auto-restart is NOT configured" -ForegroundColor Red
            Write-Host "Run: .\pm2-auto-start.ps1 -Action install" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Status "Failed to get task status: $_" "ERROR"
        exit 1
    }
}

function Show-Help {
    Write-Host @"
PM2 Auto-Restart Configuration for Windows
==========================================

Usage: .\pm2-auto-start.ps1 -Action <action>

Actions:
  install    - Setup auto-start on Windows startup
  remove     - Remove auto-start configuration
  status     - Show current auto-restart status
  help       - Show this help message

Examples:
  .\pm2-auto-start.ps1 -Action install
  .\pm2-auto-start.ps1 -Action status
  .\pm2-auto-start.ps1 -Action remove

Requirements:
  - Windows 7 or later
  - Administrator privileges
  - PowerShell 3.0 or later

Features:
  ✓ Automatic startup on system reboot
  ✓ Auto-recovery if PM2 crashes
  ✓ Network availability check
  ✓ Startup delay for system readiness
  ✓ Logging for debugging

Notes:
  - Run PowerShell as Administrator
  - Task runs with HIGHEST privileges
  - Check logs in startup.log for debugging
  - Use 'pm2 status' to verify application is running
  - Use 'pm2 logs' to view application logs

"@
}

# Validate administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Status "This script requires Administrator privileges" "ERROR"
    Write-Status "Please run PowerShell as Administrator" "INFO"
    exit 1
}

# Execute action
switch ($Action) {
    "install" { Install-AutoRestart }
    "remove" { Remove-AutoRestart }
    "status" { Show-Status }
    "help" { Show-Help }
    default { Show-Help }
}
