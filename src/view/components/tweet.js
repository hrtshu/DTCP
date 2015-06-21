'use strict';

var Vue = require('vue');
var vueTouch = require('vue-touch');
Vue.use(vueTouch);
var moment = require('moment');
var remote = require('remote');
var contextmenu = require('./contextmenu');
var ipc = require('ipc');
var shell = require('shell');
var _ = require('lodash');

var template = '<li class="tweetcontainer"><div class="tweet" v-on="contextmenu: rightclick" v-touch="tap: leftclick">'
    + '<section class="tweetleft">'
      + '<img class="tweeticon" v-attr="src: tweet.icon" onerror="this.style.visibility=\'hidden\';" v-touch="tap: doShowProfile" />'
    + '</section>'
    + '<section class="tweetright">'
      + '<section class="tweetmeta">'
        + '<section class="tweetmetaleft">'
          + '<span class="name" v-text="tweet.name" v-touch="tap: doShowProfile"></span>'
          + '&nbsp;'
          + '<span class="screenname" v-text="tweet.screenname | at" v-touch="tap: doShowProfile"></span>'
        + '</section>'
        + '<section class="tweetmetaright">'
          + '<span class="tweettime" v-text="timeFrom" v-if="!tweet.isFavorited"></span>'
          + '<span class="tweetindicator iconic tweetbuttonicon" data-glyph="star" v-if="tweet.isFavorited"></span>'
          + '<ul class="tweetactions">'
            + '<li class="tweetaction" v-on="click: doReply"><button class="tweetbutton"><span class="iconic tweetbuttonicon" data-glyph="share"></span></button></li>'
            + '<li class="tweetaction" v-on="click: doRetweet"><button class="tweetbutton" v-class="disabledbutton: tweet.protected, activetweetbutton: tweet.isRetweeted"><span class="iconic tweetbuttonicon" data-glyph="loop-circular"></span></button></li>'
            + '<li class="tweetaction" v-on="click: doQuote"><button class="tweetbutton" v-class="disabledbutton: tweet.protected"><span class="iconic tweetbuttonicon" data-glyph="double-quote-serif-left"></span></button></li>'
            + '<li class="tweetaction" v-on="click: doFavorite"><button class="tweetbutton" v-class="activetweetbutton: tweet.isFavorited"><span class="iconic tweetbuttonicon" data-glyph="star"></span></button></li>'
          + '</ul>'
        + '</section>'
      + '</section>'
      + '<section class="tweettext" v-html="tweet.status"></section>'
      + '<section class="tweetretweet" v-if="tweet.retweetedBy || tweet.isRetweeted">'
        + '<span class="iconic retweeticon" data-glyph="loop-square"></span><span class="retweetname" v-if="tweet.retweetedBy" v-text="tweet.retweetedBy"></span><span class="retweetname" v-if="tweet.isRetweeted && tweet.retweetedBy"> and </span><span class="retweetname" v-if="tweet.isRetweeted">You</span>'
      + '</section>'
      + '<section class="tweetmedia" v-if="tweet.media">'
        + '<ul class="tweetimagelist">'
          + '<li class="tweetimagebox" v-style="width: \'calc(100% / \' + tweet.media.length + \')\'" v-repeat="tweet.media">'
            + '<a class="tweetimagelink" target="_blank" v-style="background-image: \'url(\' + $value + \':small)\'" v-attr="href: $value" v-text="$value"></a>'
          + '</li>'
        + '</ul>'
      + '</section>'
      + '<section class="quotedtweet" v-if="tweet.quote">'
        + '<section class="quotedmeta">'
          + '<span class="name" v-text="tweet.quote.name"></span>'
          + '&nbsp;'
          + '<span class="screenname" v-text="tweet.quote.screenname | at"></span>'
        + '</section>'
        + '<section class="quotedtext" v-html="tweet.quote.status"></section>'
        + '<section class="tweetmedia" v-if="tweet.quote.media">'
          + '<ul class="tweetimagelist">'
            + '<li class="tweetimagebox" v-style="width: \'calc(100% / \' + tweet.quote.media.length + \')\'" v-repeat="tweet.quote.media">'
              + '<a class="tweetimagelink" target="_blank" v-style="background-image: \'url(\' + $value + \':small)\'" v-attr="href: $value" v-text="$value"></a>'
            + '</li>'
          + '</ul>'
        + '</section>'
      + '</section>'
    + '</section>'
  + '</div></li>';

var Tweet = Vue.extend({
  replace: true,
  props: ['username', 'now'],
  template: template,
  filters: {
    at: function (name) {
      return '@' + name;
    }
  },
  computed: {
    timeFrom: function () {
      var createdAt = moment(new Date(this.tweet.createdAt));
      var now = this.now;
      var duration = moment.duration(now.diff(createdAt));

      var sign = null;
      if ((sign = duration.as('second')) <= 5) {
        return 'now';
      } else if (sign < 60) {
        return Math.round(sign) + 's';
      } else if ((sign = duration.as('minute')) < 60) {
        return Math.round(sign) + 'm';
      } else if ((sign = duration.as('hour')) < 24) {
        return Math.round(sign) + 'h';
      } else if ((sign = duration.as('day')) <= 365) {
        return Math.round(sign) + 'd';
      } else {
        sign = duration.as('year');
        return Math.round(sign) + 'y';
      }
    }
  },
  methods: {
    doReply: function (event) {
      var self = this;
      var mentions = _.filter(this.tweet.mentions, function (k) {
        return k !== self.username;
      });
      mentions.unshift(this.tweet.screenname);

      ipc.send('reply', this.tweet.id, mentions);
    },
    doRetweet: function (event) {
      ipc.send('retweet', this.tweet.id, !this.tweet.isRetweeted);
    },
    doQuote: function (event) {
      var tweetUrl = 'https://twitter.com/'
        + this.tweet.screenName
        + '/status/'
        + this.tweet.id;

      ipc.send('quote', this.tweet.id, tweetUrl);
    },
    doFavorite: function (event) {
      ipc.send('favorite', this.tweet.id, !this.tweet.isFavorited);
    },
    doDelete: function (event) {
      ipc.send('delete', this.tweet.id);
    },
    doShowInBrowser: function (event) {
      var tweetUrl = 'https://twitter.com/'
        + this.tweet.screenName
        + '/status/'
        + this.tweet.id;

      shell.openExternal(tweetUrl);
    },
    doShowProfile: function () {
      this.$dispatch('showProfile', this.tweet.user);
    },
    rightclick: function (event) {
      var menu = contextmenu.build(this);
      menu.popup(remote.getCurrentWindow());
      event.preventDefault();
    },
    leftclick: function (event) {
      if (event.target.tagName === 'A') {
        var screenname = event.target.getAttribute('data-screen-name');
        if (screenname) {
          this.$dispatch('showScreenname', screenname);
        }
      } else if (event.target.tagName !== 'SPAN'
        && event.target.tagName !== 'BUTTON'
        && event.target.tagName !== 'IMG') {
        // Avoid firing on wrong elements
        this.$dispatch('showThread', this.tweet);
      }
    }
  },
});

Vue.component('tweet', Tweet);

module.exports = Tweet;
