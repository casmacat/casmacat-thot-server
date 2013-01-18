if (typeof CatClient === 'undefined') throw "CatClient not found";

(function(exports, global){

  var HtrClient = PredictiveCatClient;

$.extend(HtrClient.prototype, {

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
      this.checkConnection();
      this.server.emit('startSession', {data: obj});
    },
   
    addStroke: function(obj) {
      this.checkConnection();
      this.server.emit('add_stroke', {data: obj});
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
      this.checkConnection();
      this.server.emit('endSession');
    },    
   
});
