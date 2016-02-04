module.exports = function (sails) {
  var loader = require('sails-util-mvcsloader')(sails);
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
          this.initSails();
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