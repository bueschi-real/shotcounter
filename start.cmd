@echo off
chcp 65001 >nul
set ADMIN_PIN=1234
set APP_TITLE=Sprützerball Shotcounter
call npm start
pause