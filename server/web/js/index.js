$(function(){

      // connect to a server. casmacat will receive async server responses
      var casmacat = new CasmacatClient('http://' + window.casmacatServer + '/casmacat');

      // handle disconections and debug information
      casmacat.on('disconnect', function(){ this.socket.reconnect(); });
      casmacat.on('receive_log', function(msg) { 
        var txt = $('textarea');
        txt.val(txt.val() + "\n" + msg);
      });

      // handle translation responses
      casmacat.on('translate_async', function(source, source_seg, target, target_seg) {
        // if the source has changed ignore the results
        if (source !== $('#source').editable('getText')) return;

        // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
        $('#source').editable('setText', source, source_seg);
        $('#target').editable('setText', target, target_seg);


        // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
        // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
        updateTable($('#demo-table'), tokenize_by_segments(source, source_seg), tokenize_by_segments(target, target_seg));

        // requests the server for new alignment and confidence info
        casmacat.getAlignments(source, target);
        casmacat.getWordConfidences(source, target, []);
      });

      // handle post-editing (target has changed but not source)
      casmacat.on('get_tokens_async', function(source, source_seg, target, target_seg) {
        // make sure new data still applies to current source and target texts
        if (source !== $('#source').editable('getText')) return;
        if (target !== $('#target').editable('getText')) return;

        // sets the text in the editable div. It tokenizes the sentence and wraps tokens in spans
        $('#source').editable('setText', source, source_seg);
        $('#target').editable('setText', target, target_seg);

        // resizes the alignment matrix in a smoothed manner but it does not fill missing alignments 
        // (makes a diff between previous and current tokens and inserts/replaces/deletes columns and rows)
        updateTable($('#demo-table'), tokenize_by_segments(source, source_seg), tokenize_by_segments(target, target_seg));

        // requests the server for new alignment and confidence info
        casmacat.getAlignments(source, target);
        casmacat.getWordConfidences(source, target, []);
      });

      // handle alignment changes (updates highlighting and alignment matrix) 
      casmacat.on('get_alignments_async', function(alignments, source, source_seg, target, target_seg) {
        // make sure new data still applies to current text
        if (!(alignments.length > 0 && alignments[0].length > 0)) return;
        if (source !== $('#source').editable('getText')) return;
        if (target !== $('#target').editable('getText')) return;

        // get span tokens 
        var sourcespans = $('#source > .editable-token');
        var targetspans = $('#target > .editable-token');
        
        // sourceal stores ids of target spans aligned to it
        var sourceal = new Array();
        sourceal.length = alignments.length;
        // targetal stores ids of source spans aligned to it
        var targetal = new Array();
        targetal.length = alignments[0].length;
        for (var c = 0; c < alignments.length; ++c) {
          var alignment = alignments[c];          
          for (var v = 0; v < alignment.length; ++v) {
            if (!sourceal[c]) sourceal[c] = new Array();
            if (!targetal[v]) targetal[v] = new Array();

            if (alignment[v] > 0.5) {
              sourceal[c].push('#' + targetspans[v].id);
              targetal[v].push('#' + sourcespans[c].id);
            }
          }
        }

        // add mouseenter mouseleave events to source spans
        //XXX: what happens is the span is not new? many event (equal) handlers are called?
        for (var i = 0; i < sourcespans.length; i++) {
          $(sourcespans[i]).mouseenter(sourceal[i], function (e) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', true);
            }
          });
          $(sourcespans[i]).mouseleave(sourceal[i], function (e) {
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

        // add mouseenter mouseleave events to target spans
        //XXX: what happens is the span is not new? many event (equal) handlers are called?
        for (var i = 0; i < targetspans.length; i++) {
          $(targetspans[i]).mouseenter(targetal[i], function (e) {
            for (var j = 0; j < e.data.length; j++) {
              $(e.data[j]).toggleClass('align', true);
            }
          });
          $(targetspans[i]).mouseleave(targetal[i], function (e) {
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

        // update alignment matrix info
        for (var c = 0; c < alignments.length; ++c) {
          var alignment = alignments[c];          
          for (var v = 0; v < alignment.length; ++v) {
            $("#demo-table tbody tr:eq("+c+") td:eq("+v+")")
              .css('background-color', grayColor(alignment[v]));
          }        
        }
      });

      // handle confidence changes (updates highlighting) 
      casmacat.on('get_word_confidences_async', function(sent, confidences, source, source_seg, target, target_seg) {
        // make sure new data still applies to current text
        if (source !== $('#source').editable('getText')) return;
        if (target !== $('#target').editable('getText')) return;

        // get target span tokens 
        var spans = $('#target > .editable-token');

        // add class to color tokens 'wordconf-ok' or 'wordconf-bad'
        for (var c = 0; c < confidences.length; ++c) {
          
          var conf = Math.round(confidences[c]*100)/100;
          var cssClass = "wordconf-" + (conf > 0.5 ? "ok" : "bad");
          var noCssClass = "wordconf-" + (conf <= 0.5 ? "ok" : "bad");

          $(spans[c]).addClass(cssClass);
          $(spans[c]).removeClass(noCssClass);

          // also update bottom of alignment matrix with values
          $("#demo-table tfoot tr td:eq("+(c+1)+")").text(conf);
        }
      });

      // helper function to limit the number of changes made
      var throttle = (function(){
        var timer = 0;
        return function(callback, ms){
          clearTimeout (timer);
          timer = setTimeout(callback, ms);
        };
      })();


      // #source events
      $('#source').keydown(function(e) {
        if (e.which == 13) {
          casmacat.translate($(this).text());
          e.stopPropagation();
          e.preventDefault();
        }
      })
      .keyup(function(e) {
        throttle(function () {
          casmacat.translate($(this).text());
        }, 50);
      });

      $('#source, #target').bind('caretenter', function(e, d) {
          $(d.token).trigger('mouseenter');
      })
      .bind('caretleave', function(e, d) {
          $(d.token).trigger('mouseleave');
      })
      .keyup(function(e) {
        var $this = $(this),
            data = $this.data('editable'),
            str = $this.editable('getText');

        if (data.str != str) { 
          throttle(function () {
            casmacat.getTokens($('#source').text(), $('#target').text());
          }, 50);
        }
      });
      //.bind('blur', function(e) {
      //    $('.editable-token').trigger('mouseleave');
      //});



      $('#target').bind('caretmove', function(e, d) {
        var text = $(this).text();
        $('#caret').html('<span class="prefix">' + text.substr(0, d.pos) + '</span>' + '<span class="suffix">' + text.substr(d.pos) + "</span>");
      })
      .keydown(function(e) {
        if (e.which == 13) {
          casmacat.getTokens($('#source').text(), $('#target').text());
          e.stopPropagation();
          e.preventDefault();
        }
      });



      $('#btn-translate').click(function() {
        casmacat.translate($('#source').text());
      });

      $('#btn-set-translation').click(function() {
        casmacat.getTokens($('#source').text(), $('#target').text());
      });

      function grayColor(num) {
        var color = 255 - Math.floor(num * 255);
        return 'rgb('+color+','+color+','+color+')'; 
      };

      function updateTable(table, src, tgt) {
        //console.log(table);
        var src_tok = getTokens($('tbody tr', table).find('th.right:eq(0)'));
        var tgt_tok = getTokens($('thead th:gt(0)', table));

        var src_merge = merge_tokens(src_tok, src);
        var tgt_merge = merge_tokens(tgt_tok, tgt);

        //console.log("src", src);
        //console.log("tgt", tgt);
        //console.log("osrc", src_tok);
        //console.log("otgt", tgt_tok);
        //console.log("merge src", merge_tokens(src_tok, src));
        //console.log("merge tgt", merge_tokens(tgt_tok, tgt));

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

          if (merge_type == 'D') {
            merge_pos += nins - ndel ;
            $('thead tr th:eq(' + (merge_pos + 1) + '), tbody tr:last th:eq(' + (merge_pos + 1) + ')', table).remove();
            $('tbody tr', table).not(':last').each(function () { $('td:eq(' + merge_pos + ')', this).remove();});
            $('tfoot tr td:eq(' + (merge_pos + 1) + ')', table).remove();
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
              $('tfoot tr td:first', table).after('<td></td>');
            } else {
              $('thead tr th:eq(' + col + '), tbody tr:last th:eq(' + col + ')', table).each(function() {
                var th = $('<th class="vertical">' + tgt[col] + '</th>');
                $(this).after(th);
              });
              $('tbody tr', table).not(':last').each(function () { $('td:eq(' + (col - 1) + ')', this).after('<td>&nbsp;</td>');});
              $('tfoot tr td:eq(' + col + ')', table).after('<td></td>');
            }
            nins++;
          }
          
        }

        table.rotateCells();
      };
  
});
