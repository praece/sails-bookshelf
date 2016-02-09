var _ = require('lodash');
var Promise = require('bluebird');

module.exports = function nestedSave(model, attrs, options) {
  var relationships = {};

  _.forEach(model.relationships, function(relationship, key) {
    var attr = model.attributes[key];

    // If the attribute is undefined or primitive just return so it can be saved
    if (_.isUndefined(attr) || !_.isObject(attr)) return;

    // If the relation is an array grab it so we can save the nested relations
    if (_.isArray(attr)) relationships[key] = _.clone(attr);
  
    // Remove all non-primitives from the object we are saving, we don't want those in the database
    model.unset(key);
  });

  if (!_.isEmpty(relationships)) {
    model.once('saved', function(model) {
      var promises = [];

      _.forEach(relationships, function(data, key) {
        var relation = model.related(key);
        
        _.forEach(data, function(item) {
          if (item.id) {
            promises.push(relation.model.forge(item).save(null, {transacting: options.transacting}));
          } else {
            promises.push(relation.create(item, {transacting: options.transacting}));
          }
        });
      });

      return Promise.all(promises)
        .then(options.transacting.commit)
        .catch(function(err) {
          options.transacting.rollback();
          throw err;
        });
    });
  }
};

