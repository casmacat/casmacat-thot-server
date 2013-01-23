if (typeof io === 'undefined') throw "Socket IO not found";

(function(exports, global){

  var CatClient = function(debug) {
    if (typeof debug === 'undefined') {
      debug = false;
    }

    var self = this;

    self.debug  = debug;
    self.server = null;
    
    /**
    * Initialization method
    * @param url {String} Server URL to connect to
    */
    self.connect = function(url) {
      self.server = new io.connect(url);
      if (self.debug) {
        var emit = self.server.emit;
        self.server.emit = function() {
          emit.apply(this, arguments);
          console.log("emit", String.apply(this, arguments));
        }
      }
    };
    
    /**
    * Event handler
    * @param ev {Mixed} String or Array of strings name of trigger
    * @param fn {Function} Callback
    */
    self.on = function(ev, fn) {
      if (typeof ev === 'string') {
        ev = [ev];
      }
      for (e in ev) {
        self.server.on(ev[e], function(obj){
          if (obj) {
            try {
              if (self.debug && obj.errors && obj.errors.length > 0) {
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

      if (self.debug) {
        console.log("on", ev, "executed");
      }
    };
    
    /**
    * Tries to reconnect if connection drops.
    */
    self.checkConnection = function() {
      if (!self.server.socket.open) {
        self.server.socket.reconnect();
      }
    };

    /** 
    * Retrieves decoding results for the current segment.
    * @param {Object}
    * @setup obj
    *   ms {Number}
    * @trigger pingResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     ms {Number} Original ms
    *     elapsedTime {Number} ms 0 by definition
    */
    self.ping = function(obj) {
      self.checkConnection();
      self.server.emit('ping', {data: obj});
    };
        
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
    self.configure = function(obj) {
      self.checkConnection();
      self.server.emit('configure', {data: obj});
    };
    
    /** 
    * Validates source-target pair.
    * @param {Object} 
    * @setup obj
    *   source {String}
    *   target {String}
    * @trigger validateResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     elapsedTime {Number} ms
    */
    self.validate = function(obj) {
      self.checkConnection();
      self.server.emit('validate', {data: obj});
    };

    /** 
    * Resets server.
    * @trigger resetResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object} Response data
    *   @setup data
    *     elapsedTime {Number} ms
    */
    self.reset = function() {
      self.checkConnection();
      self.server.emit('reset');
    };

    /** 
    * Retrieves server configuration.
    * @trigger getServerConfigResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object} Response data
    *   @setup data
    *     config {Object} Server-specific configuration
    *     elapsedTime {Number} ms
    */
    self.getServerConfig = function() {
      self.checkConnection();
      self.server.emit('getServerConfig');
    };

    /** 
    * Retrieves decoding results for the current segment.
    * @param {Object}
    * @setup obj
    *   source {String}
    *   numResults {Number} How many results should be retrieved
    * @trigger decodeResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     source {String}
    *     sourceSegmentation {Array} Verified source segmentation
    *     elapsedTime {Number} ms
    *     nbest {Array} List of objects
    *     @setup nbest
    *       target {String} Result
    *       targetSegmentation {Array} Segmentation of result
    *       elapsedTime {Number} ms
    *       [author] {String} Technique or person that generated the target result
    *       [alignments] {Array} Dimensions: source * target
    *       [confidences] {Array} List of floats for each token
    *       [quality] {Number} Quality measure of overall hypothesis    
    */
    self.decode = function(obj) {
      self.checkConnection();
      self.server.emit('decode', {data: obj});
    };
    
    /** 
    * Retrieves tokenization results for the current segment.
    * @param {Object}
    * @setup obj
    *   source {String}
    *   target {String}
    * @trigger getTokensResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     source {String}
    *     sourceSegmentation {Array} Verified source segmentation
    *     target {String} Result
    *     targetSegmentation {Array} Segmentation of result 
    *     elapsedTime {Number} ms
    */
    self.getTokens = function(obj) {
      self.checkConnection();
      self.server.emit('getTokens', {data: obj});
    };

    /** 
    * Retrieves alignment results  for the current segment.
    * @param {Object}    
    * @setup obj
    *   source {String}
    *   target {String}
    * @trigger getAlignmentsResult
    * @return {Object} 
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     alignments {Array} Dimensions: source * target
    *     source {String}
    *     sourceSegmentation {Array} Verified source segmentation
    *     target {String} Result
    *     targetSegmentation {Array}    
    *     elapsedTime {Number} ms
    */
    self.getAlignments = function(obj) {
      self.checkConnection();
      self.server.emit('getAlignments', {data: obj});
    };

    /** 
    * Retrieves confidence results for the current segment.
    * @param {Object} 
    * @setup obj
    *   source {String}
    *   target {String}
    *   validatedTokens {Array} List of Booleans, where 1 indicates that the token is validated
    * @trigger getConfidencesResult
    * @return {Object}
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     quality {Number} Quality measure of overall hypothesis
    *     confidences {Array} List of floats for each token
    *     source {String} Verified source
    *     sourceSegmentation {Array} Verified source segmentation
    *     target {String} Result
    *     targetSegmentation {Array}
    *     elapsedTime {Number} ms
    */
    self.getConfidences = function(obj) {
      self.checkConnection();
      self.server.emit('getConfidences', {data: obj});
    };

    /** 
    * Retrieves contributions that users completed after full supervision.
    * @trigger getValidatedContributionsResult
    * @return {Object}
    *   errors {Array} List of error messages
    *   data {Object}
    *   @setup data
    *     contributions {Array} List of validated contributions
    *     @setup contributions
    *       source {String} Validated source
    *       target {String} Validated target
    *     elapsedTime {Number} ms
    */
    self.getValidatedContributions = function() {
      self.checkConnection();
      self.server.emit('getValidatedContributions');
    };

    /*
    // Unused methods
    self.uploadDocument = function(doc, mt_sys_id, gen_wg) {
      self.checkConnection();
      self.server.emit('upload_document', {doc: doc, mt_sys_id: mt_sys_id, gen_wg: gen_wg});
    };
    self.merge = function(doc_id) {
      self.checkConnection();
      self.server.emit('merge', {doc_id: doc_id});
    };
    */
  };

  // Expose
  exports.CatClient = global.CatClient = CatClient;

})('object' === typeof module ? module.exports : {}, this);
