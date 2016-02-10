module.exports = function (sails) {
  var loader = require('sails-util-mvcsloader')(sails);
  var Promise = require('bluebird');
  var knex = require('knex')(sails.config.connection);
  var bookshelfScopes = require('bookshelf-scopes');
  var db = require('bookshelf')(knex)
    .plugin('bookshelf-relationships')
    .plugin(bookshelfScopes);

  var defaultValues = require('./lib/defaultValues');
  var strongParameters = require('./lib/strongParameters');
  var validation = require('./lib/validation');
  var nestedSave = require('./lib/nestedSave');
  var buildQuery = require('./lib/buildQuery');
  var bindRoutes = require('./lib/bindRoutes');

  return {
    initialize: function(next) {
      var events = ['router:after', 'hook:policies:bound', 'hook:controllers:loaded'];

      sails.after(events, bindRoutes);
      next();
    },

    configure: function () {
      var Model = db.Model.extend({
        hasTimestamps: ['createdAt', 'updatedAt'],
        idAttribute: 'id',
        initSails: function() {
          this.addScope();
          this.on('creating', defaultValues);
          this.on('saving', validation);
          this.on('saving', nestedSave);
          this.on('saving', strongParameters);
        },
        initialize: function() {
          if (sails.config.models.initialize) sails.config.models.initialize(this);
          if (this.constructor.initialize) this.constructor.initialize(this);
          this.initSails();
        },
        saveTransaction: function(data, options) {
          var model = this;
          data = data || null;
          options = options || {};

          return new Promise(function(resolve, reject) {
            db.transaction(function(t) {
              options.transacting = t;
              model.save(data, options).then(resolve, reject);
            }).catch(_.noop);
          });
        }
      }, {
        buildQuery: buildQuery
      });

      sails.config.paths.blueprints = __dirname + '/blueprints';
      sails.db = db;
      sails.Model = Model;
    }
  };
};