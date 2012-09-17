%module casmacat 

%{
#define SWIG_FILE_WITH_INIT
#include <casmacat/IAlignmentEngine.h>
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/IMtEngine.h>
#include <casmacat/IImtEngine.h>
#include <casmacat/ITextProcessor.h>
#include <casmacat/Plugin.h>
using namespace casmacat;

%}



%include <typemaps.i>
%include <stl.i>
%include <std_string.i>
%include <std_vector.i>

using namespace std;

typedef unsigned int uint32_t;

%template(StringVector) std::vector<std::string>;
%template(FloatVector)  std::vector<float>;
%template(BoolVector)   std::vector<bool>;

%include <casmacat/IAlignmentEngine.h>
%include <casmacat/IConfidenceEngine.h>
%include <casmacat/IMtEngine.h>
%include <casmacat/IImtEngine.h>
%include <casmacat/ITextProcessor.h>
%include <casmacat/Plugin.h>

namespace casmacat {
  %template(AlignmentPlugin)             Plugin<IAlignmentFactory>;
  %template(ConfidencePlugin)            Plugin<IConfidenceFactory>;
  %template(TextProcessorPlugin)         Plugin<ITextProcessorFactory>;
  %template(MtPlugin)                    Plugin<IMtEngine>;
  %template(ImtPlugin)                   Plugin<IImtEngine>;
}


