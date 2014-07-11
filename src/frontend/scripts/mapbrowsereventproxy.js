goog.provide("ol.witchcraft.MapBrowserEventProxy");
goog.require("ol.MapBrowserEvent");
goog.require("ol.MapBrowserEvent.EventType");
goog.require("ol.interaction.Interaction");
ol.witchcraft.MapBrowserEventProxy = function(callback) {
    goog.base(this);
    this.callback_ = callback;
};
goog.inherits(ol.witchcraft.MapBrowserEventProxy, ol.interaction.Interaction);

ol.witchcraft.MapBrowserEventProxy.prototype.handleMapBrowserEvent = function(mapBrowserEvent) {
	try {
		return this.callback_(mapBrowserEvent);
	} catch(e) {
		console.log(e);
		return true;
	}
};
