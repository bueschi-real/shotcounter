@echo off
chcp 65001 >nul
set ADMIN_PIN=1234
set PIN_MODE=critical
set APP_TITLE=Sprützerball Shotcounter
set PORT=3000
set MAX_NAME_LENGTH=40
call npm start
pause