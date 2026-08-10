@echo off
REM Rilo Native Messaging Host Registration Script for Windows
set "HOST_NAME=com.rilo.downloader"
set "SCRIPT_DIR=%~dp0"
set "CHROME_MANIFEST=%SCRIPT_DIR%com.rilo.downloader.chrome.json"
set "FIREFOX_MANIFEST=%SCRIPT_DIR%com.rilo.downloader.firefox.json"

echo Registering Rilo Native Messaging Host for Google Chrome...
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%CHROME_MANIFEST%" /f

echo Registering Rilo Native Messaging Host for Mozilla Firefox...
REG ADD "HKCU\Software\Mozilla\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%FIREFOX_MANIFEST%" /f

echo Rilo Native Messaging Host successfully registered in Windows Registry!
pause
