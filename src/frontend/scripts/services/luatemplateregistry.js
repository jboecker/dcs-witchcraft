witchcraft.service('luaTemplateRegistry', function() {
	var templates = [];
	return {
		addTemplate: function(tpl) {
			templates.push(tpl);
		},
		getTemplates: function() {
			return templates;
		},
	};
});