cd ..\src
call ..\windows\nodejs\npm.cmd --spin=false --loglevel=info install
..\windows\nodejs\node server\server.js
rem start http://localhost:3000/
pause
