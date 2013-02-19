// UI events -----------------------------------------------------------------
var ItpVisulization = require('itp-visualization');
var MouseWheel = require("module.mousewheel");
var Memento = require("module.memento");

(function(module, global) {
  // Helper function to limit the number of server requests;
  // at least throttle_ms have to pass for events to trigger 
  var throttle_ms = 50;
  var throttle = (function(){
    var timer = 0;
    return function(callback, ms){
      clearTimeout (timer);
      timer = setTimeout(callback, ms);
    };
  })();
  
  // This function only works with keypress events
  function isPrintableChar(evt) {
    if (typeof evt.which == "undefined") {
      return true;
    } else if (typeof evt.which == "number" && evt.which > 0) {
      return evt.which == 32 || evt.which == 13 || evt.which > 46;
    }
    return false;
  };

  // This is needed for the MouseWheel to remember the state before committing a reject
  var decodedResult;
  
  var ItpEvents = function($target, namespace, nsClass) {
    var self = this;

    self.vis = new ItpVisulization($target, namespace, nsClass);

    function cfg()     { return $target.data(namespace); }
    function userCfg() { return cfg().config; }
    function $source() { return $target.data(namespace).$source; }
    function reject() {
      var conf = cfg();
      if (conf.config.mode != 'PE') {
        var target = $target.editable('getText'),
            pos    = $target.editable('getCaretPos');
    
        conf.itpServer.rejectSuffix({
          target: target,
          caretPos: pos,
          numResults: 1,
        });
      }
    };
  
  
 
    // Load modules --------------------------------------
    
    self.mousewheel = new MouseWheel();
    self.mousewheel.init($target, {
      change: function(data) {
        if (!Boolean($target.editable('getText'))) {
          return false;
        }
        if (data) {
          console.log("Loading previous data...", data);
          self.vis.updateSuggestions(data);
        } else {
          console.log("Rejecting...");
          self.mousewheel.addElement(decodedResult);
          reject();
        }
      }
    });

    self.memento = new Memento();
    self.memento.init($target, {
      start: function() {
        $target.bind('input, editabletextchange', function(e, data, err){
          var tgtText  = $(e.target).editable('getText'),
              caretPos = $(e.target).editable('getCaretPos'),
              currState = self.memento.getState();
          if (!currState || tgtText != currState.text) {
            self.memento.addElement({ text:tgtText, caret:caretPos });
          }
//        }).bind('editabledomchange', function(e, data, err){
//          var clonedNode = $(e.target).clone(true);
//          if (stack.length < 1) {
//            self.memento.addElement(clonedNode);
//          } else {
//            self.memento.replaceElement(pos, clonedNode);
//          }
        });
      },
      change: function(data) {
        $target.editable('setText', data.text);
        var itpCfg = cfg();
        itpCfg.itpServer.getTokens({
          source: itpCfg.$source.editable('getText'),
          target: $target.editable('getText'),
        });
        $target.editable('setCaretPos', data.caret);        
      }
    });
 
    self.removeEvents = function() {
      $target.unbind(nsClass);
      cfg().itpServer.removeAllListeners();
    };

    self.attachEvents = function() {
      self.attachItpEvents();
      self.attachUIEvents();
    };

    self.attachItpEvents = function() {
      var itpCfg = cfg();
      var itp    = itpCfg.itpServer;
  
      // Socket.IO callbacks -------------------------------------------------------
      // See https://github.com/LearnBoost/socket.io/wiki/Exposed-events
      itp.on('connect', function() {
        itp.ping({
          ms: new Date().getTime()
        });
        itp.getServerConfig();
        itp.configure(userCfg());

        $target.trigger('ready', 'connect');
      });
      
      itp.on('disconnect', function() {
        itp.checkConnection();
        $target.trigger('unready', 'disconnect');
      });
      
      itp.on('reconnecting', function() { 
        $target.trigger('unready', 'reconnecting');
      });
      
      itp.on('reconnect_failed', function() { 
        $target.trigger('unready', 'reconnect_failed');
      });
    
      itp.on('reconnect', function() { 
        itp.configure(userCfg());
        $target.trigger('ready', 'reconnect');
      });
    
      itp.on('anything', function(obj) {
        console.info("anything:", obj);
      });
    
      itp.on('message', function(msg, callback) {
        console.info("message:", msg);
      });
      
      
      // CatClient callbacks -------------------------------------------------------
      
      //itp.on('receiveLog', function(msg) { console.log('server says:', msg); });
    
      itp.on('resetResult', function(data, err) {
        itp.configure(userCfg());
        $target.trigger('ready', 'reset');
      });
      
      // Handle translation responses
      itp.on('decodeResult', function(data, err) {
        var bestResult = data.nbest[0];
        // make sure new data still applies to current source
        if (data.source !== $source().editable('getText')) return;
    
        //console.log('contribution changed', data);
   
        self.vis.updateSuggestions(data);
        
        //var conf = userCfg();
        //if (conf.mode != 'PE') {
        //  itp.startSession({source: data.source});
        //}

        decodedResult = data;
        // Clean previous states
        self.mousewheel.invalidate();
        self.memento.invalidate();
        // First-time use of the mousewheel
        self.mousewheel.addElement(data);
                
        //XXX: $('#btn-translate').val("Translate").attr("disabled", false);
        $target.trigger('decode', [data, err]);
        $target.trigger('editabletextchange', [data, err]);
      });
    
      itp.on('startSessionResult', function(data, err) {
        var query = {
          source: $source().editable('getText'),
          target: $target.editable('getText'),
        }

        cfg().itpServer.getTokens(query);
      });

      // Handle post-editing (target has changed but not source)
      itp.on('getTokensResult', function(data, err) {
        // make sure new data still applies to current source and target texts
        if (data.source !== $source().editable('getText')) return;
        if (data.target !== $target.editable('getText')) return;
    
      	self.vis.updateTranslationDisplay(data);

        // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
        // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
        $target.trigger('tokens', [data, err]);
        $target.trigger('editabledomchange', [data, err]);
      });
    
      // Handle alignment changes (updates highlighting and alignment matrix) 
      itp.on('getAlignmentsResult', function(data, err) {
        self.vis.updateAlignmentDisplay(data);
        $target.trigger('alignments', [data, err]);
        $target.trigger('editabledomchange', [data, err]);
      });
    
      // Handle confidence changes (updates highlighting) 
      itp.on('getConfidencesResult', function(data, err) {
        //var start_time = new Date().getTime();
        self.vis.updateWordConfidencesDisplay(data);
        //console.log("update_word_confidences_display:", new Date().getTime() - start_time, obj.data.elapsed_time);
        $target.trigger('confidences', [data, err]);
        $target.trigger('editabledomchange', [data, err]);
      });
    
      // Handle confidence changes (updates highlighting) 
      itp.on(['setPrefixResult', 'rejectSuffixResult'], function(data, err) {
        self.vis.updateSuggestions(data);
        
        self.mousewheel.addElement(data);
        $target.trigger('suffixchange', [data, err]);
        $target.trigger('editabletextchange', [data, err]);
      });
    
      // Measure network latency
      itp.on('pingResult', function(data, err) {
        console.log("Received ping:", new Date().getTime() - data.ms);
        $target.trigger('ping', [data, err]);
      });
    
    
      // Receive server configuration 
      itp.on('getServerConfigResult', function(data, err) {
        $target.trigger('serverconfig', [data, err]);
      });
    
      // Handle updates changes (show a list of updated sentences) 
      itp.on('getValidatedContributionsResult', function(data, err) {
        $target.trigger('validatedcontributions', [data, err]);
      });
    
      // Handle models changes (after OL) 
      itp.on('validateResult', function(data, err) {
        $target.trigger('validate', [data, err]);
      });
    }

    self.attachUIEvents = function() {
      var itpCfg  = cfg() 
        , $source = itpCfg.$source
        , itp     = itpCfg.itpServer
        ;
  
      // #source and #target events
      // caretenter is a new event from jquery.editable that is triggered
      // whenever the caret enters in a new token span
      $target.bind('caretenter' + nsClass, function(e, d) {
        self.vis.updateWordPriorityDisplay($target, $(d.token));
      });
      $([$source[0], $target[0]]).bind('caretenter' + nsClass, function(e, d) {
        var alignments = $(d.token).data('alignments');
        if (alignments && alignments.alignedIds) {
          self.vis.showAlignments(alignments.alignedIds, 'caret-align');
        }
      })
      // caretleave is a new event from jquery.editable that is triggered
      // whenever the caret leaves a token span
      .bind('caretleave' + nsClass, function(e, d) {
        var alignments = $(d.token).data('alignments');
        if (alignments && alignments.alignedIds) {
          self.vis.hideAlignments(alignments.alignedIds, 'caret-align');
        }
      })
      .bind('keydown' + nsClass, function(e) {
        // prevent new lines
        if (e.which === 13) {
          e.stopPropagation();
          e.preventDefault();
        }
      }).bind('keydown' + nsClass, 'tab', function(e){
        // prevent tabs that move to the next word or to the next priority word
        e.stopPropagation();
        e.preventDefault();
        tabKeyHandler(e, 'fwd');
      }).bind('keydown' + nsClass, 'shift+tab', function(e){
        e.stopPropagation();
        e.preventDefault();
        tabKeyHandler(e, 'bck');
      });

      function tabKeyHandler(e, mode) {
        //if (mode == 'fwd') {}
        var ui = userCfg(), $token;
        
        if (ui.prioritizer != 'none') {
          if (mode == 'fwd') {
            $token = $('.editable-token', $target).filter(function(e){ return $(this).css('opacity') < 1.0}).first();
          } else {
            var tok = $target.editable('getTokenAtCaret');
            if (tok.elem) {
              $token = $(tok.elem).parent().prev('.editable-token');
            }
          }
          if ($token) {
            $target.editable('setCaretAtToken', $token.get(0));
          } else {
            $target.editable('setCaretPos', $target.text().length);
          }
        } else {
          if (self.currentCaretPos && self.currentCaretPos.token) {
            $token = $(self.currentCaretPos.token.elem);
            if ($token.parent().is('.editable-token')) {
              $token = $token.parent();
            }
            if (mode == 'fwd') {
              $token = $token.next('.editable-token');
            } else {
              $token = $token.prev('.editable-token');
            }
            if ($token) {
              $target.editable('setCaretAtToken', $token.get(0));
            } else {
              $target.editable('setCaretPos', $target.text().length);
            }
          }
        }      
      };
      
      // #source events
      // on key up throttle a new translation
      $source.bind('keyup' + nsClass, function(e) {
        var $this = $(this),
            data = $this.data('editable'),
            source = $this.editable('getText');
  
        if (isPrintableChar(e)) {
          throttle(function() {
            if (data.str != source) {
              var query = {
                source: source,
                //num_results: 2,
              }
              itp.decode(query);
            }
          }, throttle_ms);
        }
      })
      .bind('change' + nsClass, function(e){
        itp.startSession({source: $source.editable('getText')});
      });

    
      self.typedWords = {};
      self.currentCaretPos; // { pos, token }

      function forgetState(caretPos) {
        // IF "implicit reject on click" AND "cursor pos has chaged": invalidate previous states
        if (typeof self.currentCaretPos != 'undefined' && caretPos !== self.currentCaretPos.pos) {
          self.mousewheel.invalidate();
          //self.memento.invalidate();
        }
      };
            
      // caretmove is a new event from jquery.editable that is triggered
      // whenever the caret has changed position
      $target.bind('caretmove' + nsClass, function(e, d) {
        //var text = $(this).text();
        //$('#caret').html('<span class="prefix">' + text.substr(0, d.pos) + '</span>' + '<span class="suffix">' + text.substr(d.pos) + "</span>");
        forgetState(d.pos);
        self.currentCaretPos = d;
      })
      // on ctrl+click reject suffix 
      .bind('click' + nsClass, function(e) {
        var cpos = $target.editable('getCaretPos');
        forgetState(cpos);
        // Update only the caret position
        self.currentCaretPos.pos = cpos;
        // Issue a reject only if CTRL is pressed
        if (e.ctrlKey) reject();
      })
      // on keyup throttle a new translation
      .bind('keyup' + nsClass, function(e) {
        var conf = userCfg();
        if (conf.mode != 'PE') {
          var $this = $(this),
              data = $this.data('editable'),
              target = $this.editable('getText'),
              source = $source.editable('getText'),
              pos = $target.editable('getCaretPos');
              
          var spanElem = $target.editable('getTokenAtCaretPos', pos).elem.parentNode;
          var targetId = $(spanElem).attr('id');
          // Remember interacted words only when the user types in the right span
          var numInStr = targetId ? targetId.match(/(\d+)$/) : null;
          if (numInStr && parseInt(numInStr[0], 10)) {
            self.typedWords[ $(spanElem).attr('id') ] = true;
          }
          
          if (isPrintableChar(e)) {
            throttle(function () {
              if (data.str != target) {
                var query = {
                  target: target,
                  caretPos: pos,
                  numResults: 1
                }
                var itpCfg = cfg(), itp = itpCfg.itpServer;
                itp.setPrefix(query);
              }
            }, throttle_ms);
          }
        }
      });
    }
   
  };

  module.exports = ItpEvents; 

})('object' === typeof module ? module : {}, this);
