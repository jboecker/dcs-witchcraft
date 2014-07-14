-- This is a stripped-down version of witchcraft.lua adapted to work
-- as a backend for the Lua Console within the Export.lua environment.

-- Call this file from export.lua to use the Witchcraft Lua Console
-- in the DCS Export environment.
-- Note that you should not run a mission that calls witchcraft.start() at the same time,
-- as both will connect to the server at the same time, which probably leads to interesting(TM) results.

do
	local witchcraft = {}
	witchcraft.host = "localhost"
	witchcraft.port = 3001
	local require = require
	local loadfile = loadfile

	package.path = package.path..";.\\LuaSocket\\?.lua"
	package.cpath = package.cpath..";.\\LuaSocket\\?.dll"
	
	local JSON = loadfile("Scripts\\JSON.lua")()
	witchcraft.JSON = JSON
	local socket = require("socket")
	
	function witchcraft.step(arg, time)
		witchcraft.txbuf = witchcraft.txbuf .. '{"type":"dummy"}\n'
		if witchcraft.txbuf:len() > 0 then
			local bytes_sent = nil
			local ret1, ret2, ret3 = witchcraft.conn:send(witchcraft.txbuf)
			if ret1 then
				bytes_sent = ret1
			else
				--env.info("could not send witchcraft: "..ret2)
				if ret3 == 0 then
					if ret2 == "closed" then
						witchcraft.txbuf = '{"type":"dummy"}\n'
						witchcraft.rxbuf = ""
						witchcraft.lastUnitUpdateTime = 0
						witchcraft.conn = socket.tcp()
						witchcraft.conn:settimeout(.0001)
						--env.info("witchcraft: socket was closed")
					end
					--env.info("reconnecting to "..tostring(witchcraft.host)..":"..tostring(witchcraft.port))
					witchcraft.conn:connect(witchcraft.host, witchcraft.port)
					return
				end
				bytes_sent = ret3
			end
			witchcraft.txbuf = witchcraft.txbuf:sub(bytes_sent + 1)
		else
			if witchcraft.txidle_hook then
				local bool, err = pcall(witchcraft.txidle_hook)
				if not bool then
					--env.info("witchcraft.txidle_hook() failed: "..err)
				end
			end
		end
		
		local line, err = witchcraft.conn:receive()
		if err then
			--env.info("witchcraft read error: "..err)
		else
			msg = JSON:decode(line)
			if msg.type == "lua" then
				local response_msg = {}
				response_msg.type = "luaresult"
				response_msg.name = msg.name
				local f, error_msg = loadstring(msg.code, msg.name)
				if f then
					witchcraft.context = {}
					witchcraft.context.arg = msg.arg
					setfenv(f, witchcraft.mission_env)
					response_msg.success, response_msg.result = pcall(f)
				else
					response_msg.success = false
					response_msg.result = tostring(error_msg)
				end
				
				local response_string = ""
				local function encode_response()
					response_string = JSON:encode(response_msg):gsub("\n","").."\n"
				end
				
				local success, result = pcall(encode_response)
				if not success then
					response_msg.success = false
					response_msg.result = tostring(result)
					encode_response()
				end
				
				witchcraft.txbuf = witchcraft.txbuf .. response_string
			end
		end
		
	end
	
	witchcraft.start = function(mission_env_)
		witchcraft.mission_env = mission_env_
		
		if not witchcraft.scheduled then
			
			
			witchcraft.lastUnitUpdateTime = 0
			witchcraft.unitUpdateInterval = 0
			witchcraft.txbuf = '{"type":"dummy"}\n'
			witchcraft.rxbuf = ""
			witchcraft.lastUnitUpdateTime = 0
			witchcraft.conn = socket.tcp()
			witchcraft.conn:settimeout(.0001)
			witchcraft.conn:connect(witchcraft.host, witchcraft.port)				
			witchcraft.scheduled = true
			
		end
	end
	
	witchcraft.log = function(data)
		local msg = { ["type"] = "log", ["data"] = data };
		witchcraft.txbuf = witchcraft.txbuf .. JSON:encode(msg):gsub("\n","").."\n"
	end
	

	-- Prev Export functions.
	local PrevExport = {}
	PrevExport.LuaExportStart = LuaExportStart
	PrevExport.LuaExportStop = LuaExportStop
	PrevExport.LuaExportAfterNextFrame = LuaExportAfterNextFrame
	
	local lastStepTime = 0

	-- Lua Export Functions
	LuaExportStart = function()
	
		witchcraft.start(_G)
		
		-- Chain previously-included export as necessary
		if PrevExport.LuaExportStart then
			PrevExport.LuaExportStart()
		end
	end
	
	LuaExportStop = function()
		-- Chain previously-included export as necessary
		if PrevExport.LuaExportStop then
			PrevExport.LuaExportStop()
		end
	end

	function LuaExportAfterNextFrame()

		local curTime = LoGetModelTime()
		
		if curTime >= lastStepTime then
			local bool, err = pcall(witchcraft.step)
			if not bool then
				--env.info("witchcraft.step() failed: "..err)
			end
			lastStepTime = curTime + .1
		end

		-- Chain previously-included export as necessary
		if PrevExport.LuaExportAfterNextFrame then
			PrevExport.LuaExportAfterNextFrame()
		end
	end

	
end

