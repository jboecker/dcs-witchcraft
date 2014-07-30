if (typeof module !== 'undefined' && module.exports) {
	var _ = require("lodash");
}

var MissionModel = function() {
	this.groups_ = MissionModel.ObservableCollection();
	this.groupsByUnitId_ = {};
	this.groups_.on('set', _.bind(function(event) {
		if (event.oldValue) {
			_.each(event.oldValue.units, function(unit) {
				delete this.groupsByUnitId_[unit.unitId];
			}, this);
		};
		if (event.value) {
			_.each(event.value.units, function(unit) {
				this.groupsByUnitId_[unit.unitId] = event.value;
			}, this);
		};
	}, this));
	
	this.eventListeners_ = {
		'change': [],
		'setGroup': [],
	};
	this.reset_();
	return this;
};

MissionModel.prototype.findGroupByUnitId = function(unitId) {
	return this.groupsByUnitId_[unitId];
};

MissionModel.ObservableCollection = function() {
	var items = {};
	var eventListeners = {
		'new': [],
		'update': [],
		'delete': [],
		'change': [],
		'set': [],
	};
	var fireEvent = function(name, event) {
		_.each(eventListeners[name], function(callback) {
			callback(event);
		});
	};
	
	var on = function(name, callback, context) {
			eventListeners[name].push(callback);
		};
	var off = function(name, callback) {
			eventListeners[name] = _.without(eventListeners[name], callback);
		};
	var each = function(op, context) {
			_.each(items, op, context);
		};
	var set = function(key, newValue) {
			var currentValue = items[key];
			if (currentValue === undefined && newValue === undefined) return false;
			if (newValue === undefined) {
				items[key] = newValue;
				fireEvent('delete', { type: 'delete', oldValue: currentValue });
				fireEvent('set', { type: 'set', oldValue: currentValue });
				return true;
			};
			
			var event = { type: currentValue === undefined ? 'new' : 'update' };
			event.key = key;
			event.oldValue = items[key];
			items[key] = newValue;
			event.value = newValue;
			fireEvent(event.type, event);
			fireEvent('set', { type: 'set', oldValue: event.oldValue, value: newValue });
			return true;
		};
	var get = function(key, value, defaultValue) {
			return items[key] === undefined ? defaultValue : items[key];
		};
	var clear = function(key, value) {
			var keys = Object.keys(items);
			_.each(keys, function(key) {
				set(key, undefined);
			});
			return true;
		};
		
	return {
		on: on,
		off: off,
		each: each,
		set: set,
		get: get,
		clear: clear,
		items_: items,
		eventListeners_: eventListeners,
	};
};

MissionModel.prototype.fireEvent_ = function(name, event) {
	_.each(this.eventListeners_[name], function(callback) {
		callback(event);
	});
};
MissionModel.prototype.on = function(name, callback) {
	this.eventListeners_[name].push(callback);
};
MissionModel.prototype.off = function(name, callback) {
	this.eventListeners_[name] = _.without(this.eventListeners_[name], callback);
};

MissionModel.prototype.reset_ = function() {
	// called from constructor and loadMission_
	this.baseMission_ = null;
	if (this.groups_) this.groups_.clear();
	this.missionLoaded_ = false;
};

MissionModel.prototype.loadMission_ = function(mission) {
	this.reset_();
	if (mission == null) return true;
	
	this.baseMission_ = {
		coalition: {},
	};
	_.each(mission, function(value, key) {
		if (key == 'coalition') {
			_.each(mission.coalition, function(coalition, coalition_name) {
				this.baseMission_.coalition[coalition_name] = {
					bullseye: coalition.bullseye,
					name: coalition.name,
					country: [],
					nav_points: coalition.nav_points,
				};
				_.each(coalition.country, function(country) {
					this.baseMission_.coalition[coalition_name].country.push({
						name: country.name,
						id: country.id,
					});
					_.each(["vehicle", "ship", "plane", "helicopter", "static"], function(category_name) {
						var category = country[category_name];
						if (category) {
							_.each(category.group, function(group) {
								var newGroup = JSON.parse(JSON.stringify(group));
								newGroup.category = category_name;
								newGroup.country = country.name;
								newGroup.coalition = coalition_name;
								this.groups_.set(newGroup.groupId, newGroup);
							}, this);
						}
					}, this);
				}, this);
			}, this);
		} else {
			this.baseMission_[key] = value;
		};
	}, this);
	this.missionLoaded_ = true;
};

MissionModel.prototype.toMission = function() {
	if (!this.missionLoaded_) return null;
	
	var mission = JSON.parse(JSON.stringify(this.baseMission_))
	this.groups_.each(function(group) {
		_.each(mission.coalition[group.coalition].country, function(country) {
			if (country.name == group.country) {
				if (country[group.category] === undefined)
					country[group.category] = { group: [] };
				var group_copy = JSON.parse(JSON.stringify(group));
				delete group_copy.coalition;
				delete group_copy.country;
				delete group_copy.category;
				delete group_copy.witchcraft;
				country[group.category].group.push(group_copy);
			}
		});
	}, this);
	return mission;
};


MissionModel.prototype.operationTypes = {}
MissionModel.prototype.operationTypes["setGroup"] = {
	validate: function(op) {
		if (typeof op.group != "object") return false;
		if (!op.group.coalition) return false;
		if (!op.group.country) return false;
		if (!op.group.coalition) return false;
		return true;
	},
	applyOperation: function(op) {
		this.groups_.set(op.group.groupId, op.group);
		this.fireEvent_('setGroup', op.group);
	},
};
MissionModel.prototype.operationTypes["loadMission"] = {
	validate: function(op) {
		return true;
	},
	applyOperation: function(op) {
		this.loadMission_(op.mission);
	},
};


MissionModel.prototype.processChangeRequest = function(op) {
	if (!this.operationTypes[op.type]){
		console.log("invalid op type: ", op.type);
		return false;
	};
	var opType = this.operationTypes[op.type];
	if (!opType.validate.call(this, op)) {
		return false;
	} else {
		opType.applyOperation.call(this, op);
		this.fireEvent_('change', op);
		return true;
	}
};


if (typeof module !== 'undefined' && module.exports) {
	module.exports.makeMM = function() {
		var ret = new MissionModel();
		return ret;
	};
};
