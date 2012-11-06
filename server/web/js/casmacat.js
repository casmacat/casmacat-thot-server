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
   translate: function(source) {
     this.checkConnection();
     this.server.emit('translate', {source: source});
   },

   update: function(source, target) {
     this.checkConnection();
     this.server.emit('update', {source: source, target: target});
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
   decodeEpenInteraction: function(source, target, validated_words, pen_strokes) {
     this.checkConnection();
     this.server.emit('decode_epen_interaction', {source: source, target: target, validated_words: validated_words, pen_strokes: pen_strokes});
   },

   // Procesor methods
   getTokens: function(source, target) {
     this.checkConnection();
     this.server.emit('get_tokens', {source: source, target: target});
   },

   // Aligner methods
   getAlignments: function(source, target) {
     this.checkConnection();
     this.server.emit('get_alignments', {source: source, target: target});
   },

   // WC client methods
   getWordConfidences: function(source, target, validated_words) {
     this.checkConnection();
     this.server.emit('get_word_confidences', {source: source, target: target, validated_words: validated_words});
   },

   // ITM methods
   startImtSession: function(source) {
     this.checkConnection();
     this.server.emit('start_imt_session', {source: source});
   },
   setPrefix: function(target, caret_pos) {
     this.checkConnection();
     this.server.emit('set_prefix', {target: target, caret_pos: caret_pos});
   },
   endImtSession: function() {
     this.checkConnection();
     this.server.emit('end_imt_session');
   },

   // HTR methods
   startHtrSession: function(source) {
     this.checkConnection();
     this.server.emit('start_htr_session', {source: source, target: target, caret_pos: caret_pos});
   },
   addStroke: function(points, is_pen_down) {
     this.checkConnection();
     this.server.emit('add_stroke', {points: points, is_pen_down: is_pen_down});
   },
   endHtrSession: function() {
     this.checkConnection();
     this.server.emit('end_htr_session');
   },

});

