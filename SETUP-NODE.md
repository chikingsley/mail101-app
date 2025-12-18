# Node.js Setup (Windows)

Run these in **Administrator PowerShell**, one section at a time.

## 1. Install nvm-windows

```powershell
winget install CoreyButler.NVMforWindows
```

**Close and reopen terminal as Administrator after this step.**

## 2. Install Node.js (includes npm)

```powershell
nvm install lts
nvm use lts
```

## 3. Verify installation

```powershell
node -v
npm -v
```

## 4. Install pnpm

```powershell
npm install -g pnpm
pnpm -v
```

## 5. (Optional) Install yarn

```powershell
npm install -g yarn
yarn -v
```
