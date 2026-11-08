(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  var PREFIX = 'bff.';
  var mem = {};
  var ls = null;

  try {
    ls = window.localStorage;
    var probe = PREFIX + '__probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
  } catch (e) {
    ls = null;
  }

  var store = {
    persistent: !!ls,
    get: function (key, fallback) {
      var raw = null;
      try {
        raw = ls ? ls.getItem(PREFIX + key) : Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
      } catch (e) {
        raw = Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
      }
      if (raw === null || raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      var raw = JSON.stringify(value);
      mem[key] = raw;
      if (ls) {
        try {
          ls.setItem(PREFIX + key, raw);
          return true;
        } catch (e) {
          store.persistent = false;
        }
      }
      return false;
    },
    remove: function (key) {
      delete mem[key];
      if (ls) {
        try {
          ls.removeItem(PREFIX + key);
        } catch (e) {}
      }
    }
  };
  BFF.store = store;

  var programs = [];
  try {
    var node = document.getElementById('programs-data');
    if (node) {
      var parsed = JSON.parse(node.textContent);
      if (Array.isArray(parsed)) programs = parsed;
    }
  } catch (e) {
    programs = [];
  }
  BFF.programs = programs;
  BFF.views = BFF.views || {};
})();
