<?php 
if (empty($_GET['itp-server'])) die('No server set: <a href="?itp-server='.$_SERVER['SERVER_NAME'].':3019&htr-server='.$_SERVER['SERVER_NAME'].':3003">try this example</a>');

// Helper function(s) FIXME: include from external file
function trim_text($text, $words = 5) 
{
  $space = " ";  
  $text = explode($space, $text);
  $show = "";
  foreach ($text as $i => $str) {
    if ($i < $words) { 
      $show .= $str.$space; 
    }
  }
  if ($i >= $words) {
    $show .= $space."[...]"; 
  }

  return $show;
}
?>
<!DOCTYPE html>
<html debug="true"><!-- debug for Firebug -->
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> 
  <title>CASMACAT demo</title>
  <link rel="stylesheet" type="text/css" media="screen,projection" href="css/index.css">
  <link rel="stylesheet" href="http://code.jquery.com/ui/1.9.1/themes/base/jquery-ui.css" />
  <!--<script type="text/javascript" src="https://getfirebug.com/firebug-lite.js"></script>-->
  <script type="text/javascript" src="js/console.js"></script>
  <script type="text/javascript">
  var casmacat = {
    itpServer: "<?=$_GET['itp-server']?>",
    htrServer: "<?=$_GET['htr-server']?>",
  }
  </script>
  <script type="text/javascript" data-main="js/" src="js/require.min.js"></script>
  <script type="text/javascript" src="js/jquery.min.js"></script>
  <script type="text/javascript" src="js/jquery-ui.min.js"></script>
  <script type="text/javascript" src="js/jquery.blockUI.js"></script>
  <script type="text/javascript" src="js/socket.io.js"></script>
  <script type="text/javascript" src="js/catclient.js"></script>
  <script type="text/javascript" src="js/predictivecatclient.js"></script>
  <?php if (!empty($_GET['htr-server'])) { ?>
    <script type="text/javascript" src="js/htrclient.js"></script>
    <script type="text/javascript" src="js/htr.js?<?=time()?>"></script>
    <script type="text/javascript" src="js/mg-recognizer.js?<?=time()?>"></script>
  <?php } ?>  
  <script type="text/javascript" src="js/index.js?<?=time()?>"></script>
</head>
<body spellcheck="false">

<div id="global">
  <h1 id="title">CasMaCat API demo</h1>

  <fieldset id="control-panel">  
    <legend>Options</legend>
    <div id="options-summary">
      <p class="inline ml">
        Mode: <strong id="set-mode">none</strong>.
        Suggestions: <strong id="set-suggestions">none</strong>.
        Confidences: <strong id="set-confidences">none</strong>.
        Alignments: <strong id="set-alignments">none</strong>.
      </p>
    </div>
    <div id="options">

      <div class="control-panel-row">
        <form id="show-options">
          <label for="opt-pe">Operation mode:</label>
          <input type="radio" name="show" id="opt-pe" value="PE" /> Post-editing (no suffix update)
          <input type="radio" name="show" id="opt-itp" value="ITP" checked="checked" /> ITP (predictive)
          <input type="radio" name="show" id="opt-itp-ol" value="ITP-OL" /> ITP-OL (online learning)
        <div class="block mt">
          <label for="opt-prioritizer">Suggestion length:</label><select name="prioritizer" id="opt-prioritizer"><option value="none">None</option></select> 
          <input type="checkbox" id="opt-suggestions" /> <label for="opt-suggestions">Display suggestions</label>
          <input type="checkbox" id="opt-confidences" checked="checked" /> <label for="opt-confidences">Display confidences</label>
        </div>
        </form>
        <!--div id="caret">undef</div-->
      </div>
      
      <div class="control-panel-row clear mt">
        <div class="control-panel-col fl vtop">
        	<div class="clear" id="conf-thresholds">
          	<p>
          	  <label>Confidence thresholds:</label> 
            	<span id="slider-bad"></span>/<span id="slider-doubt"></span>
          	</p>
            <div id="slider-conf"></div>
          	</p>
        	</div>
        </div>
        <div class="control-panel-col fl vtop">
        	<div class="clear" id="conf-priority">
          	<p>
          	  <label>Priority:</label>
          	  <span id="slider-priority-text"></span></span>
          	</p>
            <div id="slider-priority"></div>
          	</p>
        	</div>
        </div>
        <br class="clear" />
      </div>
      
      <div class="control-panel-row mt">
        <div class="inline">
        	<button title="Toggle alignment matrix visualization" id="btn-alignments"><img src="images/matrix.png"/></button>
          <?php if (!empty($_GET['htr-server'])) { ?>
        	<button title="Toggle e-pen interaction" id="btn-epen"><img src="images/epen.png"/></button> 
          <?php } ?>
          <button title="Display updated sentences" id="btn-updatedsentences"><img src="images/list.png"/></button>
          <button title="Reset servers" id="btn-reset"><img src="images/reset.png"/></button>
        </div>
      </div>
      
    </div>
  </fieldset>
  
  <div>  
    <label for="source-list">Source:</label>
    <select id="source-list">
      <?php 
        $selected_sentences = array(
          "* participación de los países candidatos en los programas comunitarios .",
          "queda claro que la sentencia Bosman tiene consecuencias no solo para el fútbol , sino también para otros deportes en los que el jugador sea asalariado",
          "la responsabilidad de la Comisión radica , ante todo , en comprobar la eficacia de los sistemas de control .",
          "no obstante , las autoridades de los demás Estados miembros deben colaborar con los países exportadores para detectar y reprimir las irregularidades que se cometan .",
          "* razones objetivas que justifiquen la renovación de tales contratos o relaciones de trabajo ;",
          "la renta imponible es la que corresponde a un ejercicio fiscal ( que coincide con el año natural ) .",
          "esta comunicación se inscribe en el marco del procedimiento de información de la autoridad presupuestaria sobre la ejecución del presupuesto del ejercicio en curso .",
          "acuerdo de asociación y cooperación con Kazajistán : adopción de una decisión .",
          "Balcanes Occidentales . políticas dirigidas a la República Federativa de Yugoslavia y Montenegro : adopción de conclusiones .",
          "ayuda humanitaria / alimentaria de urgencia en favor de las poblaciones vulnerables afectadas por la sequía en Etiopía",
          "Informe de la Comisión sobre la viabilidad de negociar un Acuerdo de Estabilización y Asociación con Croacia ."
        );
        //$selected_sentences = array(
        //  "* participación de los países candidatos en los programas comunitarios .",
        //  "queda claro que la sentencia Bosman tiene consecuencias no solo para el fútbol , sino también para otros deportes en los que el jugador sea asalariado",
        //  "la responsabilidad de la Comisión radica , ante todo , en comprobar la eficacia de los sistemas de control .",
        //  "no obstante , las autoridades de los demás Estados miembros deben colaborar con los países exportadores para detectar y reprimir las irregularidades que se cometan .",
        //  "* razones objetivas que justifiquen la renovación de tales contratos o relaciones de trabajo ;",
        //  "la renta imponible es la que corresponde a un ejercicio fiscal ( que coincide con el año natural ) .",
        //  "esta comunicación se inscribe en el marco del procedimiento de información de la autoridad presupuestaria sobre la ejecución del presupuesto del ejercicio en curso , instaurado en _NUMBER .",
        //  "acuerdo de asociación y cooperación con Kazajistán : adopción de una decisión ( - > punto _NUMBER ) .",
        //  "Balcanes Occidentales . políticas dirigidas a la República Federativa de Yugoslavia y Montenegro : adopción de conclusiones . Balcanes Occidentales .",
        //  "ayuda humanitaria / alimentaria de urgencia en favor de las poblaciones vulnerables afectadas por la sequía en Etiopía",
        //  "_NUMBER Informe de la Comisión sobre la viabilidad de negociar un Acuerdo de Estabilización y Asociación con Croacia ."
        //);
        //  "Establecimiento de propiedades del historial 5-4",
        //  "La Utilidad de administración de fuentes es una herramienta que sirve para mantener las fuentes de las impresoras de red .",
        //  "1 Introduzca el CD de Controladores de impresión y fax de CentreWare en la unidad correspondiente .",
        //  "Para desinstalar la utilidad :",
        //  "Puede seleccionar varias fuentes .",
        foreach($selected_sentences as $sentence) {
          echo '<option value="'.$sentence.'">'.trim_text($sentence, 12).'</option>'.PHP_EOL;
        }
      ?>
    </select> 
    
    <input type="button" id="btn-translate" value="Translate" />
    <input type="button" id="btn-update" value="Update" disabled="disabled" />
    
    <div id="source" class="editable"></div>
  </div>

  <!--<label for="target">Target:</label>-->
  <div id="target" class="editable epen"></div>

  <div id="updatedsentences"></div>
         
  <div id="matrix">
    <table cellpadding="10" id="demo-table">
      <thead> <tr class="bottom"><th></th></tr> </thead>
      <!--<tfoot> <tr><td>word conf:</td></tr> </tfoot>-->
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
  <div id="info"></div>

  <br/><br/><!-- HTR Canvas is absolute positioned -->
  
</div><!-- #global -->

</body>
</html>
