(function(module, global){
  var NLP = require('nlp-utils');

  /*******************************************************************************/
  /*           update the HTML display and attach events                         */
  /*******************************************************************************/

  var ItpVisualization = function($target, namespace, nsClass) {
    var self = this;

    function cfg()     { return $target.data(namespace); }
    function userCfg() { return cfg().config; }
    function $source() { return $target.data(namespace).$source; }

    self.updateValidated = function(caretPos) {
      if (caretPos) {
        var tokenAtPos = $target.editable('getTokenAtCaretPos', caretPos);
        if (tokenAtPos) {
          var lastEditedToken = tokenAtPos.elem;
          if (lastEditedToken.parentNode && $(lastEditedToken.parentNode).is('.editable-token')) {
            lastEditedToken = lastEditedToken.parentNode;
          }

          if (tokenAtPos.pos === 0) {
            if (lastEditedToken.nodeType === 3) {
              lastEditedToken = lastEditedToken.previousSibling;
            }
            else {
              var $lastEditedToken = $(lastEditedToken).prev('.editable-token');
              if ($lastEditedToken.length > 0) {
                lastEditedToken = $lastEditedToken.get(0);
              }
              else {
                lastEditedToken = undefined;
              }
            }
          }

          if (lastEditedToken) {
            // XXX: do not use jquery data if you want css selectors to work
            lastEditedToken.dataset.validated = true;
            lastEditedToken.dataset.prefix = true;
            $(lastEditedToken).prevAll(".editable-token").each(function(i, elem) {
              elem.dataset.prefix = true;
              // if the element in the prefix has been inserted, then it must have been introduced by the user 
              if ($(elem).data('merge-type') !== 'N') {
                elem.dataset.validated = true;
              }
            });
          }
        }
      }
    }

    self.updateSuggestions = function(data) {
      var d = $target.editable('getCaretXY')
        , targetPrefix = $target.editable('getText').substr(0, d.pos)
        , conf = userCfg()
        ;
          
      if (!data || !data.nbest) return;

      $source().editable('setText', data.source, data.sourceSegmentation);

      for (var i = 0; i < data.nbest.length; i++) {
        var match = data.nbest[i];
        // XXX: If prediction came from click in the middle of a token, then the
        // sentence is not updated; since the following condition does not match:
        // The prefix in the sentence does not match the prefix in the prediction.
        var matchPrefix = match.target.substr(0, d.pos);
        if (targetPrefix === matchPrefix && conf.mode === match.author) {
          $target.editable('setText', match.target, match.targetSegmentation);

          self.updateValidated(data.caretPos);

          if (match.priorities) {
            self.updateWordPriorities($target, match.priorities);
          }
        
          // requests the server for new alignment and confidence info
          var query = {
            source: $source().editable('getText'),
            target: match.target,
          }
          var conf = cfg();
          if (conf.config.useAlignments) {
            conf.itpServer.getAlignments(query);
          }
          if (conf.config.useConfidences) {
            conf.itpServer.getConfidences(query);
          }
          break;
        }
      }
    }


    // updates the translation display and queries for new alignments and word confidences
    self.updateTranslationDisplay = function(data) {
      // getTokens doesn't have nbest, so this check is required
      var bestResult = data.nbest ? data.nbest[0] : data;
      var source     = data.source,
          sourceSeg  = data.sourceSegmentation,
          target     = bestResult.target,
          targetSeg  = bestResult.targetSegmentation;
      
      // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
      $source().editable('setText', source, sourceSeg);
      $target.editable('setText', target, targetSeg);

      self.updateValidated(data.caretPos);

      // requests the server for new alignment and confidence info
      var query = {
        source: source,
        target: target,
        //validated_words: []
      }

      var conf = cfg();
      if (conf.config.useAlignments) {
        conf.itpServer.getAlignments(query);
      }
      if (conf.config.useConfidences) {
        conf.itpServer.getConfidences(query);
      }
    }


    // get the aligned html ids for source and target tokens
    self.getAlignmentIds = function(alignments, sourcespans, targetspans) {
      // sourceal stores ids of target spans aligned to it
      var sourceal = [];
      sourceal.length = alignments.length;
      for (var c = 0; c < alignments.length; ++c) sourceal[c] = [];

      // targetal stores ids of source spans aligned to it
      var targetal = [];
      targetal.length = alignments[0].length;
      for (var v = 0; v < alignments[0].length; ++v) targetal[v] = [];
      
      for (var c = 0; c < sourceal.length; ++c) {
        var alignment = alignments[c];          
        for (var v = 0; v < targetal.length; ++v) {
          if (alignment[v] > 0.5) {
            sourceal[c].push('#' + targetspans[v].id);
            targetal[v].push('#' + sourcespans[c].id);

            var s = $('#' + sourcespans[c].id).get(0);
            var t = $('#' + targetspans[v].id).get(0);
            if (t.dataset.prefix) s.dataset.prefix = true;
            if (t.dataset.validated) s.dataset.validated = true;
          }
        }
      }
      
      return {sourceal: sourceal, targetal: targetal};	  	
    }

    
    self.showAlignments = function(aligs, classname) {
      for (var j = 0; j < aligs.length; j++) {
        $(aligs[j]).toggleClass(classname, true);
      }
    }

    self.hideAlignments = function(aligs, classname) {
      for (var j = 0; j < aligs.length; j++) {
        $(aligs[j]).toggleClass(classname, false);
      }
    }


    // add alignment events so that aligned words are highlighted
    self.addAlignmentEvents = function($node, spans, aligids) {
      // add mouseenter mouseleave events to token spans
      for (var i = 0; i < spans.length; i++) {
        var $span = $(spans[i]);
        var data = $span.data('alignments');
        if (!data) {
          $span.off('.alignments');
          $span.on('mouseenter.alignments', function (e) {
            var aligs = $(e.target).data('alignments').alignedIds;
            self.showAlignments(aligs, 'mouse-align');
          });
          $span.on('mouseleave.alignments', function (e) {
            var aligs = $(e.target).data('alignments').alignedIds;
            self.hideAlignments(aligs, 'mouse-align');
          });
        }
        else {
          $span[0].removeEventListener('DOMNodeRemoved', data.onremove, false);
        }
        data = { alignedIds: aligids[i] };
        data.onremove = function(alignedIds) { 
          return function(e) { self.hideAlignments(alignedIds, 'mouse-align caret-align'); }
        }(data.alignedIds);

        $span[0].addEventListener('DOMNodeRemoved', data.onremove, false);
        $span.data('alignments', data);
      } 
    }

    // updates the alignment display with new alignment info      
    self.updateAlignmentDisplay = function(data) {
      var alignments = data.alignments
        , source = data.source
        , sourceSegmentation = data.sourceSegmentation
        , target = data.target
        , targetSegmentation = data.targetSegmentation
        ;

      // make sure new data still applies to current text
      if (!(alignments.length > 0 && alignments[0].length > 0)) return;
      if (source !== $source().editable('getText')) return;
      if (target !== $target.editable('getText')) return;

      // get span tokens 
      var sourcespans = $('.editable-token', $source());
      var targetspans = $('.editable-token', $target);
    
      var aligids = self.getAlignmentIds(alignments, sourcespans, targetspans);  

      // sourceal stores ids of target spans aligned to it
      var sourceal = aligids.sourceal;
      var targetal = aligids.targetal;

      // add mouseenter mouseleave events to source spans
      self.addAlignmentEvents($source(), sourcespans, sourceal);

      // add mouseenter mouseleave events to target spans
      self.addAlignmentEvents($target, targetspans, targetal);
    }


    self.updateWordPriorities = function($target, priorities) {
      // get target span tokens 

      $('.editable-token', $target).each(function(index) {
        $(this).data('priority', priorities[index]);
      });

      var $currentToken = $($target.editable('getTokenAtCaret').elem);
      self.updateWordPriorityDisplay($target, $currentToken);
    }

    self.updateWordPriorityDisplay = function($target, $token) {
      // get target span tokens 
      var spans = $('.editable-token', $target)
        , userPriorityLength = userCfg().priorityLength
        ;

      if ($token.parent().is('.editable-token')) {
        $token = $token.parent();
      }
      else {
        while (!$token.is('.editable-token') && $token[0].nextSibling) {
          $token = $($token[0].nextSibling);
        }
      }

      var currentPriority = $token.data('priority');
      spans.each(function() {
        var $span = $(this), scale = 2.0;
        if ($span.data('priority') >= currentPriority + userPriorityLength) {
          opacity = 0.3; //Math.pow(2, (-priorities[c] + 2) * scale);
        } else {
          opacity = 1.0;
        }
        $span.css('opacity', opacity);
      });
    }
 
    // updates the confidence display with new confidence info      
    self.updateWordConfidencesDisplay = function(data) {
      var sent = data.quality
        , confidences = data.confidences
        , source = data.source
        , sourceSegmentation = data.sourceSegmentation
        , target = data.target
        , targetSegmentation = data.targetSegmentation
        , confThreshold = userCfg().confidenceThresholds
        ;

      // make sure new data still applies to current text
      if (source !== $source().editable('getText')) return;
      if (target !== $target.editable('getText')) return;

      // get target span tokens 
      var spans = $('.editable-token', $target);
      // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
      for (var c = 0; c < confidences.length; ++c) {
        var $span = $(spans[c]), conf = Math.round(confidences[c]*100)/100, cssClass;
        if (conf > confThreshold.doubt /*|| typedWords.hasOwnProperty($span.attr("id"))*/) {
          cssClass = "wordconf-ok";
        }
        else if (conf > confThreshold.bad) {
          cssClass = "wordconf-doubt";
        }
        else {
          cssClass = "wordconf-bad";
        }

        $span.attr('title', 'conf: ' + Math.round(conf*100))
             .data('confidence', conf)
             .removeClass("wordconf-ok wordconf-doubt wordconf-bad")
             .addClass(cssClass);
      }
    }
  };
  
  module.exports = ItpVisualization; 

})('object' === typeof module ? module : {}, this);
