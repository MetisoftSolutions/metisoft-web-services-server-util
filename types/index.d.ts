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
    serviceHandler?: Function
  ): boolean;
}

export declare interface fnGetUserData {
  (
    req: express.Request
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