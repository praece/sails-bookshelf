var _ = require('lodash');

module.exports = {buildQuery, applyQuery};

function buildQuery(params) {
  var Model = this;
  params = params || {};
  params.where = _.defaults(params.where || {}, this.defaultWhere);

  return this.query(function(qb) {
    applyQuery(qb, params, false, Model);
  });
}

function applyQuery(qb, params, includeTable, Model) {
  var model = new Model();
  var joins = [];

  model.trigger('buildingQuery', model, params, qb);

  buildWhere(qb, params.where, []);
  if (params.sort) buildSort(qb, params.sort);
  if (params.limit) qb.limit(params.limit);
  if (params.offset) qb.offset(params.offset);

  function buildWhere(qb, where, modifiers, field) {
    _.forEach(where, function(criteria, operator) {
      var mods = modifiers.slice();

      // If this is an "or" or "and" clause create a nested where
      if (operator === 'or' || operator === 'and') return qb.where(function() {buildWhere(this, criteria, operator === 'or' ? ['or'] : []);});
      
      // Negative clauses
      if (operator === 'not' || operator === '!') {
        mods = mods.concat('not');
        operator = false;
      }
        
      // Specific nested custom operator
      if (_.isPlainObject(criteria)) return buildWhere(qb, criteria, mods, field || operator);

      // Apply the filter
      applyWhere(qb, mods, field || operator, criteria, field && operator);
    });
  }

  function applyWhere(qb, modifiers, field, value, operator) {
    var method = 'where';
    var table = model.tableName;
    var instance = model;

    // Apply join if necessary
    if (_.includes(field, '.')) {
      var relations = _.split(field, '.');
      instance = applyJoin(_.initial(relations), instance);
      table = instance.tableName;
      field = _.last(relations);
    }

    var allowedFields = _.keys(instance.constructor.attributes)
      .concat(_.keys(instance.relationships))
      .concat(['updatedAt', 'createdAt', 'id']);

    // We're trying to filter on a field that doesn't exist assume it is custom
    if (!_.includes(allowedFields, field)) {
      if (!instance.customWhere || !instance.customWhere[field]) {
        throw new Error(`No custom where function exists for ${table}.${field}`);
      }

      return instance.customWhere[field].call(qb, value, operator, modifiers, field);
    };

    // Or and not modifiers
    _.forEach(modifiers, function(mod) {
      if (mod === 'or') method = 'or-' + method;
      if (mod === 'not') method = method + '-not';
    });

    // In operator
    if (operator === 'in' || _.isArray(value)) {
      method = method + '-in';
      operator = false;
    }

    // Null checking
    if ((value === '' || value === null) && (!operator || operator === 'is')) {
      method = method + '-null';
      operator = false;
    }

    // Special cases for contains, starts with, ends with
    if (_.includes(['contains', 'startsWith', 'endsWith'], operator)) {
      if (operator === 'contains') value = '%' + value + '%';
      if (operator === 'startsWith') value = value + '%';
      if (operator === 'endsWith') value = ' %' + value;
      operator = 'ilike';
    }

    // Camel case the method name and bind it to the query builder
    method = qb[_.camelCase(method)].bind(qb);

    // If there is no operator let where guess it based on the field or value
    if (!operator) return method(table + '.' + field, value);

    return method(table + '.' + field, operator, value);
  }

  function applyJoin(relations, instance) {
    var relation = instance[_.head(relations)]().relatedData;
    var relationInstance = new relation.target();
    var has = _.includes(['hasOne', 'hasMany', 'morphOne', 'morphMany'], relation.type);
    var morph = _.includes(['morphTo', 'morphMany', 'morphOne'], relation.type);

    // Grab the matching parameters
    var table = relation.targetTableName;
    var parentTable = relation.parentTableName;
    var key = relation.targetIdAttribute;
    var foreignKey = morph ? relation.columnNames[1] : relation.foreignKey;

    // Handle has versus belongsTo styles
    var childColumn = table + '.' + (has ? foreignKey : key);
    var parentColumn = parentTable + '.' + (has ? key : foreignKey);

    if (!_.includes(joins, table)) {
      joins.push(table);
      qb.join.bind(qb)(table, childColumn, '=', parentColumn);

      // Add the model logic for a polymorphic association
      if (morph) {
        var morphKey = relation.columnNames[0];
        var morphColumn = table + '.' + morphKey;
        qb.where.bind(qb)(morphColumn, '=', parentTable);
      }
    }

    relations = _.tail(relations);

    // Handle nested relations
    if (!_.isEmpty(relations)) {
      return applyJoin(relations, relationInstance);
    }

    return relationInstance;
  }  

  function buildSort(qb, sort) {
    // Check if we have an array or just a single sort param
    if (_.isArray(sort)) {
      _.forEach(sort, function(sort) {
        applySort(qb, sort);
      });
    } else {
      applySort(qb, sort);
    }
  }

  function applySort(qb, sort) {
    // Parse sort strings that include direction
    var sort = sort.split(' ');
    qb.orderBy.bind(qb)(sort[0], sort[1])
  }
}

