# Initial setup

```javascript
var WebServiceRouter = require('metisoft-web-services-server-util').WebServiceRouter;

// you can configure immediately
var webServiceRouter = new WebServiceRouter(app, {
      verbose: true
    });

// or you can configure later
webServiceRouter = new WebServiceRouter(app);
webServiceRouter.config({verbose: true});

// or you can use the default configuration
webServiceRouter = new WebServiceRouter(app);
```

`app` is a reference to your Express application. `app` is required, since `WebServiceRouter`'s main purpose is to set up routes for you in your Express application.

# Usage

Ideally, `WebServiceRouter` should only have to be used once, when your server is initializing. Wherever it is that you perform configuration for your Express middleware, you should create a `WebServiceRouter` and call `setupAllModelServices()`. For example, if you keep your models in the `/app/models` directory, the initial setup might look like this:

```javascript
// config.js
var path = require('path');
var webServiceRouter = new WebServiceRouter(app);
var modelDir = path.join(process.cwd(), 'app/models');
webServiceRouter.setupAllModelServices(modelDir);
```

During this call, `WebServiceRouter` will look in your models directory and pick out every `.js` file (it will *not* recurse into subdirectories). It will `require` each file, and look for a `__exportsToClient` property to find functions to export to the client. For each function you export to the client, it will create the following `POST` route on the server: `'/services/Model/functionName'`.

 - `services` is the root service route, and all service routes will begin with this prefix. This prefix can be changed using the configuration options.
 - `Model` will be taken from the name of the `.js` file, with the `.js` extension removed. For instance, all functions exported from `Person.js` would have the route prefix `'/services/Person/'`.
 - `functionName` is simply the name of the function (technically, it is the name of the property you specify for the function in the `__exportsToClient` object -- for consistency's sake, it is recommended that you give them the same name).

# Model configuration

## Exports

For `WebServiceRouter` to work properly, each model it finds must implement a specific interface. Within your model, you will have a number of functions, and you won't necessarily want all of them to be exposed to the client (private functions). You may also prefer to have some public functions that are only accessible from the server and that are not exposed to the client. For this reason, you must explicitly state which functions should be exposed to the client.

Here's an example of how you would export functions of different access levels:
```javascript
function privateFunction() {
  // ...
}

function serverOnlyPublicFunction() {
  // ...
}

function clientFunction(user, args) {
  // ...
}

module.exports = exports = {
    __exportsToClient: {
      clientFunction: clientFunction                      // will be exported to client as a web service
    },
    serverOnlyPublicFunction: serverOnlyPublicFunction,   // is exported such that other server modules 
                                                          //    can access, but is not exported to the client
    clientFunction: clientFunction                        // since the client can access it, we should
                                                          //    make sure the server can, too
  };
```

Notice that `clientFunction` is exported twice: once in `__exportsToClient` and once in the top-level object. Although this is not strictly required, it is good practice to do this. The reasoning is that a function exported to the client is conceptually more visible than a function exported to the server. Therefore, it would be weird to export a function to the client, but not have it be publicly-accessible to the server. (Technically, the server can see the `__exportsToClient` property and access the client function from there, but the `_` convention suggests that external modules shouldn't access it.) For this reason, be sure to always double export any client functions.

(Note: By using the `metisoft-module-exporter` module, you can more easily double export client functions with a single call. Prefer usage of that module over setting `exports` explicitly.)

## Client functions

Each function exported to the client must be written to a specific interface. A skeleton version appears below.

```javascript
function clientFunction(userData, req) {
  return Promise.resolve({});
}
```

The function must always take exactly two parameters:

 1. `userData` - An object that contains information about the logged-in user.
```javascript
    {
      userId: <number>,
      username: <string>,
      session: <express-session object>
    }
```
 2. `req` - An object that contains data sent from the client as a JSON object.
 
`userData` will be supplied by the server, so there is no concern of the client faking a logged-in user. The data comes directly from the Express session. Your function can then use this data to craft a response appropriate to the user -- for instance, retrieving only data entered by users from the same company.

`req` is intended to capture what would normally be the parameters of the function. By using an object here instead of a normal parameter list, it simplifies how the client sends arguments.

As an example, let's say you had a `Person` model with a client-exposed function called `findPeople()`. This function takes several criteria that could identify a person and uses them to perform queries on the database, returning the results. If you were writing this as a normal function -- that is, one that's not exported to the client -- it might look like this:

```javascript
function findPeople(firstName, lastName, phone, email) {
  var query = makeQuery_findPeople(firstName, lastName, phone, email);
  return db.runSquelQuery(query);
}
```

If we want to export it to the client, though, we would change it to this:

```javascript
function findPeople(userData, req) {
  var query = makeQuery_findPeople(req.firstName, req.lastName, req.phone, req.email);
  return db.runSquelQuery(query);
}
```

The only difference is that we had to pull the arguments out of the `req` object, although you could just as easily rewrite `makeQuery_findPeople()` to take an object instead of four string values.

We also have easy access to the logged-in user's data now, so we should filter our results by the logged-in user's company. Assuming `makeQuery_findPeople()` has an optional fifth parameter for company ID that it will use to filter by, we can do this:

```javascript
function findPeople(userData, req) {
  var query = makeQuery_findPeople(req.firstName, req.lastName, req.phone, req.email, userData.company.id);    // send in company to filter results
  return db.runSquelQuery(query);
}
```

Finally, the function must return a Promise, preferably implemented by [bluebird.js][1]. In our examples above, the `db.runSquelQuery()` function returns a Promise already, so we simply return that. For more in-depth examples of how Promises are used, please refer to the [bluebird API reference][2].

[1]: http://bluebirdjs.com/docs/getting-started.html
[2]: http://bluebirdjs.com/docs/api-reference.html

# The client perspective

As mentioned earlier, all requests to a web service will be sent using the `POST` method. Since `userData` is supplied by the server, the client only sends up the `req` object. To continue with the `findPeople()` example above, here is how one might send a request to this service using [AngularJS][3]' `$http` module:

```javascript
$http.post('/services/Person/findPeople', {
  firstName: 'Thomas',
  lastName: 'Jefferson',
  phone: '999-469-0000',
  email: 'tj@whitehouse.gov'
}).then((results) => {
  // do something with the results
});
```

For more information, please refer to the `metisoft-web-services-client-util` sister module.

[3]: https://angularjs.org/


