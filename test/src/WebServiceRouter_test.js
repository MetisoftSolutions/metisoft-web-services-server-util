'use strict';

var _ = require('lodash');
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;
var should = chai.should();
var sinon = require('sinon');
var Promise = require('bluebird');

var WebServiceRouter = require('../../index.js').WebServiceRouter;



var AppMock = function() {
  this.__routes = {};
};

AppMock.prototype.post = function post(route, callback) {
  this.__routes[route] = callback;
};

AppMock.prototype.sendRequest = function sendRequest(route, req, res) {
  if (this.__routes[route]) {
    return this.__routes[route](req, res);
  } else {
    throw new Error("No route.");
  }
};

var ResMock = function(fnSendWasCalled) {
  this.__fnSendWasCalled = fnSendWasCalled;
};

ResMock.prototype.send = function send(data) {
  this.__fnSendWasCalled(data);
};



describe("WebServiceRouter suite", function() {

  describe("__removeLeadingAndTrailingSlashes() suite", function() {
    var testSet = [
          {
            str: 'some/slashes/',
            expected: 'some/slashes'
          },
          {
            str: 'something/else',
            expected: 'something/else'
          },
          {
            str: '',
            expected: ''
          },
          {
            str: 'noSlashes',
            expected: 'noSlashes'
          },
          {
            str: '/many/slashes///',
            expected: 'many/slashes'
          },
          {
            str: '///lots///more///slashes///////',
            expected: 'lots///more///slashes'
          }
        ];
        
    testSet.forEach(function(test) {
      it("should remove the slashes", function() {
        var actual = WebServiceRouter.__test.__removeLeadingAndTrailingSlashes(test.str);
        expect(actual).to.equal(test.expected);
      });
    });
  });
  
  
  
  describe("__makeRouteToService() suite", function() {
    var testSet = [
          {
            rootServiceRoute: 'services',
            modelName: 'Person',
            serviceName: 'findPeople',
            expected: '/services/Person/findPeople'
          },
          {
            rootServiceRoute: 'services/',
            modelName: 'Person/',
            serviceName: 'findPeople/',
            expected: '/services/Person/findPeople'
          },
          {
            rootServiceRoute: '',
            modelName: '',
            serviceName: '',
            expected: '///'
          }
        ];
    
    testSet.forEach(function(test) {
      it("should make the route string correctly", function() {
        var actual = WebServiceRouter.__test.__makeRouteToService(test.rootServiceRoute, test.modelName, test.serviceName);
        expect(actual).to.equal(test.expected);
      });
    });
  });
  
  
  
  describe("__getUserData() suite", function() {
    var testSet = [
          {
            req: {
              user: {
                id: '47',
                username: 'testUser47'
              },
              session: {
                company: {
                  id: '2',
                  name: 'Brawn Financial'
                }
              }
            },
            expected: {
              userId: '47',
              username: 'testUser47',
              session: {
                company: {
                  id: '2',
                  name: 'Brawn Financial'
                }
              }
            }
          },

          {
            req: {
              user: {
                id: '301',
                username: 'jbrawnjr'
              },
              session: {
                company: {
                  id: '987',
                  name: 'Metisoft, LLC'
                }
              }
            },
            expected: {
              userId: '301',
              username: 'jbrawnjr',
              session: {
                company: {
                  id: '987',
                  name: 'Metisoft, LLC'
                }
              }
            }
          }
        ];
        
    testSet.forEach(function(test) {
      it("should return the correct properties", function() {
        var actual = WebServiceRouter.__test.__getUserData(test.req);
        expect(actual).to.deep.equal(test.expected);
      });
    });
  });
  
  
  
  describe("__DI__setupRouteForService() suite", function() {
    var testSet = [
          { // #0
            options: {
              rootServiceRoute: 'services'
            },
            modelName: 'Person',
            funcName: 'findPeople',
            modelApi: {
              findPeople: function(userData, args) {
                return Promise.resolve({success: true});
              }
            },
            req: {
              body: {}
            },
            userIsLoggedIn: true,
            route: '/services/Person/findPeople',
            expected: {
              success: true
            }
          },
          
          { // #1
            options: {
              rootServiceRoute: 'whatever'
            },
            modelName: 'Property',
            funcName: 'findOne',
            modelApi: {
              findOne: function(userData, args) {
                return Promise.reject('ERROR');
              }
            },
            req: {
              body: {}
            },
            userIsLoggedIn: true,
            route: '/whatever/Property/findOne',
            expected: {
              __errors: 'ERROR'
            }
          },

          { // #2
            options: {
              rootServiceRoute: 'whatever'
            },
            modelName: 'Something',
            funcName: 'errorOut',
            modelApi: {
              errorOut: function(userData, args) {
                return Promise.resolve({})
                  .then(function() {
                    var err = new Error('SOME_ERROR');
                    err.__errorToSend = ['ERROR_CODE_1', 'ERROR_CODE_2'];
                    throw err;
                  });
              }
            },
            req: {
              body: {}
            },
            userIsLoggedIn: true,
            route: '/whatever/Something/errorOut',
            expected: {
              __errors: ['ERROR_CODE_1', 'ERROR_CODE_2']
            }
          }
        ];
    
    var app = new AppMock();
    
    testSet.forEach(function(test, index) {
      it("should set up the route properly", function(testDone) {
        
        var res = new ResMock(function(data) {
          expect(data).to.deep.equal(test.expected);
          testDone();
        });

        var options = _.cloneDeep(test.options);
        options.fnIsUserLoggedIn = function(req, func) {
          return test.userIsLoggedIn;
        };
        
        options.fnGetUserData = function (req) {
          return {};
        }
        
        WebServiceRouter.__test.__DI__setupRouteForService(
          options,
          WebServiceRouter.__test.__makeRouteToService,
          app,
          console,
          
          test.modelName,
          test.funcName,
          test.modelApi
        );
        
        console.log("Test case #" + index);
        app.sendRequest(test.route, test.req, res);
        
      });
    });
  });
  
  
  
  describe("__DI__createService() suite", function() {
    it("should set up a route for each service listed", function() {
      
      var app = new AppMock();
      
      var personApi = {
        findPeople: function () {},
        byId: function() {}
      };
      
      var propertyApi = {
        findProperties: function () {},
        byId: function () {}
      };
      
      var actualCallArgs = [];
      
      function setupRouteForService(modelName, funcName, modelApi) {
        actualCallArgs.push([modelName, funcName, modelApi]);
      }
      
      WebServiceRouter.__test.__DI__createService(app, setupRouteForService, 'Person', personApi);
      WebServiceRouter.__test.__DI__createService(app, setupRouteForService, 'Property', propertyApi);
      
      var expected = [
        ['Person', 'findPeople', personApi],
        ['Person', 'byId', personApi],
        ['Property', 'findProperties', propertyApi],
        ['Property', 'byId', propertyApi]
      ];
      
      expect(actualCallArgs).to.deep.equal(expected);
      
    });
  });
  
  
  
  describe("__DI__setupAllModelServices() suite", function() {
    it("should use the correct files to set up the services", function() {
      
      var modelPath = '';
      
      var fsMock = {
        readdirSync: function(path) {
          modelPath = path;
          // notice the .txt file and the directory (sql), which both shouldn't get processed
          return ['Person.js', 'Property.js', 'readme.txt', 'sql', 'Questionnaire.js', 'NoModelApi.js'];
        },
        statSync: function(pathToFile) {
          return {
            isFile: function() {
              return (pathToFile !== (modelPath + 'sql'));    // let's say that 'sql' is the only non-file
            }
          };
        }
      };
      
      var defaultApi = {
            someFunc: function() {}
          };
      
      var requireMock = function requireMock(pathToFile) {
        if (pathToFile === (modelPath + 'sql') ||
            pathToFile === (modelPath + 'readme.txt')) {
          expect(true).to.equal(false);
        
        } else if (pathToFile === (modelPath + 'NoModelApi.js')) {
          return {};
          
        } else {
          return {
            __exportsToClient: defaultApi
          };
        }
      };
      
      var actualCreateServiceArgs = [];      
      function createService(modelName, modelApi) {
        actualCreateServiceArgs.push([modelName, modelApi]);
      };
      
      var consoleMock = {
        log: sinon.spy(function(log) {})
      };
      
      WebServiceRouter.__test.__DI__setupAllModelServices(fsMock, requireMock, createService, {verbose: true}, consoleMock, 'services/');

      var expectedCreateServiceArgs = [
        ['Person', defaultApi],
        ['Property', defaultApi],
        ['Questionnaire', defaultApi],
      ];
      
      expect(actualCreateServiceArgs).to.deep.equal(expectedCreateServiceArgs);
      expect(consoleMock.log.calledOnce).to.be.true;
      
    });    
  });
  
});