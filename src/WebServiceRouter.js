'use strict';
var _ = require('lodash');
var fs = require('fs');
var sprintf = require('sprintf-js').sprintf;

var ModuleExporter = require('metisoft-module-exporter').ModuleExporter;
var m = new ModuleExporter;



/**
 * @callback WebServiceRouter~fnIsUserLoggedIn
 *
 * @param {ExpressRequest} req
 *    It is assumed that a middleware earlier in the stack has added data to the
 *    request object for the logged in user.
 *
 * @param {Function} serviceHandler
 *    Some service handlers have properties attached to them that might affect how
 *    the login requirements are enforced.
 *
 *    For instance, imagine a site that allows a user to log in to a user account
 *    and additionally to one or more companies that the user belongs to. Some service
 *    handlers might want to require that the user is logged in and has selected
 *    a company, whereas other handlers might only require that the user is logged
 *    in, without regard for a company selection. To support this, one might set
 *    `serviceHandler.__requiresCompanyLogin = true` in the handler, and then this
 *    callback can check for that property.
 *
 * @returns {Boolean}
 */

/**
 * @callback WebServiceRouter~fnGetUserData
 *
 * @param {ExpressRequest} req
 *    It is assumed that a middleware earlier in the stack has added data to the
 *    request object for the logged in user.
 *
 * @returns {Object}
 *    Return an object that contains the user data that you want handed into service
 *    handlers.
 */

/**
 * @typedef ConfigObject
 * @type Object
 * @memberof WebServiceRouter
 *
 * @property {Boolean} verbose
 *    If `true`, messages will be output to the console when certain events occur.
 *    Default: `false`.
 *
 * @property {String} rootServiceRoute
 *    The root route where services will be added.
 *    Default: `'/services'`.
 *
 * @property {WebServiceRouter~fnIsUserLoggedIn} fnIsUserLoggedIn
 *    Pass in a function that will determine whether the user is considered to be
 *    logged in.
 *
 * @property {WebServiceRouter~fnGetUserData} fnGetUserData
 *    Pass in a function that will extract user data from the request object. The
 *    returned object will get passed as an argument to the `userData` parameter
 *    in the service handler.
 */
const DEFAULT_OPTIONS = {
  verbose: false,
  rootServiceRoute: '/services',
  fnIsUserLoggedIn: __isUserLoggedIn,
  fnGetUserData: __getUserData
};



/**
 * Returns `true` if the request object has data that indicates that the user has
 * logged in.
 *
 * @private
 * @memberof WebServiceRouter
 *
 * @param {ExpressReq} req
 * @returns {Boolean}
 */
function __isUserLoggedIn(req) {
  return !!(req.user &&
            req.user.username);
}
m.$$private(__isUserLoggedIn);



/**
 * @namespace WebServiceRouter
 * @class
 * @classdesc A `WebServiceRouter` is used to find all model methods within your
 *    model files and expose them as web services to the client. A server
 *    route will be established for each method found. Once configured,
 *    the `WebServiceRouter` runs once at server startup and will grab and
 *    process all model files within a given directory without any extra
 *    setup on the part of the models themselves, aside from marking methods
 *    for export to the client.
 *
 * @public
 *
 * @param {Express} app
 *    An Express app instance.
 *
 * @param {WebServiceRouter~ConfigObject} configOptions
 *    Configuration options. See also `config()`.
 */
function WebServiceRouter(app, configOptions) {
  if (!app) throw new Error("Express app required.");
  
  this.__app = app;
  this.__options = _.cloneDeep(DEFAULT_OPTIONS);
  
  if (configOptions) {
    this.config(_.cloneDeep(configOptions));
  }
}
m.$$class(WebServiceRouter);



/**
 * Configures the module before use. Only specified options will overwrite previously
 * set values.
 *
 * @public
 *
 * @param {WebServiceRouter~ConfigObject} options
 *    Configuration options.
 */
WebServiceRouter.prototype.config = function config(options) {
  if (options) {
    this.__options = _.assignIn(this.__options, options);
  }
};



/**
 * Removes all trailing and leading slashes from the given string.
 *
 * @private
 * @memberof WebServiceRouter
 *
 * @param {String} str
 * @returns {String}
 */
function __removeLeadingAndTrailingSlashes(str) {
  while (str.length > 0 && str.slice(-1) === '/') {
    str = str.slice(0, -1);
  }

  while (str.length > 0 && str[0] === '/') {
    str = str.slice(1);
  }

  return str;
}
m.$$private(__removeLeadingAndTrailingSlashes);



/**
 * Given a root service route, model name, and service name, this function
 * will return the route string to use for that service.
 *
 * *Example:* For `rootServiceRoute` set to `services`, `modelName` set to
 * `'Person'`, and `serviceName` set to `'findPeople'`, and assuming default
 * configuration, this function would return `'/services/Person/findPeople'`.
 *
 * @private
 * @memberof WebServiceRouter
 *
 * @param {String} rootServiceRoute
 * @param {String} modelName
 * @param {String} serviceName
 * @returns {String}
 */
function __makeRouteToService(rootServiceRoute, modelName, serviceName) {
  var pieces = [
    rootServiceRoute,
    modelName,
    serviceName
  ];
  
  pieces = pieces.map(__removeLeadingAndTrailingSlashes);  
  return '/' + pieces.join('/');
}
m.$$private(__makeRouteToService);



/**
 * Objects of this type are passed into service handlers so that they have context about
 * the user session.
 *
 * @typedef UserData
 * @type Object
 * @memberof WebServiceRouter
 *
 * @property {String} userId
 * @property {String} username
 *
 * @property {ExpressSession} session
 *    A reference to the current session.
 */
 
/**
 * Given a request object handed down from Express middleware, this function retrieves
 * the data about the user. If a session is active, it is saved to `userData.session`.
 *
 * @private
 * @memberof WebServiceRouter
 * @param {ExpressReq} req
 *
 * @returns {WebServiceRouter~UserData}
 */
function __getUserData(req) {
  var userData = {};

  userData.userId = req.user.id;
  userData.username = req.user.username;

  if (req.session) {
    userData.session = req.session;
  }

  return userData;
}
m.$$private(__getUserData);



/**
 * Dependency-injected version of `setupRouteForService()`.
 *
 * @memberof WebServiceRouter
 * @private
 * @param {WebServiceRouter~ConfigObject} options
 * @param {Function} makeRouteToService
 * @param {Express} app
 * @param {console} console
 * @param {String} modelName
 * @param {String} funcName
 * @param {Object} modelApi
 */
function __DI__setupRouteForService(options, makeRouteToService, app, console, modelName, funcName, modelApi) {
  var func = modelApi[funcName],
      route,
      verbose = options.verbose,
      fnIsLoggedIn,
      fnGetUserData,
      requiresUserLogin = true;

  if (_.isBoolean(func.__requiresUserLogin)) {
    requiresUserLogin = func.__requiresUserLogin;
  }

  if (requiresUserLogin && options.fnIsUserLoggedIn && _.isFunction(options.fnIsUserLoggedIn)) {
    fnIsLoggedIn = options.fnIsUserLoggedIn;
  } else {
    fnIsLoggedIn = function loginCheckPassThrough() {
      return true;
    };
  }

  if (options.fnGetUserData && _.isFunction(options.fnGetUserData)) {
    fnGetUserData = options.fnGetUserData;
  } else {
    fnGetUserData = __getUserData;
  }

  if (func && _.isFunction(func)) {
    route = makeRouteToService(options.rootServiceRoute, modelName, funcName);

    app.post(route, function(req, res) {
      if (!fnIsLoggedIn(req, func)) {
        res.send({});
        return;
      }

      if (verbose) {
        console.log(sprintf('Service "%s" being called; invoking %s.%s', route, modelName, func.name));
      }

      func(fnGetUserData(req), req.body)

        .then(function(retObj) {
          res.send(retObj);
        })

        .catch(function(err) {
          var errorToSend;

          if (err.hasOwnProperty('__errorToSend')) {
            errorToSend = err.__errorToSend;
          } else {
            errorToSend = err;
          }

          res.send({
            __errors: errorToSend
          });

          if (verbose) {
            console.log(err);
            console.log(err.stack);
          }
        });
    });

    if (verbose) {
      console.log(sprintf('\tService for %s set up at %s to point to %s().', modelName, route, func.name));
    }
  }
}
m.$$private(__DI__setupRouteForService);



/**
 * Sets up a route to point to a service.
 *
 * @private
 * @param {String} modelName
 * @param {String} funcName -
 *            The name of the function to call on the model when the service
 *            is invoked.
 * @param {Object} modelApi -
 *            The `__exportsToClient` object of the model.
 */
WebServiceRouter.prototype.__setupRouteForService = function __setupRouteForService(modelName, funcName, modelApi) {
  return __DI__setupRouteForService(
    this.__options,
    __makeRouteToService,
    this.__app,
    console,
    
    modelName,
    funcName,
    modelApi
  );
};



/**
 * Dependency-injected version of `createService()`.
 *
 * @memberof WebServiceRouter
 * @private
 * @param {Express} app
 * @param {Function} setupRouteForService
 * @param {String} modelName
 * @param {Object} modelApi
 */
function __DI__createService(app, setupRouteForService,
                              modelName, modelApi) {
  if (!app) throw new Error('Must supply express instance in config() before calling createService().');

  for (var funcName in modelApi) {
    if (modelApi.hasOwnProperty(funcName)) {
      setupRouteForService(modelName, funcName, modelApi);
    }
  }
}
m.$$private(__DI__createService);


/**
 * Sets up a service for each function in the given model's API (`__exportsToClient`).
 *
 * @public
 * @param {String} modelName
 * @param {Object} modelApi -
 *            The `__exportsToClient` object of the model.
 */
WebServiceRouter.prototype.createService = function createService(modelName, modelApi) {  
  return __DI__createService(
    this.__app,
    this.__setupRouteForService.bind(this),
    
    modelName,
    modelApi
  );
};



/**
 * Dependency-injected version of `setupAllModelServices()`.
 *
 * @memberof WebServiceRouter
 * @private
 * @param {fs} fs -
 *            Node `fs` module.
 * @param {require} require -
 *            Node `require` module.
 * @param {Function} createService - 
 *            Used to create an individual service.
 * @param {WebServiceRouter~ConfigObject} options
 * @param {console} console
 * @param {String} modelPath
 */
function __DI__setupAllModelServices(fs, require, createService, options, console,
                                      modelPath) {
  var filenames = fs.readdirSync(modelPath),
      pathToFile;

  filenames.forEach(function(filename) {
    pathToFile = modelPath + filename;
    var stat = fs.statSync(pathToFile),
        model, modelName;

    if (stat.isFile() && filename.slice(-3) === '.js') {
      modelName = filename.split('.')[0];
      model = require(pathToFile);
      if (model && model.__exportsToClient) {
        createService(modelName, model.__exportsToClient);
      } else {
        if (options.verbose) console.log(sprintf('No API found for %s.', modelName));
      }
    }
  });
}
m.$$private(__DI__setupAllModelServices);



/**
 * Given a file path where model files are located, this function will
 * load all model files, grab the `__exportsToClient` object from each,
 * and create services from each function using `createService()`.
 *
 * Files must have a `.js` extension.
 *
 * @public
 * @param {String} modelPath
 */
WebServiceRouter.prototype.setupAllModelServices =
function setupAllModelServices(modelPath) {  
  return __DI__setupAllModelServices(
    fs,
    require,
    this.createService.bind(this),
    this.__options,
    console,
    
    modelPath
  );
};



module.exports = exports = m.$$getExports();