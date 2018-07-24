import * as _ from 'lodash';
import * as fs from 'fs';
import * as express from 'express';
import * as pg from 'pg';



export interface ICanRequireUserLogin {
  requiresUserLogin?: boolean;
}

export interface FnServiceHandler<TUserData, TArgs, TRetVal> extends ICanRequireUserLogin {
  (userData: TUserData, args: TArgs, client?: pg.PoolClient): Promise<TRetVal>;
  _exportToClient?: boolean;
}

export type FnIsUserLoggedIn = (req: express.Request, res: express.Response, serviceHandler: ICanRequireUserLogin) => Promise<boolean>;

export type FnGetUserData<TUserData> = (req: express.Request, res: express.Response) => Promise<TUserData>;

export interface IConfigOptions<TUserData> {
  verbose: boolean;
  rootServiceRoute: string;
  fnIsUserLoggedIn?: FnIsUserLoggedIn;
  fnGetUserData?: FnGetUserData<TUserData>;
}



const __defaultIsUserLoggedIn: FnIsUserLoggedIn = (req, res, serviceHandler): Promise<boolean> => {
  return Promise.resolve(
    !!(res.locals.metisoft &&
       res.locals.metisoft.user &&
       res.locals.metisoft.user.username));
};



export interface IDefaultUserData {
  id: string;
  username: string;
}

const __defaultGetUserData: FnGetUserData<IDefaultUserData> = (req, res) => {
  let userData: IDefaultUserData = {
    id: res.locals.metisoft.user.id,
    username: res.locals.metisoft.user.username
  };

  return Promise.resolve(userData);
};



function __removeLeadingAndTrailingSlashes(str: string): string {
  while (str.length > 0 && str.slice(-1) === '/') {
    str = str.slice(0, -1);
  }

  while (str.length > 0 && str[0] === '/') {
    str = str.slice(1);
  }

  return str;
}



function __makeRouteToService(rootServiceRoute: string, modelName: string, serviceName: string): string {
  var pieces = [
    rootServiceRoute,
    modelName,
    serviceName
  ];
  
  pieces = pieces.map(__removeLeadingAndTrailingSlashes);  
  return '/' + pieces.join('/');
}



function __isJsOrTsFile(fileName: string) {
  const ext = fileName.slice(-3);
  return (ext === '.js' || ext === '.ts');
}



export class WebServiceRouter<TUserData> {

  private __app: express.Application;
  private __options: IConfigOptions<TUserData>;

  private __defaultOptions = {
    verbose: false,
    rootServiceRoute: '/services'
  };

  constructor(app: express.Application, configOptions: IConfigOptions<TUserData>) {
    if (!app) {
      throw new Error("Express app required.");
    }

    this.__app = app;
    this.__options = _.cloneDeep(this.__defaultOptions);

    if (configOptions) {
      this.config(configOptions);
    }
  }



  public config = (options: IConfigOptions<TUserData>) => {
    if (options) {
      this.__options = _.assignIn(this.__options, options);
    }
  };



  private __setUpRouteForService = (modelName: string, funcName: string, func: FnServiceHandler<TUserData | any, any, any>) => {
    const options = this.__options;
    let requiresUserLogin = true;
    let fnIsLoggedIn: FnIsUserLoggedIn;
    let fnGetUserData: FnGetUserData<TUserData | any>;

    if (_.isBoolean(func.requiresUserLogin)) {
      requiresUserLogin = func.requiresUserLogin;
    }

    if (requiresUserLogin && options.fnIsUserLoggedIn && _.isFunction(options.fnIsUserLoggedIn)) {
      fnIsLoggedIn = options.fnIsUserLoggedIn;
    } else {
      fnIsLoggedIn = __defaultIsUserLoggedIn;
    }

    if (options.fnGetUserData && _.isFunction(options.fnGetUserData)) {
      fnGetUserData = options.fnGetUserData;
    } else {
      fnGetUserData = __defaultGetUserData;
    }

    if (func && _.isFunction(func)) {
      const route = __makeRouteToService(options.rootServiceRoute, modelName, funcName);

      this.__app.post(route, (req, res) => {
        fnIsLoggedIn(req, res, func)

          .then((isLoggedIn: boolean) => {
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

            return func(fnGetUserData(req, res), req.body);
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
            } else {
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



  public setUpAllModelServices = (modelPath: string) => {
    const fileNames = fs.readdirSync(modelPath);
    let pathToFile;

    _.forEach(fileNames, (fileName) => {
      pathToFile = modelPath + fileName;

      const stat = fs.statSync(pathToFile);
      let modelApi: any;
      let modelName: string;

      if (stat.isFile() && __isJsOrTsFile(fileName) && !fileName.startsWith('_')) {
        modelName = fileName.split('.')[0];
        modelApi = require(pathToFile);

        if (modelApi) {
          this.__createService(modelName, modelApi);
        }
      }
    });
  };



  private __createService = (modelName: string, modelApi: any) => {
    _.forEach(modelApi, (func, funcName) => {
      if (func._exportToClient) {
        this.__setUpRouteForService(modelName, funcName, func);
      }
    });
  }

}
