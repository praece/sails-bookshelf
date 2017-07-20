'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var graphSave = require('./graphSave');
var validation = require('./validation');
var strongParameters = require('./strongParameters');
var defaultValues = require('./defaultValues');
var convertJSONB = require('./convertJSONB');
var cacheFields = require('./cacheFields');
var Helpers = require('bookshelf/src/helpers');

module.exports = function save(attrs, options = {}) {
  let sync;
  let response;
  let autoCommit;

  return Promise.resolve()
    .then(() => {
      if (options.transacting) return;

      return new Promise(resolve => sails.db.transaction(resolve).catch(_.noop))
        .then(t => {
          options.transacting = t;
          autoCommit = true;

          if (sails.config.testing) options.transacting.debug = true;
        });
    })
    .then(() => this.saveMethod(options))
    .tap(method => {
      // If this is an update from a fresh model refresh to get a proper set of previous attributes
      if (method === 'update' && this.hasChanged('id')) {
        const cacheAttrs = this.toJSON();

        return this.constructor.where({ id: cacheAttrs.id })
          .fetch(_.pick(options, ['transacting']))
          .then(synced => {
            this.clear().set(synced.toJSON())._reset().set(cacheAttrs);
          });
      }
    })
    .tap(method => {
      if (method !== 'insert') return;
      return defaultValues(this);
    })
    .then(method => {
      // Determine whether which kind of save we will do, update or insert.
      options.method = method

      // If the object is being created, we merge any defaults here rather than
      // during object creation.
      if (method === 'insert' || options.defaults) {
        const defaults = _.result(this, 'defaults');
        if (defaults) {
          attrs = _.extend({}, defaults, this.attributes, attrs);
        }
      }

      // Set the attributes on the model. Note that we do this before adding
      // timestamps, as `timestamp` calls `set` internally.
      this.set(attrs, {silent: true});

      // Add what has changed to options so we can see it in later events.
      options.changed = _.cloneDeep(this.changed);

      // Now set timestamps if appropriate. Extend `attrs` so that the
      // timestamps will be provided for a patch operation.
      if (this.hasTimestamps) {
        _.extend(attrs, this.timestamp(_.extend(options, {silent: true})));
      }

      // If there are any save constraints, set them on the model.
      if (this.relatedData && this.relatedData.type !== 'morphTo') {
        Helpers.saveConstraints(this, this.relatedData);
      }

      return this;
    })
    .tap(model => {
      // Gives access to the `query` object in the `options`, in case we need it
      // in any event handlers.
      sync = this.sync(options);
      options.query = sync.query;

      const events = options.method === 'insert' ? 'creating saving' : 'updating saving';
      return this.triggerThen(events, this, attrs, options);
    })
    .tap(model => {
      // Update options.changed for any changes that were made during saving events
      options.changed = _.cloneDeep(this.changed);

      if (!options.graph) return;
      return graphSave.setup(model, options);
    })
    .tap(model => strongParameters(model))
    .tap(model => validation(model, options))
    .tap(model => convertJSONB(model))
    .then(model => {
      return sync[options.method](options.method === 'update' && options.patch ? attrs : this.attributes);
    })
    .then(resp => {
      response = resp;

      // After a successful database save, the id is updated if the model was created
      if (options.method === 'insert' && this.id == null) {
        const updatedCols = {};
        updatedCols[this.idAttribute] = this.id = resp[0];
        const updatedAttrs = this.parse(updatedCols);
        _.assign(this.attributes, updatedAttrs);
      } else if (options.method === 'update' && resp === 0) {
        if (options.require !== false) {
          throw new this.constructor.NoRowsUpdatedError('No Rows Updated');
        }
      }

      return this;
    })
    .tap(model => {
      if (!options.graph) return;
      return graphSave.save(model, options);
    })
    .then(model => {
      if (!model) return model;

      var id = model.id;
      var Model = model.constructor;

      // We have to make sure we have all keys before we send this back or it can't be safely
      // loaded after being saved, so fetch here and set missing keys
      return Model.forge({ id }).fetch({ transacting: options.transacting })
        .then(fetched => {
          const currentKeys = _.keys(model.toJSON());
          const toSet = _.omit(fetched.toJSON(), currentKeys);
          return model.set(toSet);
        });
    })
    .tap(model => {
      if (!model) return model;

      return cacheFields(model, response, options)
    })
    .tap(model => {
      if (!autoCommit) return;

      return options.transacting.commit()
        .then(() => {
          delete options.transacting;
        });
    })
    .catch(error => {
      if (!autoCommit) throw error;

      return options.transacting.rollback()
        .then(() => {
          delete options.transacting;
        })
        .throw(error);
    })
    .tap(model => {
      // In case we need to reference the `previousAttributes` for the this
      // in the following event handlers.
      options.previousAttributes = this._previousAttributes;

      this._reset();

      const events = options.method === 'insert' ? 'created saved' : 'updated saved';
      return this.triggerThen(events, model, response, options);
    })
    .tap(model => {
      return model;
    });
};