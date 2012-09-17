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
 * processor.cpp
 *
 *  Created on: 14/09/2012
 *      Author: valabau
 */





#include <cstdlib>
#include <casmacat/compat.h>
#include <casmacat/utils.h>
#include <casmacat/ITextProcessor.h>
#include <casmacat/Plugin.h>
#include <iostream>
#include <fstream>
#include <cassert>

using namespace casmacat;
using namespace std;

int main(int argc, char* argv[]) {

    if (argc != 3) {
      cerr << "Usage: " << argv[0] << " plugin text\n";
      return EXIT_FAILURE;
    }

    string text_processor_plugin_fn = argv[1];
    string args = "";

    Plugin<ITextProcessorFactory> text_processor_plugin(text_processor_plugin_fn, args);

    ITextProcessorFactory *text_processor_factory = text_processor_plugin.create();
    ITextProcessor *text_processor = text_processor_factory->createProcessor();

    if (text_processor == 0) {
      cerr << "Plugin could not be instantiated\n";
    }
    else {
      cerr << "Plugin loaded\n";
      ifstream file(argv[2]);

      string text;
      vector<string> tokens;
      vector< pair<size_t, size_t> > segmentation;

      while(getline(file, text)) {
        cout << "text: " << text << "\n";

        text_processor->preprocess(text, tokens);
        text_processor->postprocess(tokens, text, segmentation);

        cout << "post-processed text: " << text << "\n";

        for (size_t t = 0; t < tokens.size(); t++) {
          cout << "tok" << t << ": " << tokens[t] << " from " << segmentation[t].first << " to " << segmentation[t].second << "\n";
        }
      }
    }


    return EXIT_SUCCESS;
}


