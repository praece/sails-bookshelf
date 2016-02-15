var _ = require('lodash');
var createError = require('create-error');
var validationError = createError('ValidationError');

var validators = {
  required: function(attributes, method, field, value) {
    if (_.isNil(attributes[field])) return field + ' is required!';
  },
  in: function(attributes, method, field, value) {
    if (!_.includes(value, attributes[field])) return 'Invalid value for ' + field;
  },
  custom: function(attributes, method, field, fn) {
    return fn(attributes, method, field);
  }
};

module.exports = function validation(model, attrs, options) {
  var validations = [];

  _.forEach(model.constructor.attributes, function(field, key) {
    // No validation necessary
    if (!field.validation) return;

    _.forEach(field.validation, function(value, validator) {
      // If we aren't updating this specific attribute or if it isn't required don't validate
      if (_.isUndefined(model.attributes[key]) && (options.method === 'update' || validator !== 'required')) return;

      validations.push(validators[validator](model.attributes, options.method, key, value));
    });
  });

  return Promise.all(validations)
    .then(function(errors) {
      var errors = _.compact(errors);

      if (!_.isEmpty(errors)) return Promise.reject(new validationError('\n\t\u2022 ' + errors.join('\n\t\u2022 ')));
    });
};

