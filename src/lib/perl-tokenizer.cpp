/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * perl-tokenizer.cpp
 *
 *  Created on: 14/09/2012
 *      Author: valabau
 */

#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <EXTERN.h>
#include <perl.h>
#include <XSUB.h>

#include <casmacat/config.h>
#include <casmacat/ITextProcessor.h>
#include <casmacat/plugin-utils.h>
#include <casmacat/utils.h>

#include "third-party/utf8/utf8.h"

using namespace std;
using namespace casmacat;

extern "C" {
void boot_DynaLoader(pTHX_ CV* cv);

static void xs_init (pTHX);
void xs_init(pTHX) {
  const char *file = __FILE__;
  dXSUB_SYS;

  /* DynaLoader is a special case */
  newXS("DynaLoader::boot_DynaLoader", boot_DynaLoader, file);
}
}

/* Use break permitted here in perl scripts to mark where string should be tokenized
 * Character: Non-printable U+0082
 * Name: <control>
 * Annotations and Cross References
 * Alias names:
 * BREAK PERMITTED HERE
 */

class PerlTokenizer: public ITextProcessor {
  static size_t _num_perl_plugin_instances;
  PerlInterpreter *vm;
  string script_fn;
  string delimiters;
  string tokenize_fn, detokenize_fn;
  string preprocess_fn, postprocess_fn;
  
public:
  PerlTokenizer(int argc, char** argv): vm(0), 
    delimiters(" "), 
    tokenize_fn("tokenize"), detokenize_fn("detokenize"), 
    preprocess_fn("preprocess"), postprocess_fn("postprocess") 
  {
    if (_num_perl_plugin_instances == 0) {
      int empty_argc = 1;
      const char *empty_argv[] = { "", 0 };
      PERL_SYS_INIT(&empty_argc, (char ***)&empty_argv);
    }

    vm = perl_alloc();
    perl_construct(vm);
    PL_perl_destruct_level = 1;
    PL_exit_flags |= PERL_EXIT_DESTRUCT_END;

    perl_parse(vm, xs_init, argc, argv, 0);
    perl_run(vm);

    _num_perl_plugin_instances++;
  }

  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~PerlTokenizer() { 
    perl_destruct(vm);
    perl_free(vm);
    vm = 0;

    _num_perl_plugin_instances--;
    if (_num_perl_plugin_instances == 0) {
      PERL_SYS_TERM();
    }
  }


  void call(const string& function, const string& input, string& output) {
    PERL_SET_CONTEXT(vm);
    dSP;                            /* initialize stack pointer      */
    ENTER;                          /* everything created after here */
    SAVETMPS;                       /* ...is a temporary variable.   */
    PUSHMARK(sp);                   /* remember the stack pointer    */
    XPUSHs(sv_2mortal(newSVpvn_utf8(input.c_str(), input.size(), true))); /* push the base onto the stack  */
    PUTBACK;                      /* make local stack pointer global */
    perl_call_pv(function.c_str(), G_SCALAR); /* call the function             */
    SPAGAIN;                        /* refresh stack pointer         */
                                    /* pop the return value from stack */
    output = string(POPp);
    PUTBACK;
    FREETMPS;                       /* free that return value        */
    LEAVE;                          /* ...and the XPUSHed "mortal" args.*/
  }

  void tokenize(const string& input, string& output) {
    call(tokenize_fn, input, output);
  }

  void detokenize(const string& input, string& output) {
    call(detokenize_fn, input, output);
  }

  void preprocess(const string& input, string& output) {
    call(preprocess_fn, input, output);
  }

  void postprocess(const string& input, string& output) {
    call(postprocess_fn, input, output);
  }

  size_t match_segmentation(const std::string &detokenized,
                            const std::string &tokenized,
                                  std::vector< std::pair<size_t, size_t> > &segmentation_out)
  {
    vector<utf8::uint32_t> utf32_detokenized;
    utf8::utf8to32(detokenized.begin(), detokenized.end(), back_inserter(utf32_detokenized));
    vector<utf8::uint32_t>::const_iterator dit = utf32_detokenized.begin();

    vector<utf8::uint32_t> utf32_tokenized;
    utf8::utf8to32(tokenized.begin(), tokenized.end(), back_inserter(utf32_tokenized));
    vector<utf8::uint32_t>::const_iterator tit = utf32_tokenized.begin();

    size_t last_pos = 0;
    size_t pos = 0;

    // eat up heading spaces
    while (dit != utf32_detokenized.end() and *dit == ' ') { ++dit; pos++; }
    while (tit != utf32_tokenized.end() and *tit == ' ')   { ++tit; }

    bool done = false;
    segmentation_out.clear();
    while (not done) {

      // find next space in tokenized
      last_pos = pos;
      while (dit != utf32_detokenized.end() and tit != utf32_tokenized.end() and *tit != ' ') {
        if (*dit != *tit) return static_cast<size_t>(-1);
        ++tit; ++dit; pos++;
      }

      if (pos > last_pos) {
        segmentation_out.push_back(make_pair(last_pos, pos));
      }
      else {
        done = true;
      }

      // eat up spaces
      while (dit != utf32_detokenized.end() and *dit == ' ') { ++dit; pos++; }
      while (tit != utf32_tokenized.end() and *tit == ' ') { ++tit; }
    }

    return segmentation_out.size();
  }


  virtual void preprocess(const std::string &detokenized_orig,
                          std::vector<std::string> &tokenized,
                          std::vector< std::pair<size_t, size_t> > &segmentation_out)
  {
    string detokenized = detokenized_orig;
    // check for invalid utf-8 (for a simple yes/no check, there is also utf8::is_valid function)
     string::iterator end_it = utf8::find_invalid(detokenized.begin(), detokenized.end());
     if (end_it != detokenized.end()) {
         cout << "Invalid UTF-8 encoding detected at sentence " << detokenized << "\n";
         detokenized = string(detokenized.begin(), end_it);
         cout << "This part is fine: " << detokenized << "\n";
     }

    // separate tokens by spaces
    // DO NOT CHANGE TEXT, ONLY ADD SPACES!!!
    string tokenized_str;
    tokenize(detokenized, tokenized_str);

    // match words from detokenized to tokenized to set segmentation
    segmentation_out.clear();
    if (match_segmentation(detokenized, tokenized_str, segmentation_out) == static_cast<size_t>(-1)) {
      cerr << "Wrong preprocessing, segmentation is probably wrong" << endl;
    }

    // preprocess tokenized string (categorization, lowercase, etc)
    // DO NOT ADD OR REMOVE MORE SPACES, ONLY CHANGE TEXT!!!
    string preprocessed;
    preprocess(tokenized_str, preprocessed);
   
    // split preprocessed at spaces
    tokenized.clear();
    casmacat::tokenize(preprocessed, tokenized);
  }

  virtual void postprocess(const std::vector<std::string> &tokenized,
                            std::string &detokenized,
                            std::vector< std::pair<size_t, size_t> > &segmentation)
  {
    // join tokens with spaces
    string tokenized_str;
    casmacat::join(tokenized, tokenized_str);

    // postprocess tokenized string (categorization, lowercase, etc)
    // DO NOT ADD OR REMOVE MORE SPACES, ONLY CHANGE TEXT!!!
    string postprocessed;
    postprocess(tokenized_str, postprocessed);

    // detokenize string
    // DO NOT CHANGE TEXT, ONLY REMOVE SPACES!!!
    detokenize(postprocessed, detokenized);

    // match words from detokenized to tokenized to set segmentation
    segmentation.clear();
    if (match_segmentation(detokenized, postprocessed, segmentation) == static_cast<size_t>(-1)) {
      cerr << "Wrong postprocessing, segmentation is probably wrong" << endl;
    }
  }

};

size_t PerlTokenizer::_num_perl_plugin_instances = 0;

class PerlTokenizerFactory: public ITextProcessorFactory {
  int _argc;
  char **_argv;
  string _name;
public:
  PerlTokenizerFactory(): _argv(0), _name("perl") { }
  ~PerlTokenizerFactory() {
    if (_argv != 0) {
      char **it = _argv;
      while (*it) { delete[] it++; }
      delete[] _argv;
    }
  }

  virtual int init(int argc, char *argv[], Context *context = 0) {
    // invalid number of arguments
    if (argc < 2) { return EXIT_FAILURE; }
    
    // copy arguments
    _argc = argc;
    _argv = new char*[argc + 1];
    _argv[0] = new char [_name.size() + 1];
    _argv[0] = strcpy(_argv[0], _name.c_str()); 
    for (size_t a = 0; a < argc; a++) {
      _argv[a] = new char [strlen(argv[a]) + 1];
      strcpy(_argv[a], argv[a]);
    }
    _argv[argc] = 0;

    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }

  virtual ITextProcessor *createInstance(const std::string &specialization_id = "") {
    return new PerlTokenizer(_argc, _argv);
  }

  virtual void deleteInstance(ITextProcessor *instance) {
    delete instance;
  }

};


EXPORT_CASMACAT_PLUGIN(ITextProcessor, PerlTokenizerFactory);
