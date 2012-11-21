<?php if (empty($_GET['server'])) die('No server set: <a href="?server='.$_SERVER['SERVER_NAME'].':3019&htr-server='.$_SERVER['SERVER_NAME'].':3003">try this example</a>'); ?>
<!DOCTYPE html>
<html debug="true">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> 
  <title>CASMACAT demo</title>
  <link rel="stylesheet" type="text/css" media="screen,projection" href="css/nouislider.css">
  <link rel="stylesheet" type="text/css" media="screen,projection" href="css/index.css">
  <!--<script type="text/javascript" src="https://getfirebug.com/firebug-lite.js"></script>-->
  <script type="text/javascript" src="js/console.js"></script>
  <script type="text/javascript">
  window.casmacatServer = "<?=$_GET['server']?>";
  window.casmacatHtrServer = "<?=$_GET['htr-server']?>";
  </script>
  <script type="text/javascript" src="js/jquery.js"></script>
  <script type="text/javascript" src="js/jquery.rotatecells.js"></script>
  <script type="text/javascript" src="js/jquery.editable.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/socket.io.js"></script>
  <script type="text/javascript" src="js/casmacat.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/jquery.nouislider.min.js"></script>
  <script type="text/javascript" src="js/index.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/jsketch.js"></script>
  <script type="text/javascript" src="js/jquery.sketchable.js"></script>
  <script type="text/javascript" src="js/htr.js?<?=time()?>"></script>
</head>
<body>
  <div id="options">
  	<div>Confidence thresholds: <span id="slider-bad"></span>/<span id="slider-doubt"></span></div> 
  	<div id="slider-conf" class="noUiSlider"></div>
  	<button title="toggle alignment matrix visualization" id="btn-show-alignments"><img src="images/matrix.png"/></button>
  	<button title="toggle e-pen interaction" id="btn-epen"><img src="images/epen.png"/></button> 
  	<button title="reset servers" id="btn-reset">reset</button> 
  </div>
  <h3>CasMaCat API demo</h3>
  <div>
    Source:
    <select id="source-list">
    	<option>Establecimiento de propiedades del historial 5-4</option>
    	<option>La Utilidad de administración de fuentes es una herramienta que sirve para mantener las fuentes de las impresoras de red .</option>
    	<option>1 Introduzca el CD de Controladores de impresión y fax de CentreWare en la unidad correspondiente .</option>
    	<option>Para desinstalar la utilidad :</option>
    	<option>Puede seleccionar varias fuentes .</option>
    </select> 
    <div id="source" class="editable"></div>
    <!-- If a particular capability is not available in your network environment , the option will not appear in the dialog . --> 
    <!-- servicios de red de CasMaCat -->
    <input type="button" id="btn-translate" value="Translate"/>
  </div>
  <div>
    Target. Select mode of operation: 
    <form id="show-options">
      <input type="radio" name="show" value="list" checked> Post-editing (no suffix update)
      <input type="radio" name="show" value="ITP"> ITP
      <input type="radio" name="show" value="ITP-OL"> ITP-OL (online learning) 
    </form> 
    <div id="target" class="editable epen"></div>
    <input type="button" id="btn-update" value="Update models"/>
    <input type="button" id="btn-set-translation" value="Set translation" disabled="true" class="hidden"/>
  </div>
  <!--div id="caret">undef</div-->
  <div id="matrix">
    <table cellpadding="10" id="demo-table">
      <thead> <tr class="bottom"><th></th></tr> </thead>
      <tfoot> <tr><td>word conf:</td></tr> </tfoot>
      <tbody> <tr class="top noborderright"><th></th></tr> </tbody>
    </table>
  </div>
  <div id="suggestions"></div>
  <div id="hidden"></div>
  <div id="epen">
    <canvas id="drawing-canvas"></canvas>
    <div id="htr-suggestions"></div>
    <button id="btn-decode">Decode</button>
	<button id="btn-clear">Clear</button>
    <img src="images/drawhere.png" class="drawhere" alt="Draw here!" />
  </div>
</body>
</html>
