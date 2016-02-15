var _ = require('lodash');
var Promise = require('bluebird');

module.exports = function nestedSave(model, attrs, options) {
  var relationships = {};
  var nestOptions = options.transacting ? {transacting: options.transacting} : {};
  nestOptions.nested = true;

  _.forEach(model.relationships, function(relationship, key) {
    var attr = model.attributes[key];

    // If the attribute is undefined or primitive just return so it can be saved
    if (_.isUndefined(attr) || !_.isObject(attr)) return;

    // If the relation is an array grab it so we can save the nested relations
    if (_.isArray(attr)) relationships[key] = _.clone(attr);
  
    // Remove all non-primitives from the object we are saving, we don't want those in the database
    model.unset(key);
  });

  model.once('saved', function(model, resp, options) {
    // If there aren't any relations to process exit and immediately commit the transaction
    if (_.isEmpty(relationships)) {
      if (options.transacting && !options.nested) options.transacting.commit();
      return;
    }

    var promises = [];

    _.forEach(relationships, function(data, key) {
      var relation = model.related(key);
      
      _.forEach(data, function(item) {
        if (item.id) {
          // Update any relations that already exist
          promises.push(relation.model.forge(item).save(null, nestOptions));
        } else {
          // Create an relations that are new
          promises.push(relation.create(item, nestOptions));
        }
      });
    });

    return Promise.all(promises)
      .then(function() {
        if (options.transacting) options.transacting.commit();
      })
      .catch(function(err) {
        if (options.transacting) options.transacting.rollback();
        throw err;
      });
  });
};

