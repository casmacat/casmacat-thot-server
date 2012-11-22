var casmacat;

$(function(){

  /*******************************************************************************/
  /*           create server connection and handle server events                 */
  /*******************************************************************************/

  // connect to a server. casmacat will receive async server responses
  casmacat = new CasmacatClient('http://' + window.casmacatServer + '/casmacat');

  // handle disconections and debug information
  casmacat.on('disconnect', function(){ this.socket.reconnect(); });
  //casmacat.on('receive_log', function(msg) { console.log('server says:', msg); });
  casmacat.on('serverready', function() { $('body').unblock(); });
  
  // handle translation responses
  casmacat.on('contributionchange', function(obj) {
    var data = obj.data;
    // make sure new data still applies to current source
    if (data.text !== $('#source').editable('getText')) return;

    console.log('contribution changed', data);
    $('#btn-translate').val("Translate").attr("disabled", false);

  	update_translation_display(data);
    update_suggestions(data);

    if ($('#opt-itp, #opt-itp-ol').is(':checked')) {
      startImt(data.text);
    }
  });

  // handle post-editing (target has changed but not source)
  casmacat.on('translationchange', function(obj) {
    var data = obj.data;
    // make sure new data still applies to current source and target texts
    if (data.text !== $('#source').editable('getText')) return;
    if (data.translatedText !== $('#target').editable('getText')) return;

  	update_translation_display(data);
  });

  // handle alignment changes (updates highlighting and alignment matrix) 
  casmacat.on('alignmentchange', function(obj) {
    var data = obj.data;
    update_alignment_display(data.matrix, data.source, data.source_seg, data.target, data.target_seg);
  });

  // handle confidence changes (updates highlighting) 
  casmacat.on('confidencechange', function(obj) {
    var data = obj.data;
    var start_time = new Date().getTime();
    update_word_confidences_display(data.quality, data.word_confidences, data.source, data.source_seg, data.target, data.target_seg);
    console.log("update_word_confidences_display:", new Date().getTime() - start_time, obj.data.elapsed_time);
  });

  // handle confidence changes (updates highlighting) 
  casmacat.on('predictionchange', function(obj) {
    var data = obj.data;
    update_suggestions(data);
  });

  // measures network latency
  casmacat.on('pong', function(ms) {
    console.log("Received ping:", new Date().getTime() - ms);
  });


  // receive server configuration 
  casmacat.on('configurationchange', function(obj) {
    if (obj.config) {
      var c = obj.config;
      if (c.sentences && c.sentences.length > 0) {
        var $select = $('select#source-list');
        $select.empty();
        $('#source, #target').empty();
        $.each(c.sentences, function(index, value) {
          $select.append( $('<option value="'+value+'">'+trimText(value, 12)+'</option>') );
        });
        $('#source').text( $select.first().val() );
      }
      if (c.confidencer && c.confidencer.threshold) {
        updateSlider([c.confidencer.threshold.bad, c.confidencer.threshold.doubt]);
      }
    }
  });

  // handle updates changes (show a list of updated sentences) 
  casmacat.on('updateschange', function(obj) {
    console.log('updates:', obj.data.updates);
  });


  /*******************************************************************************/
  /*           handle UI events                                                  */
  /*******************************************************************************/

  // helper function to limit the number of server requests
  // at least throttle_ms have to pass for events to trigger 
  var throttle_ms = 50;
  var throttle = (function(){
    var timer = 0;
    return function(callback, ms){
      clearTimeout (timer);
      timer = setTimeout(callback, ms);
    };
  })();


  // #source and #target events
  // caretenter is a new event from jquery.editable that is triggered
  // whenever the caret enters in a new token span
  $('#source, #target').bind('caretenter', function(e, d) {
      $(d.token).trigger('mouseenter');
  })
  // caretleave is a new event from jquery.editable that is triggered
  // whenever the caret leaves a token span
  .bind('caretleave', function(e, d) {
      $(d.token).trigger('mouseleave');
  })
  // prevent new lines
  .keydown(function(e) {
    if (e.which === 13) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // #source events
  // on key up throttle a new translation
  $('#source').keyup(function(e) {
    var $this = $(this),
        data = $this.data('editable'),
        source = $this.editable('getText');

    if (data.str != source) { 
      throttle(function () {
        var query = {
          action: "getContribution",
          id_segment: 607906,
          text: source,
          id_job: 1135,
          num_results: 2,
          id_translator: "me!"
        }
        casmacat.translate(query);
      }, throttle_ms);
    }
  });


  var set = {};
  // caretmove is a new event from jquery.editable that is triggered
  // whenever the caret has changed position
  $('#target').bind('caretmove', function(e, d) {
    //var text = $(this).text();
    //$('#caret').html('<span class="prefix">' + text.substr(0, d.pos) + '</span>' + '<span class="suffix">' + text.substr(d.pos) + "</span>");
  })
  // on blur hide suggestions
  .blur(function(e) {
    $('#suggestions').css({'visibility': 'hidden'});
  })
  // on key up throttle a new translation
  .keyup(function(e) {
    var $this = $(this),
        data = $this.data('editable'),
        target = $this.editable('getText'),
        source = $('#source').editable('getText'),
        pos = $('#target').editable('getCaretPos');
        
    var spanElem = $('#target').editable('getTokenAtCaretPos', pos).elem.parentNode;
    set[ $(spanElem).attr("id") ] = true;

    // if key is not backspace, supr
    if ([8, 46].indexOf(e.which) === -1) {
      if (data.str != target) { 
        throttle(function () {
          var query = {
            action: "getTokens",
            id_segment: 607906,
            text: source,
            target: target,
            caret_pos: pos,
            id_job: 1135,
            num_results: 2,
            id_translator: "me!"
          }
          casmacat.getTokens(query);
          console.log("query prefix:", target);
          query.action = "getSuggestions";
          casmacat.setPrefix(query);
        }, throttle_ms);
      }
    }
  });

  $('#btn-epen').click(function(e) {
    var $this = $('img', this);
    var $epen = $('#epen');
    var $canvas = $('#drawing-canvas');
    var $target = $('#target');
    
    if ($this.data('mode') === 'epen') {
      $this.attr('src', 'images/epen.png');
      $this.data('mode', 'keyboard')
      $epen.css({ visibility: 'hidden' })
    }
    else {
      $this.attr('src', 'images/keyboard.png');
      $this.data('mode', 'epen')
      $target.blur();

      var pos = $target.offset();
      $epen.css({
        visibility: 'visible',
        top: pos.top - 50,
        height: $target.outerHeight() + 100,
        left: pos.left - 25,
        width:  $target.outerWidth() + 50,
      });

      $canvas.attr('width', $canvas.width());
      $canvas.attr('height', $canvas.height());
      $canvas.sketchable('clear');
    }
  });

  $('#btn-show-alignments').click(function(e) {
    $('#matrix').toggle();
  });
  $('#matrix').toggle();

  $('#btn-reset').click(function(e) {
    if (!window.confirm("Are you sure you want to reset the models?")) return;
    casmacat.reset();
    $('body').block({
      message: '<h2>Reseting server...</h2>',
      css: { fontSize:'150%', padding:'1% 2%', borderWidth:'3px', borderRadius:'10px', '-webkit-border-radius':'10px', '-moz-border-radius':'10px' }
    });  
  });

/*
  $('#epen').mousedown(function(e) {
    var $epen = $(this);
    var $target = $('#target');
    
    var tokens = $target.editable('getTokensAtXY', e.clientX, e.clientY);
    if (tokens.length > 0 && tokens[0].distance.d === 0) {
      var $token = $(tokens[0].token);
      var newtok = $token.clone();
      console.log($token.offset());
      console.log(newtok.offset());
      $token.fadeOut(200).fadeIn(200).fadeOut(200).fadeIn(200);
    }
  });
*/

  $('#btn-translate').click(function(e) {
    $('#target').editable('setText', "");
    var query = {
      action: "getContribution",
      id_segment: 607906,
      text: $('#source').text(),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.translate(query);
    $(this).val("Loading...").attr("disabled", true);
  });

  $('#btn-update').click(function(e) {
    $(this).val('Updating...').attr('disabled', true);
    var query = {
      action: "update",
      id_segment: 607906,
      text: $('#source').text(),
      target: $('#target').text(),
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.update(query);
  });

  $('#show-options input').change(function() {
    var show_type = $('input[@name=show]:checked').val();
    switch(show_type) {
      case 'PE':
      case 'ITP':
        $('#btn-update').attr("disabled", true);
        break;
      case 'ITP-OL':
        $('#btn-update').attr("disabled", false);
        break;
      default:
        console.warning("#show-options changed, but no action was performed");
        break;
    }
    if (!$('#target').is(':empty')) {
      casmacat.configure({suggestions:$('#opt-suggestions').is(':checked'), mode:show_type});
    }
  });

  function startImt(txt) {
    var query = {
      action: "startImtSession",
      id_segment: 607906,
      text: txt,
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }
    casmacat.startImtSession(query);
  };


  /*******************************************************************************/
  /*           update the HTML display and attach events                         */
  /*******************************************************************************/



  function update_suggestions(data) {
    var d = $('#target').editable('getCaretXY');
    var current_target = $('#target').text();
    console.log(d, data);
    
    var show_type = $('input[@name=show]:checked').val();

    var count = 0;
    var list = $('<dl/>');
    for (var i = 0; i < data.matches.length; i++) {
      var match = data.matches[i];
      if (current_target.substr(0, d.pos) === match.translation.substr(0, d.pos)) {
        if (show_type === match.created_by) {
          $('#target').editable('setText', match.translation, match.translationTokens);
      
          // requests the server for new alignment and confidence info
          source = $('#source').editable('getText')
          var query = {
            action: "getAlignments",
            id_segment: 607906,
            text: source,
            target: match.translation,
            validated_words: [],
            id_job: 1135,
            num_results: 2,
            id_translator: "me!"
          }
          if ($('#opt-alignments').is(':checked')) casmacat.getAlignments(query);
          
          query.action = "getWordConfidences";
          if ($('#opt-confidences').is(':checked')) casmacat.getWordConfidences(query);
        }
        else if ($('#opt-suggestions').is(':checked')) {
          list.append($('<dt/>').text(match.created_by));
          list.append($('<dd/>').text(match.translation.substr(d.pos)));
          count++;
        }
      }
    }

    if (count > 0 && $('#btn-epen > img').data('mode') !== 'epen') {
      //console.log(d.caretRect.bottom);
      $('#suggestions').css({'top': d.caretRect.bottom, 'left': d.caretRect.left, 'visibility': 'visible'});
      $('#suggestions').html(list);
      //$('#target').editable('setText', target, target_seg);
    }
    else { 
      $('#suggestions').css({'visibility': 'hidden'});
      $('#suggestions').html('');
    }
  }


  // updates the translation display and queries for new alignments and word confidences
  function update_translation_display(data) {
    var source = data.text
      , source_seg = data.textTokens
      , target = data.translatedText
      , target_seg = data.translatedTextTokens;

    // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
    $('#source').editable('setText', source, source_seg);
    $('#target').editable('setText', target, target_seg);

    // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
    // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
    updateTable($('#demo-table'), tokenize_by_segments(source, source_seg), tokenize_by_segments(target, target_seg));

    // requests the server for new alignment and confidence info
    var query = {
      action: "getAlignments",
      id_segment: 607906,
      text: source,
      target: target,
      validated_words: [],
      id_job: 1135,
      num_results: 2,
      id_translator: "me!"
    }

    if ($('#opt-alignments').is(':checked')) casmacat.getAlignments(query);
    
    query.action = "getWordConfidences";
    if ($('#opt-confidences').is(':checked')) casmacat.getWordConfidences(query);
  }


  // get the aligned html ids for source and target tokens
  function get_alignment_ids(alignments, sourcespans, targetspans) {
    // sourceal stores ids of target spans aligned to it
    var sourceal = new Array();
    sourceal.length = alignments.length;
    for (var c = 0; c < alignments.length; ++c) sourceal[c] = new Array();

    // targetal stores ids of source spans aligned to it
    var targetal = new Array();
    targetal.length = alignments[0].length;
    for (var v = 0; v < alignments[0].length; ++v) targetal[v] = new Array();
    
    for (var c = 0; c < alignments.length; ++c) {
      var alignment = alignments[c];          
      for (var v = 0; v < alignment.length; ++v) {
        if (alignment[v] > 0.5) {
          sourceal[c].push('#' + targetspans[v].id);
          targetal[v].push('#' + sourcespans[c].id);
        }
      }
    }
    
    return {sourceal: sourceal, targetal: targetal};	  	
  }

  // add alignment events so that aligned words are highlighted
  function add_alignment_events(spans, aligids) {
    // add mouseenter mouseleave events to token spans
    //XXX: what happens is the span had already been assigned align visualization events? 
    // many event (equal) handlers are called?
    for (var i = 0; i < spans.length; i++) {
      $(spans[i]).mouseenter(aligids[i], function (e) {
        for (var j = 0; j < e.data.length; j++) {
          $(e.data[j]).toggleClass('align', true);
        }
      });
      $(spans[i]).mouseleave(aligids[i], function (e) {
        if (this.parentNode && $(this.parentNode).is('.editable')) {
          var data = $(this.parentNode).data('editable');
          if (data.currentElement != this) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', false);
            }
          }
        }
      });
    } 
  }

  // update the alignments in the alignment matrix
  function update_aligment_matrix(alignments) {
    // update alignment matrix info
    for (var c = 0; c < alignments.length; ++c) {
      var alignment = alignments[c];          
      for (var v = 0; v < alignment.length; ++v) {
        $("#demo-table tbody tr:eq("+c+") td:eq("+v+")")
          .css('background-color', grayColor(alignment[v]));
      }        
    }
  }

  // updates the alignment display with new alignment info      
  function update_alignment_display(alignments, source, source_seg, target, target_seg) {
    // make sure new data still applies to current text
    if (!(alignments.length > 0 && alignments[0].length > 0)) return;
    if (source !== $('#source').editable('getText')) return;
    if (target !== $('#target').editable('getText')) return;

    // get span tokens 
    var sourcespans = $('#source > .editable-token');
    var targetspans = $('#target > .editable-token');
  
    var aligids = get_alignment_ids(alignments, sourcespans, targetspans);  

    // sourceal stores ids of target spans aligned to it
    var sourceal = aligids.sourceal;
    var targetal = aligids.targetal;

    // add mouseenter mouseleave events to source spans
    add_alignment_events(sourcespans, sourceal);

    // add mouseenter mouseleave events to target spans
    add_alignment_events(targetspans, targetal);

    if ($('#matrix').is(":visible")) {
      update_aligment_matrix(alignments);
    }
  }


  var confThreshold = {};
  // updates the confidence display with new confidence info      
  function update_word_confidences_display(sent, confidences, source, source_seg, target, target_seg) {
    // make sure new data still applies to current text
    if (source !== $('#source').editable('getText')) return;
    if (target !== $('#target').editable('getText')) return;

    // get target span tokens 
    var spans = $('#target > .editable-token');

    // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
    for (var c = 0; c < confidences.length; ++c) {
      var $span = $(spans[c]), conf = Math.round(confidences[c]*100)/100, cssClass;
      if (conf > confThreshold.doubt || set[$span.attr("id")]) {
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

      // also update bottom of alignment matrix with values
      $("#demo-table tfoot tr td:eq("+(c+1)+")").text(conf);
    }
  }
      
  function grayColor(num) {
    var color = 255 - Math.floor(num * 255);
    return 'rgb('+color+','+color+','+color+')'; 
  };

  function updateTable(table, src, tgt) {
    if (!$('#matrix').is(":visible")) return;
    //console.log(table);
    var src_tok = getTokens($('tbody tr', table).find('th.right:eq(0)'));
    var tgt_tok = getTokens($('thead th:gt(0)', table));

    var src_merge = merge_tokens(src_tok, src);
    var tgt_merge = merge_tokens(tgt_tok, tgt);

    var ndel = 0, nins = 0;
    for (var ml = 0; ml < src_merge.length; ml++) {
      var merge_pos  = src_merge[ml][0], 
          row        = src_merge[ml][1];
          merge_type = src_merge[ml][2];

      //console.log(merge_pos, row, merge_type);

      if (merge_type === 'D') {
        merge_pos += nins - ndel ;
        $('tbody tr:eq(' + merge_pos + ')', table).remove();
        ndel++;
      }
      else if (merge_type === 'S') {
        merge_pos += nins - ndel;
        $('tbody tr:eq(' + merge_pos + ') th', table).text(src[row]).rotateCells();
      }
      else if (merge_type === 'I') {
        var row_html =     '<tr>';
        row_html +=        '<th class="right">' + $('<span/>').text(src[row]).text() + '</th>';
        for (var t = 0; t < tgt_tok.length; ++t) {
          row_html +=      '<td>&nbsp;</td>';
        }
        row_html +=        '<th class="left">' + $('<span/>').text(src[row]).text() + '</th>';
        row_html +=      '</tr>';

        $('tbody tr:eq(' + row + ')', table).before(row_html);

        nins++;
      }
    }

    var ndel = 0, nins = 0;
    for (var ml = 0; ml < tgt_merge.length; ml++) {
      var merge_pos  = tgt_merge[ml][0], 
          col        = tgt_merge[ml][1];
          merge_type = tgt_merge[ml][2];

      if (merge_type === 'D') {
        merge_pos += nins - ndel ;
        $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).remove();
        $('tbody tr', table).not(':last').each(function () { $('td:eq(' + merge_pos + ')', this).remove();});
        //$('tfoot tr td:eq(' + (merge_pos + 1) + ')', table).remove();
        ndel++;
      }
      else if (merge_type === 'S') {
        merge_pos += nins - ndel;
        $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).text(tgt[col]).data('rotated', false);
      }
      else if (merge_type === 'I') {
        //console.log(merge_pos, col, merge_type);
        if (col === 0) {
          $('thead tr th:first, tbody tr:last th:first', table).each(function() {
            var th = $('<th class="vertical">' + tgt[col] + '</th>');
            $(this).after(th);
          });
          $('tbody tr', table).not(':last').each(function () { $('th:eq(0)', this).after('<td>&nbsp;</td>');});
          //$('tfoot tr td:first', table).after('<td></td>');
        } else {
          $('thead tr th:eq(' + col + '), tbody tr:last th:eq(' + col + ')', table).each(function() {
            var th = $('<th class="vertical">' + tgt[col] + '</th>');
            $(this).after(th);
          });
          $('tbody tr', table).not(':last').each(function () { $('td:eq(' + (col - 1) + ')', this).after('<td>&nbsp;</td>');});
          //$('tfoot tr td:eq(' + col + ')', table).after('<td></td>');
        }
        nins++;
      }
      
    }

    table.rotateCells();
  };


  $('#source').text($('#source-list').val());
  $('#source-list').change(function(e) {
    $('#source').text($('#source-list').val());
    $('#btn-translate').click();
  });

  
  var $ctrlLegend = $('#control-panel legend');
  $ctrlLegend.wrapInner('<a href="#toggle-options"/>');
  $ctrlLegend.find('a').click(function(e){
    e.preventDefault();
    toggleControlPanel();
  });


	$('#slider-conf').slider({
    range: true,
    min: 0,
    max: 100,
    values: [ 3, 30 ],
    slide: function(event, ui) {
      updateSlider(ui.values);
    }
  });
  
  function updateSlider(values) {
    if (!values) values = $('#slider-conf').slider("option", "values");
    confThreshold = {
      bad: values[0]/100,
      doubt: values[1]/100
    };
    
    $('#slider-bad').text(values[0]);
    $('#slider-doubt').text(values[1]);

    // get target span tokens 
    var spans = $('#target > .editable-token');    
    // add class to color tokens 'wordconf-ok', 'wordconf-doubt' or 'wordconf-bad'
    for (var c = 0; c < spans.length; ++c) {
      $span = $(spans[c]);
      $span.removeClass('wordconf-ok wordconf-doubt wordconf-bad');
      var conf = $span.data('confidence');
      if (conf) {
        var cssClass;
        if (conf > confThreshold.doubt || set[$span.attr("id")]) {
          cssClass = 'wordconf-ok';
        }
        else if (conf > confThreshold.bad) {
          cssClass = 'wordconf-doubt';
        }
        else {
          cssClass = 'wordconf-bad';
        }
        $(spans[c]).addClass(cssClass);
      }
    }            
  };

  updateSlider();
  
  
  function toggleControlPanel() {
    var $options = $('#options'), $summary = $('#options-summary');
    $options.toggle();
    if (!$options.is(':visible')) {
      makeControlPanelSummary();
      $summary.show();
    } else {
      $summary.hide();
    }
  };
  
  function makeControlPanelSummary() {
    $('#set-mode').text( $('#show-options input[@name=show]:checked').val() );
    $('#set-suggestions').text( $('#opt-suggestions').is(':checked') );
    $('#set-confidences').text( $('#opt-confidences').is(':checked') + " ["+ confThreshold.bad*100 + "/"+ confThreshold.doubt*100 +"]" );
    $('#set-alignments').text( $('#opt-alignments').is(':checked') + " [matrix: "+ $('#matrix').is(':visible') +"]" );
  };
  
  toggleControlPanel();
  
  casmacat.ping(new Date().getTime());
  casmacat.getServerConfig();

  function trimText(text, numWords, delimiter) {
    if (!numWords)  numWords  = 5;
    if (!delimiter) delimiter = " ";    
    
    var words = text.split(delimiter), trimmed = "";
    for (var i = 0; i < words.length; ++i) {
      if (i < numWords) {
        trimmed += words[i] + delimiter;
      } else break;
    }
    if (i >= numWords) {
      trimmed += delimiter + "[...]"; 
    }

    return trimmed;
  }
  
});
