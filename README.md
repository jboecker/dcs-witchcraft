dcs-witchcraft
==============

"DCS Witchcraft" is:
* a node.js server application
* a Lua script that runs in the DCS: World mission scripting environment and talks to the node.js server via a TCP connection
* some web applications, including a debug console that allows you to execute Lua snippets inside the running mission and look at the return values

Here's what works so far:
* Lua debug console for interactive development and debugging of mission scripts
* Mission Editor to adjust the positions of existing units (mirrored to the running mission so you can watch the final position in the 3D environment)

[Watch the video walkthrough](http://www.dailymotion.com/video/x21d3ac_dcs-witchcraft-tutorial_videogames) to learn more.

## Initial Setup
* Copy `witchcraft.lua` to `%USERPROFILE%\Saved Games\DCS\Scripts\` (e.g. `C:\Users\<Your Username>\Saved Games\DCS\Scripts\`).
* Go to your DCS: World installation directory (most likely `C:\Program Files\Eagle Dynamics\DCS World`), open the `Scripts` subfolder and edit the file `MissionScripting.lua`.
Add the following code somewhere before the function `sanitizeModule` is defined:
````lua
witchcraft = {}
witchcraft.host = "localhost"
witchcraft.port = 3001
dofile(lfs.writedir()..[[Scripts\witchcraft.lua]])
````

## Preparing the Mission
To start trying to connect to the node.js server, your mission will have to call `witchcraft.start(_G)`.

Create a new trigger set to fire ONCE, create a new condition TIME IS MORE (1 second) and add two actions:

1. a DO SCRIPT FILE action that loads [MIST](http://forums.eagle.ru/showthread.php?t=98616)
2. a DO SCRIPT action with the text `witchcraft.start(_G)`

## Using the Debug Console and the Map
* Start the node.js server. If you are using windows, simply double-click `witchcraft.cmd` in the `windows` subfolder of this repository.
* Start your DCS: World mission and enter a slot (singleplayer) or unpause the server (multiplayer).
* Point a web browser at http://localhost:3000 (if you used witchcraft.cmd, it automatically did that for you in the first step).

The Lua debug console is mostly self-explanatory. Just play around with it and avoid infinite loops (those will understandably cause DCS to hang).

If you want the map to display the live positions of ground units, you have to tell witchcraft that it should send regular unit updates (select the "enable unit updates" template in the Lua Console and press Ctrl+Enter to execute it).
The map is in an early stage and is currently hard-coded to only show units of the blue coalition.


## License
The project itself is licensed under the GPLv3 or later. For third-party components (node.js and npm modules, the map icons, anything under `src/bower_components` and `src/vendor_js`), the licensing information can be found in the respective subdirectories or in the source file itself.
