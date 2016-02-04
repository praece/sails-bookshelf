var _ = require('lodash');

function validationError(message) {
    this.name = 'Validation Error';
    this.message = message || "";
}

validationError.prototype = new Error();

function nil(value) {
	return !value && value !== 0;
}

var validators = {
	required: function(attributes, method, field, value) {
    if (nil(attributes[field])) return field + ' is required!';
	},
	in: function(attributes, method, field, value) {
		if (!nil(attributes[field]) && !_.includes(value, attributes[field])) return 'Invalid value for ' + field;
	}
};

module.exports = function validation(model, attrs, options) {
	var validations = [];

	_.forEach(model.constructor.attributes, function(field, key) {
		// If there is validation to run, or if we aren't trying to update that field skip it.
    if (!field.validation || (!model.isNew() && _.isUndefined(model.attributes[key]))) return;

		_.forEach(field.validation, function(value, validator) {
			validations.push(validators[validator](model.attributes, options.method, key, value));
		});
	});

	return Promise.all(validations)
		.then(function(errors) {
			var errors = _.compact(errors);

			if (!_.isEmpty(errors)) return Promise.reject(new validationError('\n\t\u2022 ' + errors.join('\n\t\u2022 ')));
		});
};

