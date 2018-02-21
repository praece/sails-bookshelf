var Promise = require('bluebird');

function cacheFields(model, response, options, triggerSave) {
  return Promise.resolve()
    .then(() => {
      if (!model.cacheFields) return;

      return Promise.resolve(model.cacheFields(model, response, options))
        .then(fields => {
          // If the fields haven't changed don't resync
          if (model.set(fields).hasChanged()) {
            if (triggerSave) model.save();

            return model.sync(options).update(fields);
          }
        });
    })
    .then(() => {
      if (!model.triggerCachedFields) return;

      return Promise.mapSeries(model.triggerCachedFields, field => {
        // No need to do this if it is already nested on the other model, as it
        // will be updated automatically when the parent is saved
        const isNested = options.nested && options.nested[field];
        const hasField = model.get(field);

        if (isNested || !hasField) return;

        const opts = _.assign({ method: 'update', patch: true }, _.pick(options, ['transacting', 'currentUser']));

        return Promise.resolve(model)
          .call('clone')
          .call(field)
          .call('fetch', opts)
          .then(related => {
            if (!related || !related.cacheFields) return;

            return cacheFields(related, related.toJSON(), opts, true);
          });
      });
    });
}

module.exports = cacheFields;
