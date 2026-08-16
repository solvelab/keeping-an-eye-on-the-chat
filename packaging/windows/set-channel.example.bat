@echo off
setlocal

REM Executable name produced by electron-builder (package.json -> build.productName).
set "APP_EXE=EyeOnChat.exe"

REM ---------------------------------------------------------------------------
REM Required
REM ---------------------------------------------------------------------------
REM Replace <channel> with your Twitch channel name.
set "TWITCH_CHAT_URL=https://www.twitch.tv/popout/<channel>/chat"

REM ---------------------------------------------------------------------------
REM Overlay appearance and timing
REM ---------------------------------------------------------------------------
REM set "DISPLAY_SECONDS=5"
REM set "OVERLAY_ANCHOR=bottom-left"
REM set "OVERLAY_MARGIN=24"
REM set "BUBBLE_MAX_WIDTH=420"
REM set "ATTENTION_PAUSE_MS=500"
REM set "EXIT_ANIMATION_MS=400"

REM ---------------------------------------------------------------------------
REM Message filtering
REM ---------------------------------------------------------------------------
REM set "MAX_MESSAGE_LENGTH=140"
REM set "IGNORE_COMMAND_PREFIX=!"
REM set "IGNORE_USERS=nightbot,streamelements"
REM set "MAX_QUEUE_LENGTH=50"

REM ---------------------------------------------------------------------------
REM Notification sound
REM ---------------------------------------------------------------------------
REM set "NOTIFICATION_SOUND_ENABLED=1"
REM set "NOTIFICATION_SOUND_VOLUME=50"
REM set "NOTIFICATION_SOUND_FILE=C:\path\to\your-sound.wav"
REM set "NOTIFICATION_SOUND_DEVICE="

REM ---------------------------------------------------------------------------
REM Debugging
REM ---------------------------------------------------------------------------
REM set "DIAGNOSTICS=0"
REM set "OVERLAY_DEBUG=0"
REM set "DEVTOOLS=0"

REM Launch using run-overlay.bat or run-diag.bat after setting TWITCH_CHAT_URL.
endlocal
