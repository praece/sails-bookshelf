var _ = require('lodash');
var Promise = require('bluebird');

module.exports = {
  setup,
  save
};

function setup(model, options) {
  if (!options.graph) return;

  options.graphData = {};

  _.forEach(model.relationships, function(relationship, key) {
    var attr = model.attributes[key];

    // If the attribute is undefined or primitive just return so it can be saved
    if (_.isUndefined(attr) || !_.isObject(attr)) return;

    // If the relation is an array grab it so we can save the nested relations
    if (_.isArray(attr)) options.graphData[key] = _.clone(attr);
    if (_.isPlainObject(attr)) options.graphData[key] = _.clone(attr);
  
    // Remove all non-primitives from the object we are saving, we don't want those in the database
    model.unset(key);
  });

  return new Promise((resolve, reject) => {
    if (!options.nested && !options.transacting) {
      sails.db.transaction((t) => {
        options.transacting = t;
        options.autoCommit = true;
        resolve();
      }).catch(_.noop);
    } else {
      resolve();
    }
  })
    .then(function() {
      return model.triggerThen('savingnested', model, options.graphData, options);
    })
    .then(function() {
      const promises = [];

      _.forEach(options.graphData, function(data, key) {
        var relation = model[key]();
        
        var nestOptions = { nested: options.nested || {}, graph: true };
        nestOptions.nested[model.tableName] = options.method;
        if (options.transacting) nestOptions.transacting = options.transacting;

        if (relation.relatedData.type === 'belongsTo') {
          const nestedModel = relation.set(data);
          promises.push(nestedModel.save(null, nestOptions)
            .then(function(saved) {
              model.set(key, saved.id);
            })
          );
        }
      });

      return Promise.all(promises);
    });
}

function save(model, options) {
  const shouldCommit = options.transacting && !options.nested && options.autoCommit;

  // If there aren't any relations to process exit and immediately commit the transaction
  if (_.isEmpty(options.graphData) && shouldCommit) return options.transacting.commit();

  var promises = [];

  _.forEach(options.graphData, function(data, key) {
    var relation = model[key]();

    if (_.includes(['morphMany', 'hasMany', 'belongsToMany'], relation.relatedData.type)) {
      _.forEach(data, function(item) {
        var nestOptions = { nested: options.nested || {}, graph: true };
        nestOptions.nested[model.tableName] = options.method;
        if (options.transacting) nestOptions.transacting = options.transacting;
        if (options.autoCommit) nestOptions.autoCommit = options.autoCommit;

        promises.push(relation.create(item, nestOptions));
      });
    }
  });

  return Promise.all(promises)
    .tap(function() {
      if (shouldCommit) return options.transacting.commit();
    })
    .then(function(output) {
      return model.triggerThen('savednested', model, options.graphData, options);
    })
    .catch(function(err) {
      if (shouldCommit) return options.transacting.rollback().throw(err);
      throw err;
    });
}
