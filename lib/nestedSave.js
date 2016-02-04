var _ = require('lodash');
var Promise = require('bluebird');

module.exports = function nestedSave(model, attrs, options) {
  var relationships = {};

  _.forEach(model.relationships, function(relationship, key) {
    if (!model.attributes[key] || !_.isArray(model.attributes[key])) return;

    relationships[key] = _.clone(model.attributes[key]);
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

