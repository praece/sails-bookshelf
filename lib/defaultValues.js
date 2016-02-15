var _ = require('lodash');

module.exports = function defaultValues(model, attrs, options) {
  _.forEach(model.constructor.attributes, function(field, key) {
    if (!_.isNil(field.defaultsTo) && _.isNil(model.attributes[key])) model.set(key, field.defaultsTo);
  });
};