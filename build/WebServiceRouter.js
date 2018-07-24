"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("lodash"));
const fs = __importStar(require("fs"));
const es6_promise_1 = require("es6-promise");
const __defaultIsUserLoggedIn = (req, res, serviceHandler) => {
    return es6_promise_1.Promise.resolve(!!(res.locals.metisoft &&
        res.locals.metisoft.user &&
        res.locals.metisoft.user.username));
};
const __defaultGetUserData = (req, res) => {
    let userData = {
        id: res.locals.metisoft.user.id,
        username: res.locals.metisoft.user.username
    };
    return es6_promise_1.Promise.resolve(userData);
};
function __removeLeadingAndTrailingSlashes(str) {
    while (str.length > 0 && str.slice(-1) === '/') {
        str = str.slice(0, -1);
    }
    while (str.length > 0 && str[0] === '/') {
        str = str.slice(1);
    }
    return str;
}
function __makeRouteToService(rootServiceRoute, modelName, serviceName) {
    var pieces = [
        rootServiceRoute,
        modelName,
        serviceName
    ];
    pieces = pieces.map(__removeLeadingAndTrailingSlashes);
    return '/' + pieces.join('/');
}
function __isJsOrTsFile(fileName) {
    const ext = fileName.slice(-3);
    return (ext === '.js' || ext === '.ts');
}
class WebServiceRouter {
    constructor(app, configOptions) {
        this.__defaultOptions = {
            verbose: false,
            rootServiceRoute: '/services'
        };
        this.config = (options) => {
            if (options) {
                this.__options = _.assignIn(this.__options, options);
            }
        };
        this.__setUpRouteForService = (modelName, funcName, func) => {
            const options = this.__options;
            let requiresUserLogin = true;
            let fnIsLoggedIn;
            let fnGetUserData;
            if (_.isBoolean(func.requiresUserLogin)) {
                requiresUserLogin = func.requiresUserLogin;
            }
            if (requiresUserLogin && options.fnIsUserLoggedIn && _.isFunction(options.fnIsUserLoggedIn)) {
                fnIsLoggedIn = options.fnIsUserLoggedIn;
            }
            else {
                fnIsLoggedIn = __defaultIsUserLoggedIn;
            }
            if (options.fnGetUserData && _.isFunction(options.fnGetUserData)) {
                fnGetUserData = options.fnGetUserData;
            }
            else {
                fnGetUserData = __defaultGetUserData;
            }
            if (func && _.isFunction(func)) {
                const route = __makeRouteToService(options.rootServiceRoute, modelName, funcName);
                this.__app.post(route, (req, res) => {
                    fnIsLoggedIn(req, res, func)
                        .then((isLoggedIn) => {
                        if (!isLoggedIn && requiresUserLogin) {
                            res.status(400).send({
                                errorCode: 'NOT_LOGGED_IN',
                                errorMessage: "User is not logged in."
                            });
                            return;
                        }
                        if (options.verbose) {
                            console.log(`Service "${route}" is being called; invoking ${modelName}.${funcName}`);
                        }
                        return fnGetUserData(req, res);
                    })
                        .then((userData) => {
                        return func(userData, req.body);
                    })
                        .then((retObj) => {
                        res.send(retObj);
                    })
                        .catch((err) => {
                        const errorToSend = {
                            code: '',
                            message: ''
                        };
                        if (err._code && err._message) {
                            errorToSend.code = err._code;
                            errorToSend.message = err._message;
                        }
                        else {
                            errorToSend.message = err.message;
                        }
                        res.status(400).send({
                            error: errorToSend
                        });
                        console.log(err);
                        console.log(err.stack);
                    });
                });
                if (options.verbose) {
                    console.log(`\tService for ${modelName} set up at ${route} to point to ${func.name}.`);
                }
            }
        };
        this.setUpAllModelServices = (modelPath) => {
            const fileNames = fs.readdirSync(modelPath);
            let pathToFile;
            _.forEach(fileNames, (fileName) => {
                pathToFile = modelPath + fileName;
                const stat = fs.statSync(pathToFile);
                let modelApi;
                let modelName;
                if (stat.isFile() && __isJsOrTsFile(fileName) && !fileName.startsWith('_')) {
                    modelName = fileName.split('.')[0];
                    modelApi = require(pathToFile);
                    if (modelApi) {
                        this.__createService(modelName, modelApi);
                    }
                }
            });
        };
        this.__createService = (modelName, modelApi) => {
            _.forEach(modelApi, (func, funcName) => {
                if (func._exportToClient) {
                    this.__setUpRouteForService(modelName, funcName, func);
                }
            });
        };
        if (!app) {
            throw new Error("Express app required.");
        }
        this.__app = app;
        this.__options = _.cloneDeep(this.__defaultOptions);
        if (configOptions) {
            this.config(configOptions);
        }
    }
}
exports.WebServiceRouter = WebServiceRouter;
