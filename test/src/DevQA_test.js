'use strict';

var _ = require('lodash');
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;
var should = chai.should();
var sinon = require('sinon');
var Promise = require('bluebird');

var WebServiceRouter = require('../../index.js').WebServiceRouter;

var AppMock = function () {
  this.__routes = {};
};

AppMock.prototype.post = function post(route, callback) {
  this.__routes[route] = callback;
};

AppMock.prototype.sendRequest = function sendRequest(route, req, res) {
  if (this.__routes[route]) {
    this.__routes[route](req, res);
  } else {
    throw new Error("No route.");
  }
};

var ResMock = function (fnSendWasCalled) {
  this.__fnSendWasCalled = fnSendWasCalled;
};

ResMock.prototype.send = function send(data) {
  this.__fnSendWasCalled(data);
};

describe('Dev QA Testing', function () {

  describe('WebService Router Testing', function () {

    it('should remove one trailing slash', function () {
      expect(WebServiceRouter.__test.__removeLeadingAndTrailingSlashes('things-and-stuff/')).to.equal('things-and-stuff');
    });


    it('should remove multiple trailing slashes', function () {
      // NOTE (AD) Testing this in case input is not valid in some use cases
      var removeSlash = WebServiceRouter.__test.__removeLeadingAndTrailingSlashes;
      expect(removeSlash(removeSlash(removeSlash('stuff///')))).to.equal('stuff');
    });


    it('should create route to service', function () {
      var result = WebServiceRouter
      .__test
      .__makeRouteToService('services', 'people', 'doathing');
          expect(result).to.equal('/services/people/doathing');
    });

    it('should return false when no user data is supplied', function () {
      var req = { packet: 'some packet data' };
      expect(WebServiceRouter.__test.__isUserLoggedIn(req)).to.equal(false);
    });

  });

});