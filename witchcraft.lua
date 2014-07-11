--[[
Add the following to MissionScripting.lua:

witchcraft = {}
witchcraft.host = "localhost"
witchcraft.port = 3001
dofile(lfs.writedir().."Scripts\\witchcraft.lua")
]]--

do
	local require = require
	local loadfile = loadfile
	
	env.info("initializing witchcraft...")
	
	if not witchcraft then
		env.info("global witchcraft object does not exist. Did you apply the required changes to MissionScripting.lua?")
		return
	end
	
	package.path = package.path..";.\\LuaSocket\\?.lua"
	package.cpath = package.cpath..";.\\LuaSocket\\?.dll"
	
	local JSON = loadfile("Scripts\\JSON.lua")()
	witchcraft.JSON = JSON
	local socket = require("socket")
	
	function witchcraft.luaMissionToJSONable()
		local mission = mist.utils.deepCopy(env.mission)
		for _, coalition in pairs(mission.coalition) do
			for _, country in pairs(coalition.country) do
				for _, category_name in pairs({"vehicle", "helicopter", "plane", "ship"}) do
					local category = country[category_name]
					if category then
						for _, group in pairs(category.group) do
							for _, unit in pairs(group.units) do
								if type(unit.callsign) == "table" then
									local new_callsign = {
										name = unit.callsign.name,
										["1"] = unit.callsign[1],
										["2"] = unit.callsign[2],
										["3"] = unit.callsign[3]
									}
									unit.callsign = new_callsign
								end
							end
						end
					end
				end
			end
		end
		return mission
	end
	
	function witchcraft.JSONableMissionToLua(jsonMission)
		local mission = mist.utils.deepCopy(jsonMission)
		for _, coalition in pairs(mission.coalition) do
			for _, country in pairs(coalition.country) do
				for _, category_name in pairs({"vehicle", "helicopter", "plane", "ship"}) do
					local category = country[category_name]
					if category then
						for _, group in pairs(category.group) do
							group.x = group.units[1].x
							group.y = group.units[1].y
							group.route.points[1].x = group.units[1].x
							group.route.points[1].y = group.units[1].y
							if group.route.points[2] then
								group.route.spans[1][1].x = group.units[1].x
								group.route.spans[1][1].y = group.units[1].y
							end
							
							for _, unit in pairs(group.units) do
								if type(unit.callsign) == "table" then
									local new_callsign = {
										name = unit.callsign.name,
										[1] = unit.callsign["1"],
										[2] = unit.callsign["2"],
										[3] = unit.callsign["3"]
									}
									unit.callsign = new_callsign
								end
							end
						end
					end
				end
			end
		end
		return mission
	end
	
	function witchcraft.considerUnit(unit)
		if not unit then return false end
		if not Unit.isExist(unit) then return false end
		if not unit:isActive() then return false end
		return true
	end
	
	function witchcraft.unitUpdate()
		msg = {}
		msg.type = "unitupdate"
		msg.units = {}
		for _, aliveUnit in pairs(mist.DBs.aliveUnits) do
		local unit = Unit.getByName(aliveUnit.unitName)
			if witchcraft.considerUnit(unit) then
				local pos = unit:getPosition()
				msg.units[#msg.units+1] = {
					uN = aliveUnit.unitName,
					pd = pos, -- position_dcs
					cat = aliveUnit.category,
					t = unit:getTypeName(),
					c = unit:getCoalition(),
					alt = pos.p.y - land.getHeight({ x = pos.p.x, y = pos.p.z}),
				}
			end
		end
		
		witchcraft.txbuf = JSON:encode(msg):gsub("\n", "").."\n"
	end
	
	witchcraft.groupNamesToSetInvisible = {}
	witchcraft.syncJSONGroup = function(group)
		for _, unit in pairs(group.units) do
			if type(unit.callsign) == "table" then
				local new_callsign = {
					name = unit.callsign.name,
					[1] = unit.callsign["1"],
					[2] = unit.callsign["2"],
					[3] = unit.callsign["3"]
				}
				unit.callsign = new_callsign
			end
		end
		group.route = {}
		mist.dynAdd(group)
		witchcraft.groupNamesToSetInvisible[#witchcraft.groupNamesToSetInvisible+1] = group.name
	end

	
	function witchcraft.step(arg, time)
		for _, groupName in pairs(witchcraft.groupNamesToSetInvisible) do
			local grp = Group.getByName(groupName)
			if grp and grp:isExist() then grp:getController():setCommand({id="SetInvisible", params={value=true}}) end
		end
		witchcraft.groupIdsToSetInvisible = {}
	
		if witchcraft.txbuf:len() == 0 then
			if witchcraft.unitUpdateInterval > 0 then
				if (timer.getTime() - witchcraft.lastUnitUpdateTime > witchcraft.unitUpdateInterval) or (witchcraft.lastUnitUpdateTime == 0) then
					local bool, err = pcall(witchcraft.unitUpdate)
					if not bool then
						env.info("witchcraft.unitUpdate() failed: "..err)
					end
					witchcraft.lastUnitUpdateTime = timer.getTime()
				end
			end
		end
		witchcraft.txbuf = witchcraft.txbuf .. '{"type":"dummy"}\n'
		if witchcraft.txbuf:len() > 0 then
			local bytes_sent = nil
			local ret1, ret2, ret3 = witchcraft.conn:send(witchcraft.txbuf)
			if ret1 then
				bytes_sent = ret1
			else
				env.info("could not send witchcraft: "..ret2)
				if ret3 == 0 then
					if ret2 == "closed" then
						witchcraft.txbuf = '{"type":"dummy"}\n'
						witchcraft.rxbuf = ""
						witchcraft.lastUnitUpdateTime = 0
						witchcraft.conn = socket.tcp()
						witchcraft.conn:settimeout(.0001)
						env.info("witchcraft: socket was closed")
					end
					env.info("reconnecting to "..tostring(witchcraft.host)..":"..tostring(witchcraft.port))
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
					env.info("witchcraft.txidle_hook() failed: "..err)
				end
			end
		end
		
		local line, err = witchcraft.conn:receive()
		if err then
			env.info("witchcraft read error: "..err)
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
			if msg.type == "smoke" then
				local smoke_color = msg.color or "Green"
				local center = coord.LLtoLO(msg.lat, msg.lon, 0)
				center.y = land.getHeight({ x = center.x, y = center.z})
				trigger.action.smoke(center, trigger.smokeColor[smoke_color])
				local response_msg = {}
				response_msg.type = "smokeconfirm"
				response_msg.lon = msg.lon
				response_msg.lat = msg.lat
				response_msg.color = smoke_color
				witchcraft.txbuf = witchcraft.txbuf .. JSON:encode(response_msg):gsub("\n","").."\n"
			end
			if msg.type == "set-unit-ai-visibility" then
				for unitname, visible in pairs(msg.units) do
					local unit = Unit.getByName(unitname)
					if unit and unit:isExist() then 
						unit:getController():setCommand({id="SetInvisible", params={value=(not visible)}})
					else
						env.info("unit.getByName failed for "..unitname)
					end
				end
			end
		end
		
	end
	
	function witchcraft_start(mission_env_)
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
			
			timer.scheduleFunction(function(arg, time)
					local bool, err = pcall(witchcraft.step)
					if not bool then
						env.info("witchcraft.step() failed: "..err)
					end
					
					return timer.getTime() + .1 -- <<< update interval
				end, nil, timer.getTime() + .1)
				
				
			witchcraft.scheduled = true
			
		end
	end
	witchcraft.start = witchcraft_start
	
	function witchcraft_log(data)
		local msg = { ["type"] = "log", ["data"] = data };
		witchcraft.txbuf = witchcraft.txbuf .. JSON:encode(msg):gsub("\n","").."\n"
	end
	witchcraft.log = witchcraft_log
end