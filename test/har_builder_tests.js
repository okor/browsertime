'use strict';

let builder = require('../lib/support/har_builder'),
  expect = require('chai').expect;

describe('har_builder', function() {
  let har;

  beforeEach(function() {
    har = {
      'log': {
        'version': '1.2',
        'browser': {
          'name': 'Chrome',
          'version': '42.0.2311.90',
          'comment': ''
        },
        'pages': [{
          'id': 'page_0'
        }],
        'entries': [{
          'pageref': 'page_0'
        }]
      }
    };
  });

  describe('#addCreator', function() {
    it('should add creator if missing', function() {
      builder.addCreator(har, 'foo');

      expect(har).to.have.deep.property('log.creator.name', 'Browsertime');
      expect(har).to.have.deep.property('log.creator.comment', 'foo');
    });
  });

  describe('#mergeHars', function() {
    it('should merge two hars', function() {
      builder.addCreator(har);

      let har2 = {
        'log': {
          'version': 'kjsdhfksa',
          'browser': {
            'name': 'jksdhfjksd',
            'version': 'jkdhfkjsdfdkjsf',
            'comment': ''
          },
          'pages': [{
            'id': 'page_0'
          }],
          'entries': [{
            'pageref': 'page_0'
          }]
        }
      };

      let combinedHar = builder.mergeHars([har, har2]);

      expect(combinedHar.log.pages).to.eql([
        {
          'id': 'page_0'
        },
        {
          'id': 'page_0-1'
        }]);
      expect(combinedHar.log.entries).to.eql([
        {
          'pageref': 'page_0'
        },
        {
          'pageref': 'page_0-1'
        }]);
      expect(combinedHar).to.have.deep.property('log.version', '1.2');
      expect(combinedHar).to.not.have.deep.property('log.creator.comment');
    });
  });
});
