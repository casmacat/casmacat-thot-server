var CasmacatClient = function(url) {
  this.init(url);
}

$.extend(CasmacatClient.prototype, {
   // Common properties
   url: '',
   server: null,

   // Common initialization method
   init: function(url) {
     this.url = url;
     this.server = new io.connect(this.url);
   },
   
   // { suggestions: true, mode:"PE" }
   configure: function(obj) {
     this.checkConnection();
     this.server.emit('configure', {data: obj});
   },
   
   // Common event handler
   on: function(ev, func) {
     this.server.on(ev, func);
   },

   checkConnection: function() {
     if (!this.server.socket.open) {
       this.server.socket.reconnect();
     }
   },

   // MT client methods
   translate: function(obj) {
     this.checkConnection();
     this.server.emit('translate', {data: obj});
   },

   update: function(obj) {
     this.checkConnection();
     this.server.emit('update', {data: obj});
   },

   // DocumentManager methods
   uploadDocument: function(doc, mt_sys_id, gen_wg) {
     this.checkConnection();
     this.server.emit('upload_document', {doc: doc, mt_sys_id: mt_sys_id, gen_wg: gen_wg});
   },
   merge: function(doc_id) {
     this.checkConnection();
     this.server.emit('merge', {doc_id: doc_id});
   },

   // Procesor methods
   getTokens: function(obj) {
     this.checkConnection();
     this.server.emit('get_tokens', {data: obj});
   },

   // Aligner methods
   getAlignments: function(obj) {
     this.checkConnection();
     this.server.emit('get_alignments', {data: obj});
   },

   // WC client methods
   getWordConfidences: function(obj) {
     this.checkConnection();
     this.server.emit('get_word_confidences', {data: obj});
   },

   // ITM methods
   startImtSession: function(obj) {
     this.checkConnection();
     this.server.emit('start_imt_session', {data: obj});
   },
   setPrefix: function(obj) {
     this.checkConnection();
     this.server.emit('set_prefix', {data: obj});
   },
   endImtSession: function() {
     this.checkConnection();
     this.server.emit('end_imt_session');
   },

   reset: function() {
     this.checkConnection();
     this.server.emit('reset');
   },

   // HTR methods
   startHtrSession: function(obj) {
     this.checkConnection();
     this.server.emit('start_htr_session', {data: obj});
   },
   addStroke: function(obj) {
     this.checkConnection();
     this.server.emit('add_stroke', {data: obj});
   },
   endHtrSession: function() {
     this.checkConnection();
     this.server.emit('end_htr_session');
   },

});

