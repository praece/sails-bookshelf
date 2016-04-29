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
  var fakeInstance = new Model();

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
    var table = fakeInstance.tableName;

    // Apply join if necessary
    if (_.includes(field, '.')) {
      var relations = _.split(field, '.');
      table = applyJoin(_.initial(relations), new Model());
      field = _.last(relations);
    }

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

  function applyJoin(relations, model) {
    var relation = model[_.head(relations)]();
    var type = relation.relatedData.type;

    if (!_.includes(['hasOne', 'belongsTo', 'morphOne'], type)) {
      var err = new Error('You can only query hasOne, belongsTo or morphOne relations!');
      throw err;
    }

    var table = relation.relatedData.targetTableName;
    var key = relation.relatedData.targetIdAttribute;
    var foreignKey = relation.relatedData.foreignKey;
    var parentTable = relation.relatedData.parentTableName;
    var childColumn = table + '.' + key;
    var parentColumn = parentTable + '.' + foreignKey;

    qb.join.bind(qb)(table, childColumn, '=', parentColumn);

    relations = _.tail(relations);

    if (!_.isEmpty(relations)) {
      return applyJoin(relations, new relation.relatedData.target());
    }

    return table;
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

