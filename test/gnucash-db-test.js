var should = require("should");
var _ = require("underscore");
var db = require("../gnucash-db");

describe("Account DAO", function() {

    before(function() {
        console.log("I'm before!");
    });

    it("should create a parent object representing an accounts ancestry", function(done) {
        var gnucashDB = {
            query: function(queryStr, fn) {
                fn([mkAcct(1, null, "root"),
                    mkAcct(2, 1, "child1"),
                    mkAcct(3, null, "parentless"),
                    mkAcct(4, 2, "grandchild1"),
                    mkAcct(5, 2, "grandchild2")]);
            }
        }, accountsDao = db.AccountsDAO(gnucashDB);

        accountsDao.use(function(accts) {
            accts.should.have.length(5);
            var parentless = _.find(accts, function(a) {
                return a.name === "parentless";
            }), gc2 =  _.find(accts, function(a) {
                return a.name === "grandchild2";
            });

            should.exist(parentless);
            parentless.should.not.have.property("parent");

            should.exist(gc2);
            gc2.should.have.property("parent");
            gc2.parent.name.should.equal("child1");
            gc2.parent.should.have.property("parent");
            gc2.parent.parent.name.should.equal("root");

            done();
        });
    });
});

function mkAcct(guid, parentGuid, name) {
    return {
        guid: guid,
        parent_guid: parentGuid,
        name: name
    };
}
