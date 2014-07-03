cd ..\src\backend
call ..\..\windows\nodejs\npm.cmd --spin=false --loglevel=info install
start ..\..\windows\nodejs\node server.js
start http://localhost:3000/
