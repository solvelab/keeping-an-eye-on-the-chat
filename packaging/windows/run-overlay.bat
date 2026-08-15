@echo off
setlocal

REM Executable name produced by electron-builder (package.json -> build.productName).
set "APP_EXE=EyeOnChat.exe"

REM Set your Twitch popout chat URL below
set "TWITCH_CHAT_URL=https://www.twitch.tv/popout/<channel>/chat"
set "OVERLAY_DEBUG=0"
set "DIAGNOSTICS=0"

if not exist "%~dp0%APP_EXE%" (
  echo Could not find "%APP_EXE%" next to this script.
  echo Copy this file into the extracted release folder and run it again.
  pause
  exit /b 1
)

start "" "%~dp0%APP_EXE%"
endlocal
