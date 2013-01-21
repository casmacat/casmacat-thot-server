(function(exports, global){

  var GoogleHtrClient = function(debug) {
    if (typeof debug === 'undefined') {
      debug = false;
    }

    var self = this;

    self.debug      = debug;
    //self.url        = "https://www.google.com/inputtools/request?ime=handwriting";
    self.url        = "https://www.google.com/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8";
    self.canvasSize = { width: 0, height: 0 };
    self.language   = "en";
    //self.device     = "Chrome/19.0.1084.46 Safari/536.5";
    self.device     = window.navigator.userAgent;
    self.options    = "enable_pre_space";

    self.preContext = "";
    self.lastResult = null;

    self.eventCallbacks = { "addStroke": [], "endSession": [] };
  }
 
  $.extend(GoogleHtrClient.prototype, {
    /**
    * Initialization method
    * @param url {String} Server URL to connect to
    */
    connect: function(url) {
      if (url) this.url = url;
    },
    
    /** 
    * Configures server as specified by the client.
    * @param {Object} Server-specific configuration
    * @trigger configureResult
    * @return {Object}
    *   errors {Array} List of error messages
    *   data {Object} Configuration after setting the server
    *   @setup data
    *     config {Object} Server-specific configuration
    *     elapsedTime {Number} ms    
    */
    configure: function(obj) {
      if (obj.canvasSize) this.canvasSize = obj.canvasSize;
      if (obj.language)   this.language   = obj.language;
      if (obj.device)     this.device     = obj.device;
      if (obj.options)    this.options    = obj.options;
    },
 
    /**
    * Event handler
    * @param ev {Mixed} String or Array of strings name of trigger
    * @param fn {Function} Callback
    */
    on: function(ev, fn) {
      if (typeof ev === 'string') {
        ev = [ev];
      }
      for (e in ev) {
        if (!this.eventCallbacks.hasOwnProperty(ev[e])) {
          console.log('adding callback for unknown event', ev[e]);
          this.eventCallbacks[ev[e]] = [];
        }
        this.eventCallbacks[ev[e]].push(
          function (obj) {
            if (obj) {
              try {
                if (this.debug && obj.errors.length > 0) {
                  console.error(obj.errors);
                }
              } catch(err) {
                // Probably obj.errors is undefined
              } finally {
                fn(obj.data, obj.errors);
              }
            } else {
              fn();
            }
        });
      }

      if (this.debug) {
        console.log("on", ev, "executed");
      }
    },

    /**
    * Executes callbacks for the given event 
    * @param url {String} Server URL to connect to
    */
    trigger: function(ev, obj) {
      try {
        for (var f = 0; f < this.eventCallbacks[ev].length; ++f) {
          this.eventCallbacks[ev][f](obj);
        }
      }
      catch(err) {
        // Probably undefined ev
      }
    },
   
    /** 
    * Retrieve decoding results for the current segment.
    * @param {Object}
    * @setup obj
    *   source {String}
    * @trigger startSessionResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     elapsedTime {Number} ms
    */
    startSession: function(obj) {
      console.log("emit", String.apply(this, arguments));
      this.preContext = "";
      this.lastResult = null;
    },
   
    /** 
    * Send data points sequence.
    * @param {Object}
    * @setup obj
    *   points {Array} 3D tuple: (x, y, timestamp)
    * @trigger addStrokeResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     [text] {Array} Partially recognized text
    *     [textSegmentation] {Array} Segmentation of partially recognized text
    *     elapsedTime {Number} ms
    *
    * Google API (sends)
    *   "method": "POST",
    *   "url": "https://www.google.com/inputtools/request?ime=handwriting",
    *   "postData": { 
    *                   device:   "Chrome/19.0.1084.46 Safari/536.5",
    *                   options:  "enable_pre_space",
    *                   requests: [{
    *                     writing_guide: {
    *                       writing_area_width: 1920,
    *                       writing_area_height:617
    *                     },
    *                     ink: [[[582,582,582,581,581,580],
    *                            [273,274,275,275,276,276],
    *                            [0,529,537,554,569,1009]]],
    *                     language: "en"
    *                   }]
    *                 }
    * Google API (receives)
    * ["SUCCESS",[["5e6ca87d1fc39aac",[".","-","'"," ."," -"," '","..","--"," ..",".-"]]]]
    */
    addStroke: function(obj) {
      console.log("emit", String.apply(this, arguments));
      var ink = [[[582,582,582,581,581,580],
                  [273,274,275,275,276,276],
                  [0,529,537,554,569,1009]]]

      var ink = [[[], [], []]]
      for (var p = 0; p < obj.points.length; ++p) {
        ink[0][0].push(obj.points[p][0]);
        ink[0][1].push(obj.points[p][1]);
        ink[0][2].push(obj.points[p][2] - obj.points[0][2]);
      }

      var data = {
                     device:   this.device,
                     options:  this.options,
                     requests: [{
                       writing_guide: {
                         writing_area_width:  this.canvasSize.width,
                         writing_area_height: this.canvasSize.height
                       },
                       pre_context: this.pre_context,
                       ink: ink,
                       language: this.language 
                     }]
                 } 

      $.ajax({
        type: "POST",
        url:  this.url,
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
          var text = this.lastResult + data[1][0][1][0];
          this.lastResult = { errors: [], data: { text: text, textSegmentation: undefined, elapsedTime: 0 } };
          if (data[0] !== "SUCCESS") this.lastResult.errors.push(data[0]);
          this.trigger("addStroke", this.lastResult);
        },
        failure: function(errMsg) {
          this.trigger("addStroke", { errors: [errMsg], data: undefined });
        }
      });
    },
    
    /** 
    * Close predictive session for the current segment.
    * @trigger endSessionResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     elapsedTime {Number} ms
    */
    endSession: function() {
      console.log("emit", String.apply(this, arguments));
      this.preContext = "";
      this.trigger();
    },    
   
  });
  // Expose
  exports.GoogleHtrClient = global.GoogleHtrClient = GoogleHtrClient;

})('object' === typeof module ? module.exports : {}, this);
