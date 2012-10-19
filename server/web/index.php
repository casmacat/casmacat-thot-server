<?php if (empty($_GET['server'])) die('No server set: <a href="?server='.$_SERVER['SERVER_NAME'].':3019">try this example</a>'); ?>
<!DOCTYPE html>
<html debug="true">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> 
  <title>CASMACAT demo</title>
  <link rel="stylesheet" type="text/css" media="screen,projection" href="css/index.css">
  <!--<script type="text/javascript" src="https://getfirebug.com/firebug-lite.js"></script>-->
  <script type="text/javascript">
  window.casmacatServer = "<?=$_GET['server']?>";
  </script>
  <script type="text/javascript" src="js/jquery.js"></script>
  <script type="text/javascript" src="js/jquery.rotatecells.js"></script>
  <script type="text/javascript" src="js/jquery.editable.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/socket.io.js"></script>
  <script type="text/javascript" src="js/casmacat.js?<?=time()?>"></script>
  <script type="text/javascript" src="js/index.js?<?=time()?>"></script>
</head>
<body>
  <h3>CasMaCat API demo</h3>
  <div>
    Source: 
    <div id="source" class="editable">servicios de red de CasMaCat</div>
    <input type="button" id="btn-translate" value="Translate"/>
  </div>
  <div>
    Target: 
    <div id="target" class="editable"></div>
    <input type="button" id="btn-set-translation" value="Set translation" disabled="true" class="hidden"/>
  </div>
  <div id="caret">undef</div>
  <div id="matrix">
    <table cellpadding="10" id="demo-table">
      <thead> <tr class="bottom"><th></th></tr> </thead>
      <tfoot> <tr><td>word conf:</td></tr> </tfoot>
      <tbody> <tr class="top noborderright"><th></th></tr> </tbody>
    </table>
  </div>
  <div id="hidden"/>
</body>
</html>
