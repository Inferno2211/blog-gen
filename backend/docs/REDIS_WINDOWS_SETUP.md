# Redis for Windows Setup Guide

## Problem
WSL Redis has unreliable network connectivity from Windows Node.js applications, causing constant reconnection loops.

## Solution: Install Redis Natively on Windows

### Option 1: Using Memurai (Redis-compatible, Windows-native)

1. **Download Memurai** (free developer edition):
   ```
   https://www.memurai.com/get-memurai
   ```

2. **Install and start**:
   - Installer will set up Memurai as a Windows service
   - It will auto-start on boot
   - Default port: 6379 (same as Redis)

3. **Update .env**:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

4. **Test connection**:
   ```powershell
   memurai-cli ping
   # Should return: PONG
   ```

### Option 2: Using Redis Docker (if you have Docker Desktop)

1. **Pull and run Redis**:
   ```powershell
   docker run -d --name redis -p 6379:6379 redis:latest
   ```

2. **Update .env**:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

3. **Test connection**:
   ```powershell
   docker exec -it redis redis-cli ping
   # Should return: PONG
   ```

### Option 3: Using Chocolatey (Windows package manager)

1. **Install Chocolatey** (if not already installed):
   ```powershell
   # Run as Administrator
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Install Redis**:
   ```powershell
   # Run as Administrator
   choco install redis-64 -y
   ```

3. **Start Redis service**:
   ```powershell
   redis-server --service-start
   ```

4. **Update .env**:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

## Why WSL Redis Doesn't Work

- WSL uses a virtual network interface
- Windows → WSL connections can drop when WSL suspends
- Network bridge can reset randomly
- Bull queues need persistent, stable connections
- Each queue creates multiple Redis clients (listener, worker, scheduler)
- Connection pool exhaustion causes ECONNABORTED errors

## After Installing Redis

1. **Stop WSL Redis** (to avoid conflicts):
   ```powershell
   wsl sudo service redis-server stop
   ```

2. **Update backend/.env** to use `localhost`:
   ```env
   REDIS_HOST=localhost
   ```

3. **Restart backend server**:
   ```powershell
   cd backend
   npm run dev
   ```

4. **Start queue worker**:
   ```powershell
   cd backend
   npm run worker
   ```

## Verification

After setup, you should see:
- ✅ No ECONNRESET or ECONNABORTED errors
- ✅ Stable queue connections
- ✅ Jobs processing successfully
- ✅ No spam retry messages
