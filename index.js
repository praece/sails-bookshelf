module.exports = function (sails) {
  var loader = require('sails-util-mvcsloader')(sails);
  var Promise = require('bluebird');
  var knex = require('knex')(sails.config.connection);
  var _ = require('lodash');
  var config = sails.config.models;
  var db = require('bookshelf')(knex)
    .plugin('bookshelf-relationships')
    .plugin('virtuals');

  var buildQuery = require('./lib/buildQuery');
  var bindRoutes = require('./lib/bindRoutes');
  var graph = require('./lib/graph');
  var populate = require('./lib/populate');
  var cleanQuery = require('./lib/cleanQuery');
  var save = require('./lib/save');

  function log(model, data, options) {
    // If query logging is on log the query
    if (sails.config.log.query) sails.log.debug(options.query.toString());
  }

  return {
    initialize: function(next) {
      var events = ['router:after', 'hook:policies:bound', 'hook:controllers:loaded'];

      // Bind shadow routes to our bookshelf models
      sails.after(events, bindRoutes);
      next();
    },

    configure: function () {
      sails.Collection = db.Collection.extend({
        initialize: function() {
          if (this.model.initializeCollection) this.model.initializeCollection(this);
          if (config.initializeCollection) config.initializeCollection(this);

          this.on('fetched', log);
          this.on('fetching', cleanQuery);
        },

        // A version of load that incorporates default where clauses
        populate: populate
      });

      // Set our collection to be the bookshelf collection
      db.Collection = sails.Collection;

      // Extend the bookshelf model
      sails.Model = db.Model.extend({
        // Add our timestamp and id column names
        hasTimestamps: ['createdAt', 'updatedAt'],
        idAttribute: 'id',
        
        // A shortcut method for saving with a transaction
        saveGraph: graph,

        // A version of load that incorporates default where clauses
        populate: populate,
        save: save,

        initialize: function() {
          // Add any initialize functions for all models or specific models
          if (config.initialize) config.initialize(this);
          if (this.constructor.initialize) this.constructor.initialize(this);
          
          // Add our hooks on actions
          this.on('fetching saved destroyed', log);
          this.on('fetching', cleanQuery);
        }
      }, {
        // Add a helper function for building queries
        buildQuery: buildQuery.buildQuery,
      });

      // Set our blueprint path and add bookshelf to the sails object
      sails.config.paths.blueprints = __dirname + '/blueprints';
      sails.db = db;
    }
  };
};