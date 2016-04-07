'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var graphSave = require('./graphSave');
var validation = require('./validation');
var strongParameters = require('./strongParameters');
var defaultValues = require('./defaultValues');

module.exports = function save(attrs, options = {}) {
  let sync;
  let response;

  return Promise.resolve(this.saveMethod(options))
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
      if (!options.graph) return;
      return graphSave.setup(model, options);
    })
    .tap(model => {
      if (options.method !== 'insert') return;
      return defaultValues(this);
    })
    .tap(model => {
      // Gives access to the `query` object in the `options`, in case we need it
      // in any event handlers.
      sync = this.sync(options);
      options.query = sync.query;

      const events = options.method === 'insert' ? 'creating saving' : 'updating saving';
      return this.triggerThen(events, this, attrs, options);
    })
    .tap(model => strongParameters(model))
    .tap(model => validation(model, options))
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

      // In case we need to reference the `previousAttributes` for the this
      // in the following event handlers.
      options.previousAttributes = this._previousAttributes;

      this._reset();

      return this;
    })
    .tap(model => {
      if (!options.graph) return;
      return graphSave.save(model, options);
    })
    .then(model => {
      if (options.autoCommit && !options.nested) {
        delete options.autoCommit;
        delete options.transacting;
      }

      if (!model) return model;

      var id = model.id;
      var fetchOptions = {};
      if (options.transacting) fetchOptions.transacting = options.transacting;

      return model.clear().set('id', id).fetch(fetchOptions);
    })
    .tap(model => {
      const events = options.method === 'insert' ? 'created saved' : 'updated saved';
      return this.triggerThen(events, model, response, options);
    })
    .tap(model => {
      return model;
    });
};