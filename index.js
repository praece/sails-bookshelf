module.exports = function (sails) {
  var loader = require('sails-util-mvcsloader')(sails);
  var Promise = require('bluebird');
  var knex = require('knex')(sails.config.connection);
  var db = require('bookshelf')(knex)
    .plugin('bookshelf-relationships');

  var defaultValues = require('./lib/defaultValues');
  var strongParameters = require('./lib/strongParameters');
  var validation = require('./lib/validation');
  var nestedSave = require('./lib/nestedSave');
  var buildQuery = require('./lib/buildQuery');
  var bindRoutes = require('./lib/bindRoutes');
  var transaction = require('./lib/transaction');

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
      // Extend the bookshelf model
      sails.Model = db.Model.extend({
        // Add our timestamp and id column names
        hasTimestamps: ['createdAt', 'updatedAt'],
        idAttribute: 'id',
        
        // A shortcut method for saving with a transaction
        saveTransaction: transaction,

        initialize: function() {
          // Add any initialize functions for all models or specific models
          if (sails.config.models.initialize) sails.config.models.initialize(this);
          if (this.constructor.initialize) this.constructor.initialize(this);
          
          // Add our hooks on actions
          this.on('fetching saved destroyed', log);
          this.on('creating', defaultValues);
          this.on('saving', validation);
          this.on('saving', nestedSave);
          this.on('saving', strongParameters);
        }
      }, {
        // Add a helper function for building queries
        buildQuery: buildQuery,

        // Add our own collection shortcut that logs queries
        collection: function(models, options) {
          var collection = db.Model.collection.bind(this)(models, options);
          collection.on('fetched', log);

          return collection;
        }
      });

      // Set our blueprint path and add bookshelf to the sails object
      sails.config.paths.blueprints = __dirname + '/blueprints';
      sails.db = db;
    }
  };
};