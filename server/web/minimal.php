<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> 
  <title>CASMACAT demo</title>
  <script type="text/javascript" src="js/require.node.js"></script>
  <script type="text/javascript" src="js/jquery.min.js"></script>
  <script type="text/javascript" src="js/jquery.editable.itp.js"></script>
  <script type="text/javascript">
  $(function(){
    var $target;
    $('#select-1, #select-2').click(function (ev) {
      var $this = $(this);

      if ($target) $target.editableItp('destroy');
      $target = $('#target-' + $this.data('target'));

      $target.on('ready', function() { 
        if ($target.text().length === 0) $target.editableItp('decode'); 
        $target.editableItp('startSession'); 
      })
      .editableItp({
        debug: true,
        sourceSelector: '#source-' + $this.data('target'),
        itpServerUrl:   "http://cat.iti.upv.es:3019/casmacat"
      });
    });
  });
  </script>
  <style type="text/css">
  .source, .target { padding:1em; margin:1em; }
  .source { border:1px solid red; }
  .target { border:1px solid blue; }
  .wordconf-ok { color: inherit; }
  .wordconf-doubt { color: darkorange; }
  .wordconf-bad { color: red; }
  .mouse-align { background-color: yellow; }
  .caret-align { background-color: aquamarine; }
  </style>
</head>

<body spellcheck="false">
  <div id="source-1" class="source">queda claro que la sentencia Bosman tiene consecuencias no solo para el fútbol, sino también para otros deportes en los que el jugador sea asalariado.</div>
  <div id="target-1" class="target"></div>
  <button id="select-1" data-target="1">Select 1</button>

  <div id="source-2" class="source">* participación de los países candidatos en los programas comunitarios.</div>
  <div id="target-2" class="target"></div>
  <button id="select-2" data-target="2">Select 2</button>
</body>

</html>

