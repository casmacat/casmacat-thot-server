%module(directors="1") casmacat 

%{
#define SWIG_FILE_WITH_INIT
#include <casmacat/Context.h>
#include <casmacat/IAlignmentEngine.h>
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/IMtEngine.h>
#include <casmacat/IImtEngine.h>
#include <casmacat/IHtrEngine.h>
#include <casmacat/ITextProcessor.h>
#include <casmacat/Plugin.h>
#include <casmacat/Logger.h>
using namespace casmacat;

%}



%include <typemaps.i>
%include <stl.i>
%include "extra_typemaps.i"
%include <std_pair.i>
%include <std_string.i>
%include <std_vector.i>

using namespace std;


// We have to specify the name of the variable used in the method getConfigData for
// this typemap to work correctly
%RefOutputStringVector( tokenized_out );
%RefOutputString( detokenized_out );
%RefOutputSegmentation( segmentation_out );
%RefOutputFloatVector( confidences_out );
%RefOutputFloatMatrix( alignments_out );
%RefOutputStringVector( target_out );
%RefOutputStringVector( corrected_suffix_out );
%RefOutputStringVector( corrected_translation_out );
%RefOutputBoolVector( corrected_validated_out );


// generate directors for all virtual methods in class Logger
%feature("director") casmacat::Logger;

%newobject create_context;
%inline %{
casmacat::Context *create_context() { return new casmacat::Context(); };
%}


%feature("compactdefaultargs") *::create;
%newobject *::create;
%feature("compactdefaultargs") *::createStringArgs;
%newobject *::createStringArgs;
%feature("compactdefaultargs") *::createInstance;
%newobject *::createInstance;


// the directors must be parsed before they are used by others
%include <casmacat/Context.h>
%include <casmacat/Logger.h>
%include <casmacat/IPluginFactory.h>
%include <casmacat/IAlignmentEngine.h>
%include <casmacat/IConfidenceEngine.h>
%include <casmacat/IMtEngine.h>
%include <casmacat/IImtEngine.h>
%include <casmacat/IHtrEngine.h>
%include <casmacat/ITextProcessor.h>
%include <casmacat/Plugin.h>


namespace casmacat {
  %template(IAlignmentFactory)           IPluginFactory<IAlignmentEngine>;
  %template(IConfidenceFactory)          IPluginFactory<IConfidenceEngine>;
  %template(ITextProcessorFactory)       IPluginFactory<ITextProcessor>;
  %template(IMtFactory)                  IPluginFactory<IMtEngine>;
  %template(IInteractiveMtFactory)       IPluginFactory<IInteractiveMtEngine>;
  %template(AlignmentPlugin)             Plugin<IAlignmentFactory>;
  %template(ConfidencePlugin)            Plugin<IConfidenceFactory>;
  %template(TextProcessorPlugin)         Plugin<ITextProcessorFactory>;
  %template(MtPlugin)                    Plugin<IMtFactory>;
  %template(ImtPlugin)                   Plugin<IInteractiveMtFactory>;
  %template(HtrPlugin)                   Plugin<IHtrFactory>;
}

