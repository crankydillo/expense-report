var should = require("should"),
    moment = require("moment"),
    _ = require("underscore"),
    trans = require("../transaction"),
    expByMonth = [
        {
            name: "Root Account:Expenses:Gifts",
            months: [
                {
                    month: "2014-02",
                    sum: 45767
                }, {
                    month: "2014-01",
                    sum: 115096
                }, {
                    month: "2013-12",
                    sum: 294694
                }
            ]
        }, {
            name: "Root Account:Expenses:Dining",
            months: [
                {
                    month: "2014-02",
                    sum: 45767
                }, {
                    month: "2013-12",
                    sum: 294694
                }
            ]
        }
    ];

describe("The fillEmptyMonths method", function() {

  it("should do something", function(done) {
    var dt = function(str) { return moment(str, "YYYY-MM"); },
    since = dt("2013-11"),
    until = dt("2014-03"),
    filled = trans.fillEmptyMonths(since, until, expByMonth);

    _.each(filled, function(exp) {
      exp.months.should.have.length(4);
    });
    done();
  });
});
