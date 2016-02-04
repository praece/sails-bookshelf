var _ = require('lodash');

module.exports = function strongParameters(model, attrs, options) {
	var allowedFields = _.keys(model.constructor.attributes)
    .concat(_.keys(model.relationships))
    .concat(['updatedAt', 'createdAt', 'id']);

	_.forEach(model.attributes, function(attribute, key) {
		if (!_.includes(allowedFields, key)) model.unset(key); 
	});
};