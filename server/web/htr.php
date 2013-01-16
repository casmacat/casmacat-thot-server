<?php if (empty($_GET['server'])) die('No server set: <a href="?server='.$_SERVER['SERVER_NAME'].':3011">try this example</a>'); ?>
<!DOCTYPE html>
<html debug="true">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> 
  <title>CASMACAT HTR demo</title>
  <link rel="stylesheet" type="text/css" media="screen,projection" href="css/htr.css">
  <!--<script type="text/javascript" src="https://getfirebug.com/firebug-lite.js"></script>-->
  <script type="text/javascript">
  window.casmacatHtrServer = "<?=$_GET['server']?>";
  </script>
  <script type="text/javascript" src="js/jquery.js"></script>
  <script type="text/javascript" src="js/jquery.sketchable.js"></script>
  <script type="text/javascript" src="js/jsketch.js"></script>
  <script type="text/javascript" src="js/jquery.editable.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/socket.io.js"></script>
  <script type="text/javascript" src="js/casmacat.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/mg-recognizer.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/htr-index.js?<?=time()?>"></script>
</head>
<body>
<h3>CasMaCat API proof of concept - HTR</h3>
<p>
  Draw something in the canvas and click on <em>Decode</em>. The initial and final coordinates of the strokes will be displayed below the canvas. 
</p>
<form>
  Source: 
  <canvas id="drawing-canvas" style="vertical-align: middle; border: 1px solid black" width="1024" height="300"></canvas>
  <input type="button" id="btn-decode" value="Decode" />
  <input type="button" id="btn-clear" value="Clear" />
</form> 
<div id="htr-suggestions"></div>
</body>
</html>
