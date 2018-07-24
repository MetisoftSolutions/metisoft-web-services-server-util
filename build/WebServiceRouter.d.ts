import * as express from 'express';
import * as pg from 'pg';
import { Promise } from 'es6-promise';
export interface ICanRequireUserLogin {
    requiresUserLogin?: boolean;
}
export interface FnServiceHandler<TUserData, TArgs, TRetVal> extends ICanRequireUserLogin {
    (userData: TUserData, args: TArgs, client?: pg.PoolClient): Promise<TRetVal>;
    _exportToClient?: boolean;
}
export declare type FnIsUserLoggedIn = (req: express.Request, res: express.Response, serviceHandler: ICanRequireUserLogin) => Promise<boolean>;
export declare type FnGetUserData<TUserData> = (req: express.Request, res: express.Response) => Promise<TUserData>;
export interface IConfigOptions<TUserData> {
    verbose: boolean;
    rootServiceRoute: string;
    fnIsUserLoggedIn?: FnIsUserLoggedIn;
    fnGetUserData?: FnGetUserData<TUserData>;
}
export interface IDefaultUserData {
    id: string;
    username: string;
}
export declare class WebServiceRouter<TUserData> {
    private __app;
    private __options;
    private __defaultOptions;
    constructor(app: express.Application, configOptions: IConfigOptions<TUserData>);
    config: (options: IConfigOptions<TUserData>) => void;
    private __setUpRouteForService;
    setUpAllModelServices: (modelPath: string) => void;
    private __createService;
}
