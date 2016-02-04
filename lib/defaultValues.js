var _ = require('lodash');

function nil(value) {
	return !value && value !== 0;
}

module.exports = function defaultValues(model, attrs, options) {
	_.forEach(model.constructor.attributes, function(field, key) {
		if (field.defaultsTo && nil(model.attributes[key])) model.set(key, field.defaultsTo);
	});
};