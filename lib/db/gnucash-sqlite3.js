var _ = require('underscore'),
    async = require('async'),
    sqlite3 = require('sqlite3'),
    moment = require('moment');

var DB = function(filename) {
  var db = new sqlite3.Database(filename);

  return {
    query: function(queryStr, cb) {
      var rows = [];

      db.each(
        queryStr, 
        function(err, row) {
          rows.push(row);
        }, function(err, num) {
          cb(err, rows);
        });
    }, disconnect: function() {
      db.close();
    }
  };
};

function isExpense(acct) {
  if (!acct) {
    return false;
  }
  if (acct.name.toLowerCase() === 'expenses') {
    return true;
  }
  return isExpense(acct.parent);
} 

var AccountsDAO = function(db) {
  return {
    use: function(fn) {
      var queryStr = 'SELECT guid, parent_guid, name from accounts';
      db.query(queryStr, function(err, accts) {
        var toAcct,
        l,
        map = {};

      _.each(accts, function(a) { map[a.guid] = a; });

      toAcct = function(acct) {
        if (acct.parent_guid) {
          acct.parent = toAcct(map[acct.parent_guid]);
        }
        acct.isExpense = isExpense(acct);
        acct.qualifiedName = acct.name;
        if (acct.parent) {
          acct.qualifiedName = acct.parent.qualifiedName + ':' + acct.name;
        } else {
          acct.qualifiedName = acct.name;
        }
        return acct;
      };

      l = _.map(accts, function(a) { return toAcct(a); });
      fn(l);
      });
    },

  };
};

var dateFmt = function(d) {
  var monthStr,
      month = d.month() + 1;

  if (month < 10) {
    monthStr = '0' + month;
  } else {
    monthStr = month + '';
  }

  return d.year() + '-' + monthStr + '-01';
}

var TransactionsDAO = function(db) {
  return {
    use: function(since, until, fn) {
      var trans,
          transIds = [],
          transQuery = "SELECT guid, post_date, description " +
            "from transactions " +
            "where post_date >= '" + dateFmt(since) + "' " +
            "and post_date < '" + dateFmt(until) + "' " +
            "order by post_date desc";

      db.query(transQuery, function(err, tranRecs) {
        if (tranRecs.length === 0) {
          fn([]);
          return;
        }
        var splitsQuery = function(tranIds) {
          var quotedIds = _.map(tranIds, function(id) { 
            return "'" + id + "'"; 
          });
          return 'select tx_guid, account_guid, memo, value_num from splits where tx_guid in (' +
            quotedIds.join(',') + ')';
        };

        transIds = _.map(tranRecs, function(t) { return t.guid; });

        db.query(splitsQuery(transIds), function(err, splits) {
          var splitsMap = _.groupBy(splits, function(s) {
            return s.tx_guid;
          });
          trans = _.map(tranRecs, function(t) {
            // not sure how I feel about this...
            t.post_date = moment(t.post_date, 'YYYYMMDDHHssSSS').toDate();
            return {
              transaction: t,
              splits: _.map(splitsMap[t.guid], function(tranSplit) {
                tranSplit.date = t.post_date;
                tranSplit.description = t.description;
                return tranSplit;
              })
            };
          });
          fn(trans);
        });
      });
    }
  };
};

/*
var aDb = DB('finances.gnucash');
var results = aDb.query('select * from accounts', function(err, rows) {
  _.each(rows, function(r) { console.log(r); });
  aDb.disconnect();
});

var dao = AccountsDAO(aDb).use(function(accts) {
  _.each(accts, function(acct) { console.log(acct.name); });
  aDb.disconnect();
});
*/

module.exports = {
  DB: DB,
  AccountsDAO: AccountsDAO,
  TransactionsDAO: TransactionsDAO
};
