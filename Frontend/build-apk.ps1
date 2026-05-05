# Digital ID APK Build Script

Write-Host "[BUILD] Starting Digital ID APK Build..." -ForegroundColor Cyan

# Step 1: Build the Web Assets
Write-Host "[WEB] Running Next.js build..." -ForegroundColor Yellow
npm run build

# Step 2: Sync to Capacitor
Write-Host "[SYNC] Syncing assets to Android..." -ForegroundColor Yellow
npx cap sync

# Step 3: Build the APK using Gradle
Write-Host "[GRADLE] Running Gradle build..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..

# Step 4: Copy and Rename the APK to the public folder
$sourcePath = "android/app/build/outputs/apk/debug/app-debug.apk"
$destinationPath = "public/Digital_ID.apk"

if (Test-Path $sourcePath) {
    Write-Host "[SUCCESS] Build Successful! Copying APK..." -ForegroundColor Green
    Copy-Item -Path $sourcePath -Destination $destinationPath -Force
    Write-Host "[DONE] APK available at: Frontend/public/Digital_ID.apk" -ForegroundColor Green
} else {
    Write-Host "[ERROR] APK build failed. Check the logs above." -ForegroundColor Red
}
