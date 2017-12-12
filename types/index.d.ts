import express = require('express');

export declare interface ConfigObject {
  verbose?: boolean,
  rootServiceRoute?: string,
  fnIsUserLoggedIn?: fnIsUserLoggedIn,
  fnGetUserData?: fnGetUserData
}

export declare interface fnIsUserLoggedIn {
  (
    req: express.Request,
    res: express.Response,
    serviceHandler?: fnServiceHandler
  ): boolean;
}

export declare interface fnServiceHandler {
  (
    userData: object,
    args: object,
    client: object
  ): any;
  [propName: string]: any
}

export declare interface fnGetUserData {
  (
    req: express.Request,
    res: express.Response
  ): Object;
}

export declare class WebServiceRouter {
  constructor(
    app: express.Application,
    configOptions: ConfigObject
  );

  config(
    options: ConfigObject
  ): void;

  createService(
    modelName: string,
    modelApi: object
  ): void;

  setupAllModelServices(
    modelPath: string
  ): void;
}