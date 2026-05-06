# Digital ID APK Build Script
# NOTE: This APK loads the web app from the live Vercel URL (capacitor.config.ts → server.url)
# so a local Next.js build is NOT required. We only need cap sync + Gradle.
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "[BUILD] Starting Digital ID APK Build..." -ForegroundColor Cyan

# Cleanup old APK to prevent false success reports
$sourcePath = "android/app/build/outputs/apk/debug/app-debug.apk"
$destinationPath = "public/Digital_ID.apk"
if (Test-Path $sourcePath) { Remove-Item $sourcePath -Force }

# Step 1: Sync Capacitor config to Android
Write-Host "[SYNC] Syncing Capacitor assets to Android..." -ForegroundColor Yellow
npx cap sync

# Step 2: Build the APK using Gradle
Write-Host "[GRADLE] Running Gradle build..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..

# Step 3: Copy APK to public folder for easy download
if (Test-Path $sourcePath) {
    Write-Host "[SUCCESS] Build Successful! Copying APK..." -ForegroundColor Green
    Copy-Item -Path $sourcePath -Destination $destinationPath -Force
    Write-Host "[DONE] APK available at: Frontend/public/Digital_ID.apk" -ForegroundColor Green
} else {
    Write-Host "[ERROR] APK build failed. Gradle did not produce an output file." -ForegroundColor Red
    exit 1
}
